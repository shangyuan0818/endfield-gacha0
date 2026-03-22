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

function normalizeIncomingAnnouncementRecord(record) {
  return {
    source_id: normalizeText(record?.source_id || record?.id),
    title: normalizeText(record?.title),
    summary: normalizeText(record?.summary) || null,
    content: normalizeText(record?.content),
    version: normalizeText(record?.version) || 'external',
    published_at: normalizeText(record?.published_at) || null,
    source_url: normalizeText(record?.source_url) || null,
    is_active: record?.is_active !== false,
  };
}

function normalizeAppliedSourceIds(reviewBundle) {
  return normalizeStringArray(reviewBundle?.review?.appliedSourceIds);
}

export function buildOfficialAnnouncementApplyPlan(reviewBundle, {
  selectedSourceIds = [],
} = {}) {
  const incomingRecords = Array.isArray(reviewBundle?.snapshots?.incoming)
    ? reviewBundle.snapshots.incoming
    : [];
  const selectedIdSet = new Set(normalizeStringArray(selectedSourceIds));
  const previouslyAppliedSet = new Set(normalizeAppliedSourceIds(reviewBundle));
  const availableSourceIds = incomingRecords
    .map(record => normalizeText(record?.source_id || record?.id))
    .filter(Boolean);
  const requestedRecords = selectedIdSet.size > 0
    ? incomingRecords.filter(record => selectedIdSet.has(normalizeText(record?.source_id || record?.id)))
    : incomingRecords;
  const missingRequestedSourceIds = selectedIdSet.size > 0
    ? Array.from(selectedIdSet).filter(sourceId => !availableSourceIds.includes(sourceId))
    : [];

  const applicableRecords = [];
  const blockedRecords = [];
  const alreadyAppliedRecords = [];

  requestedRecords.forEach((rawRecord) => {
    const record = normalizeIncomingAnnouncementRecord(rawRecord);
    const issues = [];

    if (!record.source_id) {
      issues.push({
        code: 'missing_source_id',
        message: '缺少 source_id，无法发布',
      });
    }

    if (!record.title) {
      issues.push({
        code: 'missing_title',
        message: '缺少公告标题，无法发布',
      });
    }

    if (!record.content) {
      issues.push({
        code: 'missing_content',
        message: '缺少公告正文，无法发布',
      });
    }

    if (record.source_id && previouslyAppliedSet.has(record.source_id)) {
      alreadyAppliedRecords.push({
        source_id: record.source_id,
        title: record.title,
      });
      return;
    }

    if (issues.length > 0) {
      blockedRecords.push({
        source_id: record.source_id,
        title: record.title,
        issues,
      });
      return;
    }

    applicableRecords.push(record);
  });

  const requestedSourceIds = requestedRecords
    .map(record => normalizeText(record?.source_id || record?.id))
    .filter(Boolean);

  return {
    requestedSourceIds,
    availableSourceIds,
    missingRequestedSourceIds,
    applicableSourceIds: applicableRecords.map(record => record.source_id),
    blockedSourceIds: blockedRecords.map(record => record.source_id).filter(Boolean),
    alreadyAppliedSourceIds: alreadyAppliedRecords.map(record => record.source_id).filter(Boolean),
    applicableRecords,
    blockedRecords,
    alreadyAppliedRecords,
    summary: {
      available: availableSourceIds.length,
      requested: requestedSourceIds.length,
      applicable: applicableRecords.length,
      blocked: blockedRecords.length,
      alreadyApplied: alreadyAppliedRecords.length,
      missingRequested: missingRequestedSourceIds.length,
    },
  };
}

export function buildUpdatedOfficialAnnouncementReviewBundle(reviewBundle, {
  appliedSourceIds = [],
  blockedSourceIds = [],
  actorUserId = null,
  attemptedAt = new Date().toISOString(),
  note = null,
  status = 'pending_manual_review',
  error = null,
} = {}) {
  const previousReview = reviewBundle?.review && typeof reviewBundle.review === 'object'
    ? reviewBundle.review
    : {};
  const nextAppliedSourceIds = Array.from(new Set([
    ...normalizeAppliedSourceIds(reviewBundle),
    ...normalizeStringArray(appliedSourceIds),
  ]));

  return {
    ...reviewBundle,
    review: {
      ...previousReview,
      status,
      requiresApproval: status !== 'applied',
      appliedSourceIds: nextAppliedSourceIds,
      blockedSourceIds: normalizeStringArray(blockedSourceIds),
      lastAttemptedAt: attemptedAt,
      lastAttemptedBy: actorUserId,
      lastAppliedAt: appliedSourceIds.length > 0
        ? attemptedAt
        : (previousReview.lastAppliedAt || null),
      lastAppliedBy: appliedSourceIds.length > 0
        ? actorUserId
        : (previousReview.lastAppliedBy || null),
      note: normalizeText(note) || previousReview.note || null,
      lastError: normalizeText(error) || null,
    },
  };
}
