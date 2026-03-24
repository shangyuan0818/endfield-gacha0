import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function normalizeObject(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeObject);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = normalizeObject(value[key]);
        return result;
      }, {});
  }

  return value;
}

function stableStringify(value) {
  return JSON.stringify(normalizeObject(value));
}

function normalizeCompareValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeCompareValue);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = normalizeCompareValue(value[key]);
        return result;
      }, {});
  }

  return value ?? null;
}

function ensureArrayPayload(payload, label) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object' && Array.isArray(payload.records)) {
    return payload.records;
  }

  throw new Error(`${label} 必须是 JSON 数组，或包含 records 数组的对象`);
}

function getRecordKey(record, job) {
  if (typeof job.recordKey === 'function') {
    const customKeyValue = job.recordKey(record, job);
    const normalizedCustomKey = customKeyValue === undefined || customKeyValue === null
      ? ''
      : String(customKeyValue).trim();

    if (normalizedCustomKey) {
      return normalizedCustomKey;
    }
  }

  const keyValue = record?.[job.keyField];
  if (keyValue === undefined || keyValue === null || keyValue === '') {
    throw new Error(`[${job.id}] 记录缺少主键字段 "${job.keyField}"`);
  }

  return String(keyValue);
}

function pickFields(record, fields) {
  return fields.reduce((result, field) => {
    result[field] = normalizeCompareValue(record?.[field]);
    return result;
  }, {});
}

