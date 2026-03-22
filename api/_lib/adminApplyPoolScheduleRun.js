import {
  createSupabaseAccessTokenClient,
  getBearerToken,
  getSupabaseAdminClient,
  getSupabaseAnonServerClient,
} from './authAdmin.js';
import { rejectDisallowedBrowserOrigin } from './http.js';
import {
  buildPoolScheduleApplyPlan,
  buildUpdatedPoolScheduleReviewBundle,
} from './poolScheduleAutomation.js';

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

async function loadPoolScheduleRun(adminClient, runId) {
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

async function loadCharacterRows(adminClient) {
  const { data, error } = await adminClient
    .from('characters')
    .select('id, name, aliases, type');

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

export async function applyPoolScheduleRun({
  adminClient,
  userClient,
  run,
  characters,
  selectedPoolIds = [],
  reviewNote = '',
  callerUserId = '',
  now = new Date().toISOString(),
}) {
  const allPlan = buildPoolScheduleApplyPlan(run?.review_bundle, { characters });
  const plan = selectedPoolIds.length > 0
    ? buildPoolScheduleApplyPlan(run?.review_bundle, {
      characters,
      selectedPoolIds,
    })
    : allPlan;

  if (plan.missingRequestedPoolIds.length > 0) {
    return {
      ok: false,
      status: 400,
      error: `以下 pool_id 不在审核包中：${plan.missingRequestedPoolIds.join(', ')}`,
      plan,
    };
  }

  if (plan.requestedPoolIds.length === 0) {
    return {
      ok: false,
      status: 400,
      error: '审核包中没有可应用的卡池记录',
      plan,
    };
  }

  if (plan.blockedRecords.length > 0) {
    return {
      ok: false,
      status: 409,
      error: '所选卡池仍包含阻塞项，请先人工补齐时间或角色映射后再发布',
      plan,
    };
  }

  if (plan.applicableRecords.length === 0) {
    return {
      ok: false,
      status: 409,
      error: '所选卡池均已应用，无需重复发布',
      plan,
    };
  }

  const appliedPoolIds = [];

  try {
    for (const record of plan.applicableRecords) {
      const { error } = await userClient.rpc('admin_upsert_pool_with_aliases', {
        p_pool_id: record.pool_id,
        p_insert_payload: record.insertPayload,
        p_update_payload: record.updatePayload,
        p_alias_rows: record.aliasRows,
        p_pool_character_rows: record.poolCharacterRows,
      });

      if (error) {
        throw error;
      }

      appliedPoolIds.push(record.pool_id);
    }

    const nextAppliedPoolIds = Array.from(new Set([
      ...normalizeStringArray(run?.review_bundle?.review?.appliedPoolIds),
      ...appliedPoolIds,
    ]));
    const outstandingPoolIds = allPlan.requestedPoolIds.filter(poolId => (
      !allPlan.blockedPoolIds.includes(poolId)
      && !nextAppliedPoolIds.includes(poolId)
    ));
    const reviewStatus = allPlan.blockedPoolIds.length === 0 && outstandingPoolIds.length === 0
      ? 'applied'
      : 'partially_applied';
    const nextReviewBundle = buildUpdatedPoolScheduleReviewBundle(run?.review_bundle, {
      appliedPoolIds,
      blockedPoolIds: allPlan.blockedPoolIds,
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
      appliedPoolIds,
      outstandingPoolIds,
      blockedPoolIds: allPlan.blockedPoolIds,
      plan,
    };
  } catch (error) {
    const reviewStatus = appliedPoolIds.length > 0 ? 'partially_applied' : 'apply_failed';
    const nextReviewBundle = buildUpdatedPoolScheduleReviewBundle(run?.review_bundle, {
      appliedPoolIds,
      blockedPoolIds: allPlan.blockedPoolIds,
      actorUserId: callerUserId,
      attemptedAt: now,
      note: reviewNote,
      status: reviewStatus,
      error: error?.message || 'Failed to apply pool schedule run',
    });

    await updateRunReviewBundle(
      adminClient,
      run.id,
      nextReviewBundle,
      error?.message || 'Failed to apply pool schedule run',
    );

    return {
      ok: false,
      status: 500,
      error: error?.message || 'Failed to apply pool schedule run',
      appliedPoolIds,
      plan,
    };
  }
}

export async function handleAdminApplyPoolSchedule(req, res, {
  getAdminClient = getSupabaseAdminClient,
  getCallerClient = getSupabaseAnonServerClient,
  createUserClient = createSupabaseAccessTokenClient,
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

  const { runId, poolIds, reviewNote } = parseRequestBody(req);
  const normalizedRunId = normalizeText(runId);
  const normalizedPoolIds = normalizeStringArray(poolIds);

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

  const userClient = createUserClient(authResult.accessToken);
  if (!userClient) {
    res.status(503).json({
      success: false,
      error: 'Authenticated Supabase client is not configured',
    });
    return;
  }

  try {
    const run = await loadPoolScheduleRun(adminClient, normalizedRunId);
    if (!run) {
      res.status(404).json({
        success: false,
        error: 'Ops automation run not found',
      });
      return;
    }

    if (run.job_id !== 'pool-schedule') {
      res.status(400).json({
        success: false,
        error: 'Only pool-schedule runs can be applied by this endpoint',
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

    const characters = await loadCharacterRows(adminClient);
    const applyResult = await applyPoolScheduleRun({
      adminClient,
      userClient,
      run,
      characters,
      selectedPoolIds: normalizedPoolIds,
      reviewNote: normalizeText(reviewNote),
      callerUserId: authResult.callerUser.id,
      now: now(),
    });

    res.status(applyResult.status).json({
      success: applyResult.ok,
      error: applyResult.ok ? null : applyResult.error,
      runId: normalizedRunId,
      review_status: applyResult.reviewStatus || null,
      applied_pool_ids: applyResult.appliedPoolIds || [],
      blocked_pool_ids: applyResult.blockedPoolIds || [],
      outstanding_pool_ids: applyResult.outstandingPoolIds || [],
      plan: applyResult.plan
        ? {
          summary: applyResult.plan.summary,
          requested_pool_ids: applyResult.plan.requestedPoolIds,
          blocked_records: applyResult.plan.blockedRecords,
          already_applied_records: applyResult.plan.alreadyAppliedRecords,
        }
        : null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to apply pool schedule run',
    });
  }
}

export default async function handler(req, res) {
  await handleAdminApplyPoolSchedule(req, res);
}
