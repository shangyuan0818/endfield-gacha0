import {
  getBearerToken,
  getSupabaseAdminClient,
  getSupabaseAnonServerClient,
} from './authAdmin.js';
import { rejectDisallowedBrowserOrigin } from './http.js';
import {
  buildOfficialAnnouncementApplyPlan,
  buildUpdatedOfficialAnnouncementReviewBundle,
} from './officialAnnouncementAutomation.js';

const AUTO_GAME_ANNOUNCEMENT_PRIORITY = 0;
const ANNOUNCEMENT_PRIORITY_MIN = 0;
const ANNOUNCEMENT_PRIORITY_MAX = 100;

function parseRequestBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value) {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map(item => normalizeText(item))
      .filter(Boolean)
  ));
}

function formatStructuredError(error, fallback = 'Unexpected error') {
  const message = normalizeText(error?.message) || fallback;
  const details = normalizeText(error?.details);
  const hint = normalizeText(error?.hint);
  const code = normalizeText(error?.code);
  const segments = [message];

  if (code) {
    segments.push(`code=${code}`);
  }

  if (details) {
    segments.push(`details=${details}`);
  }

  if (hint) {
    segments.push(`hint=${hint}`);
  }

  return segments.join(' | ');
}

function normalizeAnnouncementPriority(value, fallback = AUTO_GAME_ANNOUNCEMENT_PRIORITY) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  const integerValue = Math.trunc(numericValue);
  return Math.min(ANNOUNCEMENT_PRIORITY_MAX, Math.max(ANNOUNCEMENT_PRIORITY_MIN, integerValue));
}

async function requireSuperAdmin(req, {
  adminClient,
  callerClient,
}) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return {
      error: { status: 401, message: 'Missing access token' },
    };
  }

  if (!callerClient) {
    return {
      error: { status: 503, message: 'Supabase anon server client not configured' },
    };
  }

  const { data: userData, error: userError } = await callerClient.auth.getUser(accessToken);
  if (userError || !userData?.user?.id) {
    return {
      error: { status: 401, message: userError?.message || 'Invalid access token' },
    };
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .single();

  if (profileError) {
    return {
      error: { status: 500, message: profileError.message || 'Failed to load caller profile' },
    };
  }

  if (profile?.role !== 'super_admin') {
    return {
      error: { status: 403, message: 'Super admin role required' },
    };
  }

  return {
    accessToken,
    callerUser: userData.user,
  };
}