export async function readJsonFile(filePath, label) {
  const text = await readFile(filePath, 'utf8');

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} JSON 解析失败: ${error.message}`);
  }
}

export async function loadJobRecords(filePath, label) {
  const payload = await readJsonFile(filePath, label);
  return ensureArrayPayload(payload, label);
}

export function computeAutomationDiff(job, currentRecords, incomingRecords) {
  const allowRemovalPreview = job.allowRemovalPreview !== false;
  const currentMap = new Map();
  const incomingMap = new Map();

  currentRecords.forEach((record) => {
    currentMap.set(getRecordKey(record, job), record);
  });

  incomingRecords.forEach((record) => {
    incomingMap.set(getRecordKey(record, job), record);
  });

  const added = [];
  const updated = [];
  const unchanged = [];
  const removed = [];
  const changedFieldCounts = new Map();

  incomingMap.forEach((incomingRecord, key) => {
    const currentRecord = currentMap.get(key);

    if (!currentRecord) {
      added.push({
        key,
        next: pickFields(incomingRecord, job.previewFields),
      });
      return;
    }

    const changedFields = job.compareFields.filter((field) => (
      stableStringify(normalizeCompareValue(currentRecord?.[field]))
      !== stableStringify(normalizeCompareValue(incomingRecord?.[field]))
    ));

    if (changedFields.length === 0) {
      unchanged.push({ key });
      return;
    }

    changedFields.forEach((field) => {
      changedFieldCounts.set(field, (changedFieldCounts.get(field) || 0) + 1);
    });

    updated.push({
      key,
      changedFields,
      current: pickFields(currentRecord, job.previewFields),
      next: pickFields(incomingRecord, job.previewFields),
    });
  });

  if (allowRemovalPreview) {
    currentMap.forEach((currentRecord, key) => {
      if (!incomingMap.has(key)) {
        removed.push({
          key,
          current: pickFields(currentRecord, job.previewFields),
        });
      }
    });
  }

  const topChangedFields = Array.from(changedFieldCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-CN'))
    .map(([field, count]) => ({ field, count }));

  return {
    added,
    updated,
    unchanged,
    removed,
    counts: {
      current: currentRecords.length,
      incoming: incomingRecords.length,
      added: added.length,
      updated: updated.length,
      unchanged: unchanged.length,
      removed: removed.length,
    },
    topChangedFields,
  };
}

export function buildAutomationAuditReport({
  job,
  currentRecords,
  incomingRecords,
  dryRun = true,
  sourceMeta = {},
} = {}) {
  const diff = computeAutomationDiff(job, currentRecords, incomingRecords);
  const generatedAt = new Date().toISOString();

  return {
    job: {
      id: job.id,
      label: job.label,
      entityLabel: job.entityLabel,
      sourceLabel: job.sourceLabel,
      publishStrategy: job.publishStrategy,
      allowRemovalPreview: job.allowRemovalPreview !== false,
    },
    generatedAt,
    dryRun,
    sourceMeta,
    summary: diff.counts,
    topChangedFields: diff.topChangedFields,
    preview: {
      added: diff.added.slice(0, 10),
      updated: diff.updated.slice(0, 10),
      removed: diff.removed.slice(0, 10),
    },
  };
}

export function buildManualReviewBundle({
  job,
  currentRecords,
  incomingRecords,
  dryRun = true,
  sourceMeta = {},
} = {}) {
  const audit = buildAutomationAuditReport({
    job,
    currentRecords,
    incomingRecords,
    dryRun,
    sourceMeta,
  });

  return {
    ...audit,
    review: {
      status: 'pending_manual_review',
      requiresApproval: true,
      approvalMode: job.publishStrategy,
    },
    snapshots: {
      current: currentRecords,
      incoming: incomingRecords,
    },
  };
}

export function formatAutomationAuditReport(report) {
  const { job, summary, topChangedFields, preview, dryRun, generatedAt } = report;
  const allowRemovalPreview = job.allowRemovalPreview !== false;
  const lines = [
    `# ${job.label}`,
    `任务ID: ${job.id}`,
    `实体: ${job.entityLabel}`,
    `来源: ${job.sourceLabel}`,
    `模式: ${dryRun ? 'dry-run' : 'apply'}`,
    `发布时间策略: ${job.publishStrategy}`,
    `生成时间: ${generatedAt}`,
    `当前记录: ${summary.current}`,
    `输入记录: ${summary.incoming}`,
    `新增: ${summary.added}`,
    `更新: ${summary.updated}`,
    `删除: ${allowRemovalPreview ? summary.removed : '未启用（当前源非权威全量镜像）'}`,
    `未变化: ${summary.unchanged}`,
  ];

  if (topChangedFields.length > 0) {
    lines.push('', '字段变化统计:');
    topChangedFields.forEach((item) => {
      lines.push(`- ${item.field}: ${item.count}`);
    });
  }

  if (preview.added.length > 0) {
    lines.push('', '新增预览:');
    preview.added.forEach((item) => {
      lines.push(`- ${item.key}: ${JSON.stringify(item.next)}`);
    });
  }

  if (preview.updated.length > 0) {
    lines.push('', '更新预览:');
    preview.updated.forEach((item) => {
      lines.push(`- ${item.key}: [${item.changedFields.join(', ')}]`);
    });
  }

  if (allowRemovalPreview && preview.removed.length > 0) {
    lines.push('', '删除预览:');
    preview.removed.forEach((item) => {
      lines.push(`- ${item.key}: ${JSON.stringify(item.current)}`);
    });
  }

  if (summary.added === 0 && summary.updated === 0 && (!allowRemovalPreview || summary.removed === 0)) {
    lines.push('', '无差异。');
  }

  return lines.join('\n');
}

export async function writeJsonArtifact(filePath, payload) {
  const targetDir = path.dirname(filePath);
  await mkdir(targetDir, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export function parseAutomationCliArgs(argv) {
  const args = {
    dryRun: true,
    list: false,
    sourceMeta: {},
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    switch (token) {
      case '--list':
        args.list = true;
        break;
      case '--job':
        args.jobId = argv[++index];
        break;
      case '--current':
        args.currentPath = argv[++index];
        break;
      case '--incoming':
        args.incomingPath = argv[++index];
        break;
      case '--write-json':
        args.writeJsonPath = argv[++index];
        break;
      case '--write-bundle':
        args.writeBundlePath = argv[++index];
        break;
      case '--source-tag':
        args.sourceMeta.tag = argv[++index];
        break;
      case '--source-url':
        args.sourceMeta.url = argv[++index];
        break;
      case '--apply':
        args.dryRun = false;
        break;
      default:
        throw new Error(`未知参数: ${token}`);
    }
  }

  return args;
}
