import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Clock, GripVertical, Plus, Save, Trash2, X } from 'lucide-react';
import useSiteConfigStore, {
  DEFAULT_HOME_NEXT_VERSION_TARGET_DATE,
  DEFAULT_HOME_VERSION_TIMELINE,
  HOME_VERSION_TIMELINE_CONFIG_KEY,
} from '../../stores/useSiteConfigStore.js';
import { loadAdminSiteConfigItems } from '../../services/admin/siteConfigService.js';
import {
  applyHomeVersionDurationToEndAt,
  buildHomeVersionTimelinePoolPreview,
  buildHomeVersionTimelineEditorPreview,
  createHomeVersionTimelineRows,
  inferHomeVersionTimeRangeFromPools,
  parseHomeVersionPoolIdsText,
  serializeHomeVersionTimelineRows,
  validateHomeVersionTimelineRows,
} from '../../utils/homeVersionTimelineEditor.js';

function normalizeText(value) {
  return String(value || '').trim();
}

function getPoolId(pool) {
  return normalizeText(pool?.pool_id || pool?.id || pool?.poolId);
}

function getPoolTypeLabel(type) {
  if (type === 'extra') return '附加寻访';
  if (type === 'weapon' || type === 'limited_weapon') return '武器池';
  if (type === 'standard') return '常驻池';
  return '角色池';
}

function getPoolGroup(pool) {
  const poolId = getPoolId(pool).toLowerCase();
  const type = normalizeText(pool?.type || pool?.pool_type).toLowerCase();

  if (
    type === 'limited'
    || type === 'limited_character'
    || poolId.startsWith('special_')
    || poolId.includes('limited_pool')
  ) {
    return 'limited';
  }

  if (
    type === 'extra'
    || type === 'weapon'
    || type === 'limited_weapon'
    || poolId.startsWith('extra_')
    || poolId.startsWith('joint_')
    || poolId.startsWith('weapon')
    || poolId.startsWith('wepon')
  ) {
    return 'special';
  }

  return 'other';
}

function getPoolGroupLabel(group) {
  if (group === 'limited') return '限定池';
  if (group === 'special') return '特殊池 / 武器池';
  return '其他卡池';
}

function formatAdminDateTime(value) {
  if (!value) return '未设置';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value;

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(new Date(time));
}

function formatAdminShortDateTime(value) {
  if (!value) return '未设置';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value;

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(new Date(time));
}

function createEmptyVersionRow(index) {
  return {
    id: `version-${index + 1}`,
    name: '',
    nameEn: '',
    startsAt: DEFAULT_HOME_NEXT_VERSION_TARGET_DATE,
    endsAt: '',
    enabled: true,
    order: String((index + 1) * 10),
    poolIdsText: '',
  };
}

function sortPoolsForPicker(pools = []) {
  return [...pools]
    .filter((pool) => getPoolId(pool))
    .sort((left, right) => {
      const leftTime = new Date(left?.start_time || left?.startDate || 0).getTime();
      const rightTime = new Date(right?.start_time || right?.startDate || 0).getTime();
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      return normalizeText(left?.name).localeCompare(normalizeText(right?.name), 'zh-CN');
    });
}

function buildPoolSummary(row, poolById) {
  const ids = parseHomeVersionPoolIdsText(row.poolIdsText);
  const known = ids.map((id) => poolById.get(id)).filter(Boolean);
  const missing = ids.filter((id) => !poolById.has(id));
  return { ids, known, missing };
}

