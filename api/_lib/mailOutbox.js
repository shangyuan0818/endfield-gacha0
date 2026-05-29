import {
  evaluateMailAbuseGuards,
  sanitizeMailPayload,
  serializeMailDecisionForStorage,
} from './mailAbuseGuards.js';
import {
  buildMailRuntimeControls,
  loadMailRuntimeState,
} from './mailRuntimeConfig.js';

function readEnvironment() {
  return globalThis.process?.env || {};
}

function splitList(rawValue) {
  return String(rawValue || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

export function getMailOutboxControlsFromEnv(env = readEnvironment()) {
  return {
    killSwitch: parseBoolean(env.MAIL_OUTBOX_GLOBAL_KILL_SWITCH),
    disabledEvents: splitList(env.MAIL_OUTBOX_DISABLED_EVENTS),
    pausedDomains: splitList(env.MAIL_OUTBOX_PAUSED_DOMAINS).map((domain) => domain.toLowerCase()),
  };
}

function uniqueStrings(values) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ));
}

function mergeMailOutboxControls(...controlSets) {
  const sets = controlSets.filter(Boolean);
  return {
    killSwitch: sets.some(controls => Boolean(controls.killSwitch)),
    disabledEvents: uniqueStrings(sets.flatMap(controls => controls.disabledEvents || [])),
    pausedDomains: uniqueStrings(
      sets.flatMap(controls => controls.pausedDomains || []).map(domain => domain.toLowerCase())
    ),
  };
}

function toIsoTimestamp(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value || Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function normalizePriority(priority) {
  const parsed = Number.parseInt(priority, 10);
  if (!Number.isFinite(parsed)) {
    return 5;
  }

  return Math.min(9, Math.max(1, parsed));
}

function normalizeUuid(value) {
  const normalized = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : null;
}

function isNotFoundError(error) {
  return error?.code === 'PGRST116' || /0 rows/i.test(String(error?.message || ''));
}

async function findExistingOutboxItem(adminClient, idempotencyKey) {
  if (!idempotencyKey) {
    return null;
  }

  const query = adminClient
    .from('mail_outbox')
    .select('id, status, created_at, idempotency_key')
    .eq('idempotency_key', idempotencyKey);

  const { data, error } = typeof query.maybeSingle === 'function'
    ? await query.maybeSingle()
    : await query.limit(1);

  if (error && !isNotFoundError(error)) {
    throw error;
  }

  if (Array.isArray(data)) {
    return data[0] || null;
  }

  return data || null;
}

function filterActiveSuppressions(rows, now) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!row || row.status === 'revoked') {
      return false;
    }

    if (!row.expires_at) {
      return true;
    }

    const expiresAtMs = new Date(row.expires_at).getTime();
    return !Number.isFinite(expiresAtMs) || expiresAtMs > nowMs;
  });
}

async function loadSuppressionRows(adminClient, recipient, now) {
  if (!recipient?.emailHash && !recipient?.domain) {
    return [];
  }

  const queries = [];

  if (recipient.emailHash) {
    queries.push(
      adminClient
        .from('mail_suppression')
        .select('recipient_email_hash, recipient_domain, reason, status, expires_at')
        .eq('status', 'active')
        .eq('recipient_email_hash', recipient.emailHash)
        .limit(10)
    );
  }

  if (recipient.domain) {
    queries.push(
      adminClient
        .from('mail_suppression')
        .select('recipient_email_hash, recipient_domain, reason, status, expires_at')
        .eq('status', 'active')
        .eq('recipient_domain', recipient.domain)
        .limit(10)
    );
  }

  const rows = [];
  for (const query of queries) {
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    rows.push(...(Array.isArray(data) ? data : []));
  }

  return filterActiveSuppressions(rows, now).map((row) => ({
    recipientEmailHash: row.recipient_email_hash || row.recipientEmailHash || '',
    recipientDomain: row.recipient_domain || row.recipientDomain || row.domain || '',
    domain: row.domain || row.recipient_domain || row.recipientDomain || '',
    status: row.status,
    reason: row.reason,
  }));
}

async function loadBudgetCounters(adminClient, buckets) {
  const bucketKeys = Array.from(new Set(
    (Array.isArray(buckets) ? buckets : [])
      .map((bucket) => bucket?.bucketKeyHash)
      .filter(Boolean)
  ));

  if (bucketKeys.length === 0) {
    return {};
  }

  const { data, error } = await adminClient
    .from('mail_abuse_budget_counters')
    .select('bucket_key_hash, used_count')
    .in('bucket_key_hash', bucketKeys);

  if (error) {
    throw error;
  }

  return Object.fromEntries(
    (Array.isArray(data) ? data : []).map((row) => [
      row.bucket_key_hash,
      Number(row.used_count || 0),
    ])
  );
}

function blockedResult(code, reason, extra = {}) {
  return {
    ok: false,
    queued: false,
    deduped: false,
    action: 'block',
    code,
    reason,
    ...extra,
  };
}

function normalizeRpcResult(data) {
  if (!data || typeof data !== 'object') {
    return {
      action: 'unknown',
      code: 'mail_enqueue_rpc_empty_response',
    };
  }

  return {
    ...data,
    outboxId: data.outboxId || data.outbox_id || null,
    idempotencyKey: data.idempotencyKey || data.idempotency_key || null,
  };
}