async function loadOfficialAnnouncementRun(adminClient, runId) {
  const { data, error } = await adminClient
    .from('ops_automation_runs')
    .select('id, job_id, status, dry_run, review_bundle')
    .eq('id', runId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function loadExistingAnnouncements(adminClient, sourceIds) {
  const normalizedSourceIds = normalizeStringArray(sourceIds);
  if (normalizedSourceIds.length === 0) {
    return [];
  }

  const { data, error } = await adminClient
    .from('announcements')
    .select('id, source_id, is_active, priority')
    .in('source_id', normalizedSourceIds);

  if (error) {
    throw error;
  }

  return data || [];
}

async function updateRunReviewBundle(adminClient, runId, reviewBundle, errorMessage = null) {
  const { data, error } = await adminClient
    .from('ops_automation_runs')
    .update({
      review_bundle: reviewBundle,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .select('id, review_bundle')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function insertAnnouncement(writeClient, payload) {
  const { error } = await writeClient
    .from('announcements')
    .insert(payload);

  if (error) {
    throw error;
  }
}

async function updateAnnouncement(writeClient, id, payload) {
  const { error } = await writeClient
    .from('announcements')
    .update(payload)
    .eq('id', id);

  if (error) {
    throw error;
  }
}

export async function applyOfficialAnnouncementsRun({
  adminClient,
  run,
  selectedSourceIds = [],
  reviewNote = '',
  callerUserId = '',
  now = new Date().toISOString(),
}) {
  const allPlan = buildOfficialAnnouncementApplyPlan(run?.review_bundle);
  const plan = selectedSourceIds.length > 0
    ? buildOfficialAnnouncementApplyPlan(run?.review_bundle, { selectedSourceIds })
    : allPlan;

  if (plan.missingRequestedSourceIds.length > 0) {
    return {
      ok: false,
      status: 400,
      error: `以下 source_id 不在审核包中：${plan.missingRequestedSourceIds.join(', ')}`,
      plan,
    };
  }

  if (plan.requestedSourceIds.length === 0) {
    return {
      ok: false,
      status: 400,
      error: '审核包中没有可应用的公告记录',
      plan,
    };
  }

  if (plan.blockedRecords.length > 0) {
    return {
      ok: false,
      status: 409,
      error: '所选公告仍包含阻塞项，请先修复后再发布',
      plan,
    };
  }

  if (plan.applicableRecords.length === 0) {
    return {
      ok: false,
      status: 409,
      error: '所选公告均已应用，无需重复发布',
      plan,
    };
  }

  const existingRows = await loadExistingAnnouncements(adminClient, plan.applicableSourceIds);
  const existingRowMap = new Map(
    existingRows.map(row => [normalizeText(row.source_id), row])
  );
  const appliedSourceIds = [];

  try {
    for (const record of plan.applicableRecords) {
      const existingRow = existingRowMap.get(record.source_id);

      if (existingRow?.id) {
        await updateAnnouncement(adminClient, existingRow.id, {
          title: record.title,
          content: record.content,
          version: record.version,
          is_active: existingRow.is_active !== false,
          priority: normalizeAnnouncementPriority(existingRow.priority),
          source_url: record.source_url,
          published_at: record.published_at,
          summary: record.summary,
          updated_at: now,
        });
      } else {
        await insertAnnouncement(adminClient, {
          title: record.title,
          content: record.content,
          version: record.version,
          is_active: record.is_active !== false,
          priority: normalizeAnnouncementPriority(record.priority),
          source_id: record.source_id,
          source_url: record.source_url,
          published_at: record.published_at,
          summary: record.summary,
          created_by: callerUserId || null,
        });
      }

      appliedSourceIds.push(record.source_id);
    }

    const nextAppliedSourceIds = Array.from(new Set([
      ...normalizeStringArray(run?.review_bundle?.review?.appliedSourceIds),
      ...appliedSourceIds,
    ]));
    const outstandingSourceIds = allPlan.requestedSourceIds.filter(sourceId => (
      !allPlan.blockedSourceIds.includes(sourceId)
      && !nextAppliedSourceIds.includes(sourceId)
    ));
    const reviewStatus = allPlan.blockedSourceIds.length === 0 && outstandingSourceIds.length === 0
      ? 'applied'
      : 'partially_applied';
    const nextReviewBundle = buildUpdatedOfficialAnnouncementReviewBundle(run?.review_bundle, {
      appliedSourceIds,
      blockedSourceIds: allPlan.blockedSourceIds,
      actorUserId: callerUserId,
      attemptedAt: now,
      note: reviewNote,
      status: reviewStatus,
      error: null,
    });

    await updateRunReviewBundle(adminClient, run.id, nextReviewBundle, null);

    return {
      ok: true,
      status: 200,
      reviewStatus,
      appliedSourceIds,
      outstandingSourceIds,
      blockedSourceIds: allPlan.blockedSourceIds,
      plan,
    };
  } catch (error) {
    const reviewStatus = appliedSourceIds.length > 0 ? 'partially_applied' : 'apply_failed';
    const errorMessage = formatStructuredError(error, 'Failed to apply official announcements run');
    const nextReviewBundle = buildUpdatedOfficialAnnouncementReviewBundle(run?.review_bundle, {
      appliedSourceIds,
      blockedSourceIds: allPlan.blockedSourceIds,
      actorUserId: callerUserId,
      attemptedAt: now,
      note: reviewNote,
      status: reviewStatus,
      error: errorMessage,
    });
    let reviewBundleUpdateError = null;

    try {
      await updateRunReviewBundle(
        adminClient,
        run.id,
        nextReviewBundle,
        errorMessage,
      );
    } catch (updateError) {
      reviewBundleUpdateError = formatStructuredError(updateError, 'Failed to update review bundle');
    }

    return {
      ok: false,
      status: 500,
      error: reviewBundleUpdateError
        ? `${errorMessage} | review_bundle_update=${reviewBundleUpdateError}`
        : errorMessage,
      appliedSourceIds,
      plan,
    };
  }
}

export async function handleAdminApplyOfficialAnnouncements(req, res, {
  getAdminClient = getSupabaseAdminClient,
  getCallerClient = getSupabaseAnonServerClient,
  now = () => new Date().toISOString(),
} = {}) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'POST, OPTIONS',
    headers: 'Content-Type, Authorization',
  })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
    return;
  }

  const { runId, sourceIds, reviewNote } = parseRequestBody(req);
  const normalizedRunId = normalizeText(runId);
  const normalizedSourceIds = normalizeStringArray(sourceIds);

  if (!normalizedRunId) {
    res.status(400).json({
      success: false,
      error: 'Missing runId',
    });
    return;
  }

  const adminClient = getAdminClient();
  if (!adminClient) {
    res.status(503).json({
      success: false,
      error: 'Auth admin not configured',
    });
    return;
  }

  const callerClient = getCallerClient();
  const authResult = await requireSuperAdmin(req, {
    adminClient,
    callerClient,
  });

  if (authResult.error) {
    res.status(authResult.error.status).json({
      success: false,
      error: authResult.error.message,
    });
    return;
  }

  try {
    const run = await loadOfficialAnnouncementRun(adminClient, normalizedRunId);
    if (!run) {
      res.status(404).json({
        success: false,
        error: 'Ops automation run not found',
      });
      return;
    }

    if (run.job_id !== 'official-announcements') {
      res.status(400).json({
        success: false,
        error: 'Only official-announcements runs can be applied by this endpoint',
      });
      return;
    }

    if (run.status !== 'success') {
      res.status(409).json({
        success: false,
        error: 'Only successful dry-run records can be applied',
      });
      return;
    }

    if (!run.review_bundle?.snapshots?.incoming) {
      res.status(409).json({
        success: false,
        error: 'This run does not contain a review bundle snapshot',
      });
      return;
    }

    const applyResult = await applyOfficialAnnouncementsRun({
      adminClient,
      run,
      selectedSourceIds: normalizedSourceIds,
      reviewNote: normalizeText(reviewNote),
      callerUserId: authResult.callerUser.id,
      now: now(),
    });

    res.status(applyResult.status).json({
      success: applyResult.ok,
      error: applyResult.ok ? null : applyResult.error,
      runId: normalizedRunId,
      review_status: applyResult.reviewStatus || null,
      applied_source_ids: applyResult.appliedSourceIds || [],
      blocked_source_ids: applyResult.blockedSourceIds || [],
      outstanding_source_ids: applyResult.outstandingSourceIds || [],
      plan: applyResult.plan
        ? {
          summary: applyResult.plan.summary,
          requested_source_ids: applyResult.plan.requestedSourceIds,
          blocked_records: applyResult.plan.blockedRecords,
          already_applied_records: applyResult.plan.alreadyAppliedRecords,
        }
        : null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: formatStructuredError(error, 'Failed to apply official announcements run'),
    });
  }
}

export default async function handler(req, res) {
  await handleAdminApplyOfficialAnnouncements(req, res);
}
