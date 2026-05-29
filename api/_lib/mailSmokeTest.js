import { getMailWorkerConfigFromEnv } from './mailOutboxWorker.js';
import { createMailProviderAdapter } from './mailProviderAdapter.js';
import { loadMailRuntimeState } from './mailRuntimeConfig.js';
import { renderMailTemplate } from './mailTemplateRenderer.js';
import {
  buildRecipientFingerprint,
  hashMailIdentifier,
  sanitizeMailPayload,
} from './mailAbuseGuards.js';

function readEnvironment() {
  return globalThis.process?.env || {};
}

function toIsoTimestamp(value = new Date()) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function normalizeLocale(value) {
  const normalized = String(value || 'zh-CN').trim();
  return normalized || 'zh-CN';
}

function createSmokeMessage({
  recipientEmail,
  locale,
  providerConfig,
  now,
} = {}) {
  const isEnglish = normalizeLocale(locale).toLowerCase().startsWith('en');
  const generatedAt = toIsoTimestamp(now);
  const rendered = renderMailTemplate({
    templateKey: 'admin.mail-smoke-test',
    locale,
    generatedAt,
    overrides: {
      secondary: isEnglish
        ? 'If you did not request this test, contact the site administrator.'
        : '如果不是你请求了这次测试，请联系站点管理员。',
    },
  });

  return {
    from: {
      address: providerConfig.fromAddress,
      name: providerConfig.fromName,
    },
    to: recipientEmail,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    templateKey: 'admin.mail-smoke-test',
    locale: normalizeLocale(locale),
    eventType: 'admin_alert',
    relatedEntityType: 'admin_mail_smoke_test',
    relatedEntityId: '',
    payload: {
      generatedAt,
    },
  };
}

async function insertSmokeDeliveryEvent(adminClient, {
  actorUserId,
  providerResult,
  recipient,
  now,
} = {}) {
  if (!adminClient?.from) {
    return {
      ok: false,
      error: 'admin_client_unavailable',
    };
  }

  const providerMessageIdHash = providerResult?.providerMessageId
    ? hashMailIdentifier(providerResult.providerMessageId, { prefix: 'provider_message_id' })
    : null;
  const eventType = providerResult?.ok
    ? (providerResult?.dryRun ? 'smoke_test_dry_run' : 'smoke_test_accepted')
    : 'smoke_test_failed';
  const eventPayload = sanitizeMailPayload({
    code: providerResult?.code || eventType,
    reason: providerResult?.reason || '',
    dryRun: Boolean(providerResult?.dryRun),
    retryable: providerResult?.retryable !== false,
    recipientDomain: recipient?.domain || '',
    recipientRedacted: recipient?.redacted || '',
    actorUserIdHash: actorUserId
      ? hashMailIdentifier(actorUserId, { prefix: 'admin_actor_user' })
      : '',
    diagnostics: providerResult?.diagnostics || {},
  });

  const { error } = await adminClient
    .from('mail_delivery_events')
    .insert({
      outbox_id: null,
      provider_key: providerResult?.providerKey || null,
      provider_message_id_hash: providerMessageIdHash,
      event_type: eventType,
      event_payload_redacted_json: eventPayload,
      created_at: toIsoTimestamp(now),
    });

  if (error) {
    return {
      ok: false,
      error: error.message || 'mail_smoke_event_insert_failed',
    };
  }

  return {
    ok: true,
    eventType,
  };
}

export async function sendMailSmokeTest({
  adminClient,
  recipientEmail,
  locale = 'zh-CN',
  actorUserId = '',
  env = readEnvironment(),
  now = new Date(),
  adapter = null,
} = {}) {
  const recipient = buildRecipientFingerprint(recipientEmail);
  if (!recipient.ok) {
    return {
      ok: false,
      skipped: true,
      code: recipient.reason || 'invalid_email',
      reason: 'Recipient email is invalid.',
      recipient: {
        redacted: recipient.redacted,
        domain: recipient.domain,
      },
    };
  }

  const workerConfig = getMailWorkerConfigFromEnv(env);
  const providerAdapter = adapter || createMailProviderAdapter({ env });
  const providerConfig = providerAdapter.config || {};

  if (!workerConfig.enabled) {
    return {
      ok: false,
      skipped: true,
      code: 'mail_worker_disabled',
      reason: '邮件队列处理器未启用。请在 Vercel 环境变量中将 MAIL_OUTBOX_WORKER_ENABLED 设为 true，并重新部署；如果仍要暂停真实发信，请使用紧急停发开关或演练模式。',
      dryRun: Boolean(providerConfig.dryRun),
      requiredEnv: [
        {
          name: 'MAIL_OUTBOX_WORKER_ENABLED',
          expected: 'true',
        },
      ],
      diagnostics: {
        workerEnabled: false,
        workerEnvConfigured: Boolean(env.MAIL_OUTBOX_WORKER_ENABLED || env.MAIL_WORKER_ENABLED),
        providerMode: providerConfig.dryRun ? 'rehearsal' : 'live',
      },
      recipient: {
        redacted: recipient.redacted,
        domain: recipient.domain,
      },
    };
  }

  if (workerConfig.killSwitch && providerConfig.dryRun === false) {
    return {
      ok: false,
      skipped: true,
      code: 'mail_worker_kill_switch_enabled',
      reason: '环境紧急停发开关已开启。',
      dryRun: Boolean(providerConfig.dryRun),
      recipient: {
        redacted: recipient.redacted,
        domain: recipient.domain,
      },
    };
  }

  let runtimeState = null;
  try {
    runtimeState = await loadMailRuntimeState(adminClient, env);
  } catch {
    runtimeState = null;
  }

  if (runtimeState?.controls?.killSwitch && providerConfig.dryRun === false) {
    return {
      ok: false,
      skipped: true,
      code: 'mail_runtime_kill_switch_enabled',
      reason: '运行期紧急停发开关已开启。',
      dryRun: Boolean(providerConfig.dryRun),
      recipient: {
        redacted: recipient.redacted,
        domain: recipient.domain,
      },
    };
  }

  const message = createSmokeMessage({
    recipientEmail,
    locale,
    providerConfig,
    now,
  });
  const providerResult = await providerAdapter.send(message);
  const deliveryEvent = await insertSmokeDeliveryEvent(adminClient, {
    actorUserId,
    providerResult,
    recipient,
    now,
  });

  return {
    ok: Boolean(providerResult?.ok),
    skipped: false,
    accepted: Boolean(providerResult?.accepted),
    dryRun: Boolean(providerResult?.dryRun),
    code: providerResult?.code || 'mail_smoke_test_unknown',
    reason: sanitizeMailPayload(providerResult?.reason || ''),
    providerKey: providerResult?.providerKey || providerConfig.providerKey || providerConfig.provider || 'mail',
    retryable: providerResult?.retryable !== false,
    recipient: {
      redacted: recipient.redacted,
      domain: recipient.domain,
    },
    deliveryEvent,
  };
}

export const __internal = {
  createSmokeMessage,
  insertSmokeDeliveryEvent,
};