export default function HomeVersionTimelineManager({ pools = [], showToast }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState(() => createHomeVersionTimelineRows(DEFAULT_HOME_VERSION_TIMELINE).rows);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [parseError, setParseError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadTimeline() {
      setLoading(true);
      try {
        const items = await loadAdminSiteConfigItems();
        const item = items.find((entry) => entry.key === HOME_VERSION_TIMELINE_CONFIG_KEY);
        const parsed = createHomeVersionTimelineRows(item?.value || JSON.stringify({ versions: DEFAULT_HOME_VERSION_TIMELINE }));
        if (!mounted) return;
        setRows(parsed.rows);
        setParseError(parsed.parseError);
      } catch (error) {
        if (!mounted) return;
        showToast?.(`版本时间线加载失败: ${error.message}`, 'error');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadTimeline();
    return () => {
      mounted = false;
    };
  }, [showToast]);

  const poolById = useMemo(() => new Map(sortPoolsForPicker(pools).map((pool) => [getPoolId(pool), pool])), [pools]);
  const sortedPools = useMemo(() => sortPoolsForPicker(pools), [pools]);
  const assignedPoolIds = useMemo(() => new Set(
    rows.flatMap((row) => parseHomeVersionPoolIdsText(row.poolIdsText))
  ), [rows]);
  const activeIndex = Math.min(Math.max(activeRowIndex, 0), Math.max(rows.length - 1, 0));
  const activeRow = rows[activeIndex] || null;
  const activeSummary = activeRow ? buildPoolSummary(activeRow, poolById) : { ids: [], known: [], missing: [] };
  const validation = useMemo(() => validateHomeVersionTimelineRows(rows), [rows]);
  const preview = useMemo(() => (
    validation.valid
      ? buildHomeVersionTimelineEditorPreview(rows, { now: new Date(), locale: 'zh-CN' })
      : null
  ), [rows, validation.valid]);
  const poolPreviewSections = useMemo(() => (
    validation.valid
      ? buildHomeVersionTimelinePoolPreview(rows, pools, { now: new Date(), locale: 'zh-CN' })
      : []
  ), [pools, rows, validation.valid]);
  const poolGroups = useMemo(() => {
    const groups = new Map([
      ['limited', []],
      ['special', []],
      ['other', []],
    ]);

    sortedPools.forEach((pool) => {
      groups.get(getPoolGroup(pool))?.push(pool);
    });

    return Array.from(groups.entries())
      .map(([group, groupPools]) => ({
        group,
        label: getPoolGroupLabel(group),
        pools: groupPools,
      }))
      .filter((section) => section.pools.length > 0);
  }, [sortedPools]);

  useEffect(() => {
    if (activeRowIndex > rows.length - 1) {
      setActiveRowIndex(Math.max(rows.length - 1, 0));
    }
  }, [activeRowIndex, rows.length]);

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, rowIndex) => (
      rowIndex === index ? { ...row, ...patch } : row
    )));
  };

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyVersionRow(prev.length)]);
    setActiveRowIndex(rows.length);
  };

  const removeRow = (index) => {
    setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
    setActiveRowIndex((prev) => Math.max(0, Math.min(prev, rows.length - 2)));
  };

  const setRowPoolIds = (index, poolIds) => {
    updateRow(index, { poolIdsText: [...new Set(poolIds.map(normalizeText).filter(Boolean))].join('\n') });
  };

  const addPoolToRow = (index, poolId) => {
    const row = rows[index];
    const normalizedPoolId = normalizeText(poolId);
    if (!row || !normalizedPoolId) return;

    const nextPoolIds = parseHomeVersionPoolIdsText(row.poolIdsText);
    if (!nextPoolIds.includes(normalizedPoolId)) {
      setRowPoolIds(index, [...nextPoolIds, normalizedPoolId]);
    }
    setActiveRowIndex(index);
  };

  const removePoolFromRow = (index, poolId) => {
    const row = rows[index];
    if (!row) return;
    setRowPoolIds(index, parseHomeVersionPoolIdsText(row.poolIdsText).filter((id) => id !== poolId));
  };

  const handlePoolDragStart = (event, poolId) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', poolId);
    event.dataTransfer.setData('application/x-endfield-pool-id', poolId);
  };

  const handleVersionDrop = (event, index) => {
    event.preventDefault();
    const poolId = event.dataTransfer.getData('application/x-endfield-pool-id')
      || event.dataTransfer.getData('text/plain');
    addPoolToRow(index, poolId);
  };

  const applySelectedPoolTimeRange = (index) => {
    const inferred = inferHomeVersionTimeRangeFromPools(rows[index], pools);
    if (!inferred) {
      showToast?.('未能从已选择卡池中读取有效时间', 'warning');
      return;
    }

    updateRow(index, {
      startsAt: inferred.startsAt,
      endsAt: inferred.endsAt,
      durationDays: inferred.durationDays,
    });
    showToast?.(`已根据 ${inferred.matchedCount} 个卡池更新时间范围`, 'success');
  };

  const applyDurationEndAt = (index) => {
    const endsAt = applyHomeVersionDurationToEndAt(rows[index]);
    if (!endsAt) {
      showToast?.('请先填写有效开始时间和持续天数', 'warning');
      return;
    }

    updateRow(index, { endsAt });
    showToast?.('已按持续天数填入结束时间', 'success');
  };

  const save = async () => {
    if (!validation.valid) return;

    setSaving(true);
    try {
      const serialized = serializeHomeVersionTimelineRows(rows);
      const success = await useSiteConfigStore.getState().updateConfig(HOME_VERSION_TIMELINE_CONFIG_KEY, serialized, {
        label: '首页版本时间线',
        category: 'content',
      });
      if (!success) {
        const updateError = useSiteConfigStore.getState().updateError;
        showToast?.(`版本时间线保存失败: ${updateError?.message || '请检查登录状态和超级管理员权限'}`, 'error');
        return;
      }
      showToast?.('版本时间线已保存', 'success');
    } catch (error) {
      showToast?.(`版本时间线保存失败: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-zinc-400">
        <CalendarDays size={16} className="mr-2 animate-spin" />
        加载版本时间线...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-200">
        这里维护首页轮换计划和下版本倒计时使用的版本时间线。每个版本可以绑定多个卡池；首页会按版本分段展示，并优先用这里的下一版本节点生成倒计时。
      </div>

      {parseError ? (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          原始版本时间线 JSON 解析失败，当前已载入默认节点。保存前请重新检查内容。
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-500">当前版本</div>
          <div className="mt-1 text-sm font-bold text-slate-900 dark:text-zinc-100">{preview?.currentVersion?.displayName || '无'}</div>
        </div>
        <div className="border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-500">下个版本</div>
          <div className="mt-1 text-sm font-bold text-slate-900 dark:text-zinc-100">{preview?.nextVersion?.displayName || '无'}</div>
        </div>
        <div className="border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-500">倒计时目标</div>
          <div className="mt-1 text-sm font-bold text-slate-900 dark:text-zinc-100">{formatAdminDateTime(preview?.targetAt)}</div>
        </div>
      </div>

      <section className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-800 dark:text-zinc-100">版本时间轴</div>
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-zinc-500">
              选择版本节点，或把下方卡池拖到对应版本。
            </div>
          </div>
          <button
            type="button"
            onClick={addRow}
            className="ml-auto inline-flex items-center gap-1.5 border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-blue-500 dark:hover:text-blue-300"
          >
            <Plus size={14} />
            添加版本节点
          </button>
        </div>

        <div className="pool-card-rail-scrollbar flex gap-3 overflow-x-auto overflow-y-hidden px-4 py-4">
          {rows.map((row, index) => {
            const rowErrors = validation.rowErrors[index] || [];
            const summary = buildPoolSummary(row, poolById);
            const selected = index === activeIndex;
            return (
              <button
                type="button"
                key={`version-timeline-${row.id || index}`}
                onClick={() => setActiveRowIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleVersionDrop(event, index)}
                className={`min-h-[132px] w-[260px] shrink-0 border p-3 text-left transition-colors ${
                  selected
                    ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500/40 dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-100'
                    : 'border-zinc-200 bg-zinc-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/20'
                } ${row.enabled ? '' : 'opacity-55'}`}
                aria-label={`版本节点 ${index + 1}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                      节点 {index + 1}
                    </div>
                    <div className="mt-1 truncate text-sm font-bold">{row.name || '未命名版本'}</div>
                  </div>
                  {rowErrors.length > 0 ? (
                    <span className="shrink-0 border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                      待修正
                    </span>
                  ) : row.enabled ? (
                    <span className="shrink-0 border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                      启用
                    </span>
                  ) : (
                    <span className="shrink-0 border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
                      停用
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
                  <Clock size={12} />
                  <span>{formatAdminShortDateTime(row.startsAt)}</span>
                  <span className="text-slate-300 dark:text-zinc-700">-</span>
                  <span>{row.endsAt ? formatAdminShortDateTime(row.endsAt) : `${row.durationDays || '?'} 天`}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {summary.known.slice(0, 3).map((pool) => (
                    <span key={getPoolId(pool)} className="max-w-full truncate border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                      {pool.name || getPoolId(pool)}
                    </span>
                  ))}
                  {summary.known.length > 3 ? (
                    <span className="border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-500">
                      +{summary.known.length - 3}
                    </span>
                  ) : null}
                  {summary.known.length === 0 ? (
                    <span className="border border-dashed border-zinc-300 px-1.5 py-0.5 text-[10px] text-slate-400 dark:border-zinc-700 dark:text-zinc-500">
                      拖入卡池
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {activeRow ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
          <div className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-800 dark:text-zinc-100">版本节点 {activeIndex + 1}</div>
                <div className="mt-0.5 text-[11px] text-slate-400 dark:text-zinc-500">
                  已选择 {activeSummary.known.length} 个卡池{activeSummary.missing.length > 0 ? `，${activeSummary.missing.length} 个暂未匹配` : ''}
                </div>
              </div>
              <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={activeRow.enabled}
                  onChange={(event) => updateRow(activeIndex, { enabled: event.target.checked })}
                  className="h-4 w-4 rounded-none border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                启用
              </label>
              <button
                type="button"
                onClick={() => removeRow(activeIndex)}
                disabled={rows.length <= 1}
                className="p-1.5 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/30"
                title="删除版本节点"
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div className="grid gap-3 p-4 md:grid-cols-2">
              <label className="space-y-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
                中文版本名
                <input
                  value={activeRow.name}
                  onChange={(event) => updateRow(activeIndex, { name: event.target.value })}
                  className="w-full rounded-none border border-zinc-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                />
              </label>
              <label className="space-y-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
                英文版本名
                <input
                  value={activeRow.nameEn}
                  onChange={(event) => updateRow(activeIndex, { nameEn: event.target.value })}
                  className="w-full rounded-none border border-zinc-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                />
              </label>
              <label className="space-y-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
                开始时间
                <input
                  value={activeRow.startsAt}
                  onChange={(event) => updateRow(activeIndex, { startsAt: event.target.value })}
                  className="w-full rounded-none border border-zinc-200 bg-white px-2 py-1.5 text-xs font-mono text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                />
              </label>
              <label className="space-y-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
                <span className="flex items-center justify-between gap-2">
                  结束时间
                  <button
                    type="button"
                    aria-label="按已选卡池时间填入"
                    onClick={() => applySelectedPoolTimeRange(activeIndex)}
                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                  >
                    按已选卡池时间填入
                  </button>
                </span>
                <input
                  value={activeRow.endsAt}
                  onChange={(event) => updateRow(activeIndex, { endsAt: event.target.value })}
                  className="w-full rounded-none border border-zinc-200 bg-white px-2 py-1.5 text-xs font-mono text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                  placeholder="可留空"
                />
              </label>
              <label className="space-y-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
                <span className="flex items-center justify-between gap-2">
                  持续天数
                  <button
                    type="button"
                    aria-label="按持续天数填入结束时间"
                    onClick={() => applyDurationEndAt(activeIndex)}
                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                  >
                    填入结束时间
                  </button>
                </span>
                <input
                  value={activeRow.durationDays || ''}
                  onChange={(event) => updateRow(activeIndex, { durationDays: event.target.value })}
                  className="w-full rounded-none border border-zinc-200 bg-white px-2 py-1.5 text-xs font-mono text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                  placeholder="例如 21"
                />
              </label>
              <label className="space-y-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
                排序
                <input
                  value={activeRow.order}
                  onChange={(event) => updateRow(activeIndex, { order: event.target.value })}
                  className="w-full rounded-none border border-zinc-200 bg-white px-2 py-1.5 text-xs font-mono text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                />
              </label>
              <label className="space-y-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500 md:col-span-2">
                版本 ID
                <input
                  value={activeRow.id}
                  onChange={(event) => updateRow(activeIndex, { id: event.target.value })}
                  className="w-full rounded-none border border-zinc-200 bg-white px-2 py-1.5 text-xs font-mono text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                />
              </label>
            </div>

            <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
              <div className="mb-2 text-[11px] font-semibold text-slate-500 dark:text-zinc-500">已放入该版本的卡池</div>
              <div
                className="min-h-20 border border-dashed border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/40"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleVersionDrop(event, activeIndex)}
              >
                {activeSummary.known.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeSummary.known.map((pool) => {
                      const poolId = getPoolId(pool);
                      return (
                        <span key={poolId} className="inline-flex max-w-full items-center gap-2 border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-200">
                          <span className="min-w-0 truncate">{pool.name || poolId}</span>
                          <button
                            type="button"
                            onClick={() => removePoolFromRow(activeIndex, poolId)}
                            className="shrink-0 text-blue-500 hover:text-red-500 dark:text-blue-300 dark:hover:text-red-300"
                            aria-label={`从版本移除 ${pool.name || poolId}`}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-14 items-center justify-center text-xs text-slate-400 dark:text-zinc-500">
                    从下方拖入限定池或特殊池
                  </div>
                )}
              </div>
              {activeSummary.missing.length > 0 ? (
                <div className="mt-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                  暂未匹配：{activeSummary.missing.join('、')}
                </div>
              ) : null}
            </div>

            {(validation.rowErrors[activeIndex] || []).length > 0 ? (
              <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                {validation.rowErrors[activeIndex].join('；')}
              </div>
            ) : null}
          </div>

          <div className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <div className="text-sm font-bold text-slate-800 dark:text-zinc-100">可分配卡池</div>
              <div className="mt-0.5 text-[11px] text-slate-400 dark:text-zinc-500">
                拖到上方时间轴，或点击加入当前选中版本。
              </div>
            </div>
            {poolGroups.length > 0 ? (
              <div className="max-h-[560px] space-y-4 overflow-auto p-4">
                {poolGroups.map((section) => (
                  <div key={section.group} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-500">{section.label}</div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-600">{section.pools.length} 个</div>
                    </div>
                    <div className="space-y-1.5">
                      {section.pools.map((pool) => {
                        const poolId = getPoolId(pool);
                        const assigned = assignedPoolIds.has(poolId);
                        return (
                          <button
                            type="button"
                            key={poolId}
                            draggable
                            onDragStart={(event) => handlePoolDragStart(event, poolId)}
                            onClick={() => addPoolToRow(activeIndex, poolId)}
                            className={`flex w-full items-center gap-2 border px-3 py-2 text-left text-xs transition-colors ${
                              assigned
                                ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-200'
                                : 'border-zinc-200 bg-zinc-50 text-slate-600 hover:border-blue-300 hover:bg-blue-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:border-blue-800 dark:hover:bg-blue-950/20'
                            }`}
                          >
                            <GripVertical size={14} className="shrink-0 text-slate-300 dark:text-zinc-600" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{pool.name || poolId}</span>
                              <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-400 dark:text-zinc-500">
                                {poolId} · {getPoolTypeLabel(pool.type)} · {formatAdminShortDateTime(pool.start_time || pool.startDate)}
                              </span>
                            </span>
                            {assigned ? <Check size={14} className="shrink-0 text-blue-500" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-xs text-slate-500 dark:text-zinc-500">
                当前没有可选择的卡池。请先同步或新增卡池。
              </div>
            )}
          </div>
        </section>
      ) : null}

      <div className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div className="text-sm font-bold text-slate-800 dark:text-zinc-100">首页轮换预览</div>
          <div className="mt-0.5 text-[11px] text-slate-400 dark:text-zinc-500">
            按当前版本节点和已选择卡池生成。这里的折叠结果应与首页轮换计划一致。
          </div>
        </div>
        {poolPreviewSections.length > 0 ? (
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {poolPreviewSections.map((section) => (
              <div key={section.id} className="border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-slate-800 dark:text-zinc-100">{section.name}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400 dark:text-zinc-500">
                      {section.pools.length} 个展示卡池{section.hiddenExtraCount > 0 ? `，折叠 ${section.hiddenExtraCount} 个过期附加池` : ''}
                    </div>
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  {section.pools.map((pool) => (
                    <div key={`${section.id}-${pool.id || pool.name}`} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="min-w-0 truncate font-medium text-slate-600 dark:text-zinc-300">{pool.displayName || pool.name || pool.id}</span>
                      <span className="shrink-0 text-slate-400 dark:text-zinc-500">{getPoolTypeLabel(pool.poolType || pool.poolData?.type)}</span>
                      {Array.isArray(pool.foldedExtraPools) && pool.foldedExtraPools.length > 0 ? (
                        <span className="shrink-0 text-cyan-600 dark:text-cyan-300">
                          合并 {pool.foldedExtraPools.length}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-5 text-xs text-slate-500 dark:text-zinc-500">
            暂无可预览卡池。请在版本节点中选择卡池，或先同步 / 新增卡池。
          </div>
        )}
      </div>

      {!validation.valid ? (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          {validation.errors.join('；')}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-blue-500 dark:hover:text-blue-300"
        >
          <Plus size={14} />
          添加版本节点
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={save}
          disabled={saving || !validation.valid}
          className="inline-flex items-center gap-1.5 bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? '保存中...' : '保存版本时间线'}
        </button>
      </div>
    </div>
  );
}