export async function enqueueMailOutboxEvent({
  adminClient,
  eventType,
  recipientEmail,
  requesterIp = '',
  userId = '',
  templateKey,
  locale = 'zh-CN',
  relatedEntityType = '',
  relatedEntityId = '',
  purposeKey = '',
  payload = {},
  priority = 5,
  now = new Date(),
  hashSalt,
  controls = {},
} = {}) {
  if (!adminClient || typeof adminClient.from !== 'function' || typeof adminClient.rpc !== 'function') {
    return blockedResult('admin_client_unavailable', 'Mail enqueue requires a service-role Supabase client.');
  }

  const normalizedTemplateKey = String(templateKey || '').trim();
  const normalizedLocale = String(locale || 'zh-CN').trim() || 'zh-CN';

  if (!normalizedTemplateKey) {
    return blockedResult('missing_template_key', 'Mail enqueue requires a template key.');
  }

  let runtimeControls = {};
  try {
    runtimeControls = buildMailRuntimeControls(await loadMailRuntimeState(adminClient), '');
  } catch {
    runtimeControls = {};
  }
  const resolvedControls = mergeMailOutboxControls(
    getMailOutboxControlsFromEnv(),
    runtimeControls,
    controls
  );

  const firstDecision = evaluateMailAbuseGuards({
    eventType,
    recipientEmail,
    requesterIp,
    userId,
    templateKey: normalizedTemplateKey,
    locale: normalizedLocale,
    relatedEntityType,
    relatedEntityId,
    purposeKey,
    killSwitch: resolvedControls.killSwitch,
    disabledEvents: resolvedControls.disabledEvents,
    pausedDomains: resolvedControls.pausedDomains,
    now,
    hashSalt,
  });

  if (!firstDecision.allowed) {
    return {
      ...blockedResult(firstDecision.code, firstDecision.reason),
      decision: serializeMailDecisionForStorage(firstDecision),
    };
  }

  try {
    const existingItem = await findExistingOutboxItem(adminClient, firstDecision.idempotencyKey);
    const suppressionList = await loadSuppressionRows(adminClient, firstDecision.recipient, now);
    const counters = await loadBudgetCounters(adminClient, firstDecision.buckets);
    const finalDecision = evaluateMailAbuseGuards({
      eventType,
      recipientEmail,
      requesterIp,
      userId,
      templateKey: normalizedTemplateKey,
      locale: normalizedLocale,
      relatedEntityType,
      relatedEntityId,
      purposeKey,
      killSwitch: resolvedControls.killSwitch,
      disabledEvents: resolvedControls.disabledEvents,
      pausedDomains: resolvedControls.pausedDomains,
      suppressionList,
      existingIdempotency: Boolean(existingItem),
      counters,
      now,
      hashSalt,
    });
    const storedDecision = serializeMailDecisionForStorage(finalDecision);

    if (!finalDecision.shouldEnqueue) {
      return {
        ok: finalDecision.allowed,
        queued: false,
        deduped: finalDecision.action === 'dedupe',
        action: finalDecision.action,
        code: finalDecision.code,
        reason: finalDecision.reason,
        outboxId: existingItem?.id || null,
        idempotencyKey: finalDecision.idempotencyKey,
        decision: storedDecision,
      };
    }

    const payloadRedacted = sanitizeMailPayload(payload);
    const { data, error } = await adminClient.rpc('enqueue_mail_outbox_event', {
      p_event_type: eventType,
      p_recipient_email_hash: finalDecision.recipient.emailHash,
      p_recipient_domain: finalDecision.recipient.domain,
      p_template_key: normalizedTemplateKey,
      p_idempotency_key: finalDecision.idempotencyKey,
      p_locale: normalizedLocale,
      p_payload_redacted_json: payloadRedacted,
      p_priority: normalizePriority(priority),
      p_guard_decision: storedDecision,
      p_budget_buckets: storedDecision.buckets,
      p_created_by_user_id: normalizeUuid(userId),
      p_related_entity_type: relatedEntityType || null,
      p_related_entity_id: relatedEntityId || null,
      p_now: toIsoTimestamp(now),
    });

    if (error) {
      return blockedResult('mail_enqueue_rpc_failed', error.message || 'Mail enqueue RPC failed.', {
        idempotencyKey: finalDecision.idempotencyKey,
        decision: storedDecision,
      });
    }

    const rpcResult = normalizeRpcResult(data);
    const action = rpcResult.action || 'unknown';

    return {
      ok: action !== 'block',
      queued: action === 'queue',
      deduped: action === 'dedupe',
      action,
      code: rpcResult.code || (action === 'queue' ? 'mail_outbox_queued' : 'mail_enqueue_result'),
      reason: rpcResult.reason || finalDecision.reason,
      outboxId: rpcResult.outboxId,
      idempotencyKey: rpcResult.idempotencyKey || finalDecision.idempotencyKey,
      decision: storedDecision,
      rpcResult,
    };
  } catch (error) {
    return blockedResult('mail_enqueue_failed', error?.message || 'Mail enqueue failed.', {
      idempotencyKey: firstDecision.idempotencyKey,
      decision: serializeMailDecisionForStorage(firstDecision),
    });
  }
}
