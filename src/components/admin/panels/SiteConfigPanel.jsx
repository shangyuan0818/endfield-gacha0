import React, { useState, useEffect, useMemo } from 'react';
import { Save, X, Edit2, Settings, Globe, Scale, Link, FileText, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import useSiteConfigStore, {
  DEFAULT_HOME_NEXT_VERSION_TARGET_DATE,
  DEFAULT_HOME_VERSION_TIMELINE,
  HOME_NEXT_VERSION_TARGET_CONFIG_KEY,
  HOME_VERSION_TIMELINE_CONFIG_KEY,
} from '../../../stores/useSiteConfigStore';
import { loadAdminSiteConfigItems } from '../../../services/admin/siteConfigService.js';
import { ENTITY_LOCALIZATION_CONFIG_KEY, POOL_LOCALIZATION_CONFIG_KEY } from '../../../utils/gameDataI18n.js';
import {
  buildHomeVersionTimelineEditorPreview,
  createHomeVersionTimelineRows,
  serializeHomeVersionTimelineRows,
  validateHomeVersionTimelineRows,
} from '../../../utils/homeVersionTimelineEditor.js';
import VirtualizedList from '../VirtualizedList';

const CATEGORY_META = {
  legal: { label: '法律合规', icon: Scale, color: 'text-red-600 dark:text-red-400' },
  social: { label: '社交链接', icon: Link, color: 'text-blue-600 dark:text-blue-400' },
  content: { label: '运营内容', icon: FileText, color: 'text-amber-600 dark:text-amber-400' },
  alert: { label: '系统提醒', icon: AlertTriangle, color: 'text-orange-600 dark:text-orange-400' },
  general: { label: '通用配置', icon: Globe, color: 'text-zinc-600 dark:text-zinc-400' },
};

const VIRTUAL_CONFIG_ITEMS = [
  {
    key: POOL_LOCALIZATION_CONFIG_KEY,
    label: '卡池名称本地化',
    category: 'content',
    value: JSON.stringify({
      'pool-id-or-name': {
        'en-US': 'Banner Name',
      }
    }, null, 2),
    format: 'json',
    description: '按卡池 ID 或原始中文名维护手动本地化名称。角色名和武器名不在这里维护。'
  },
  {
    key: ENTITY_LOCALIZATION_CONFIG_KEY,
    label: '角色/武器名称本地化',
    category: 'content',
    value: JSON.stringify({
      'char_or_weapon_id': {
        type: 'character',
        name: '洛茜',
        'zh-CN': '洛茜',
        'en-US': 'Rossi'
      }
    }, null, 2),
    format: 'json',
    description: '用于覆盖 Warfarin 默认词条映射，优先按角色/武器 ID 生效。'
  },
  {
    key: HOME_VERSION_TIMELINE_CONFIG_KEY,
    label: '首页版本时间线',
    category: 'content',
    value: JSON.stringify(DEFAULT_HOME_VERSION_TIMELINE, null, 2),
    format: 'json',
    description: '维护首页下版本倒计时、版本名和后续版本节点。旧的单时间配置会作为兼容兜底。'
  },
  {
    key: HOME_NEXT_VERSION_TARGET_CONFIG_KEY,
    label: '首页下版本倒计时',
    category: 'content',
    value: DEFAULT_HOME_NEXT_VERSION_TARGET_DATE,
    format: 'text',
    description: '控制首页下版本倒计时目标时间，推荐使用带时区的 ISO 8601 时间字符串。'
  }
];

function isJsonConfigItem(item) {
  if (item?.format === 'json') {
    return true;
  }

  if (item?.format === 'text') {
    return false;
  }

  if (item?.key === HOME_NEXT_VERSION_TARGET_CONFIG_KEY) {
    return false;
  }

  return item?.category === 'content' || item?.category === 'alert';
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

function formatAdminDateTime(value) {
  if (!value) {
    return '未设置';
  }

  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) {
    return value;
  }

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

function HomeVersionTimelineEditor({ editValue, setEditValue, onSave, onCancel, saving }) {
  const initial = useMemo(() => createHomeVersionTimelineRows(editValue), [editValue]);
  const [rows, setRows] = useState(() => initial.rows);
  const parseError = initial.parseError;

  useEffect(() => {
    setEditValue(serializeHomeVersionTimelineRows(rows));
  }, [rows, setEditValue]);

  const validation = useMemo(() => validateHomeVersionTimelineRows(rows), [rows]);
  const preview = useMemo(() => {
    if (!validation.valid) {
      return null;
    }

    return buildHomeVersionTimelineEditorPreview(rows, {
      now: new Date(),
      locale: 'zh-CN',
    });
  }, [rows, validation.valid]);

  const updateRow = (index, patch) => {
    setRows(prev => prev.map((row, rowIndex) => (
      rowIndex === index ? { ...row, ...patch } : row
    )));
  };

  const addRow = () => {
    setRows(prev => [...prev, createEmptyVersionRow(prev.length)]);
  };

  const removeRow = (index) => {
    setRows(prev => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  return (
    <div className="space-y-3">
      <div className="rounded-none border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
        这里维护首页版本倒计时和版本节点。旧的“首页下版本倒计时”仍作为兼容兜底；保存本时间线后，首页会优先使用这里的版本数据。
      </div>

      {parseError ? (
        <div className="rounded-none border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-[11px] leading-relaxed text-red-700 dark:text-red-300">
          原始 JSON 解析失败，已载入默认版本节点。保存前请确认下方内容正确。
        </div>
      ) : null}

      <div className="space-y-3">
        {rows.map((row, index) => {
          const rowErrors = validation.rowErrors[index] || [];
          return (
            <div key={`version-row-${index}`} className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 px-3 py-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">版本节点 {index + 1}</span>
                <label className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={event => updateRow(index, { enabled: event.target.checked })}
                    className="h-3.5 w-3.5 rounded-none border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  启用
                </label>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  disabled={rows.length <= 1}
                  className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-30"
                  title="删除版本节点"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="grid gap-3 p-3 lg:grid-cols-2">
                <label className="space-y-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
                  版本 ID
                  <input
                    value={row.id}
                    onChange={event => updateRow(index, { id: event.target.value })}
                    className="w-full rounded-none border border-zinc-200 bg-white px-2 py-1.5 text-xs font-mono text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    placeholder="pre-summer-2026"
                  />
                </label>

                <label className="space-y-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
                  排序
                  <input
                    value={row.order}
                    onChange={event => updateRow(index, { order: event.target.value })}
                    className="w-full rounded-none border border-zinc-200 bg-white px-2 py-1.5 text-xs font-mono text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    placeholder="10"
                  />
                </label>

                <label className="space-y-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
                  中文版本名
                  <input
                    value={row.name}
                    onChange={event => updateRow(index, { name: event.target.value })}
                    className="w-full rounded-none border border-zinc-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    placeholder="寻遗散记"
                  />
                </label>

                <label className="space-y-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
                  英文版本名
                  <input
                    value={row.nameEn}
                    onChange={event => updateRow(index, { nameEn: event.target.value })}
                    className="w-full rounded-none border border-zinc-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    placeholder="Lost Heirlooms"
                  />
                </label>

                <label className="space-y-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
                  开始时间
                  <input
                    value={row.startsAt}
                    onChange={event => updateRow(index, { startsAt: event.target.value })}
                    className="w-full rounded-none border border-zinc-200 bg-white px-2 py-1.5 text-xs font-mono text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    placeholder="2026-06-05T12:00:00+08:00"
                  />
                </label>

                <label className="space-y-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
                  结束时间
                  <input
                    value={row.endsAt}
                    onChange={event => updateRow(index, { endsAt: event.target.value })}
                    className="w-full rounded-none border border-zinc-200 bg-white px-2 py-1.5 text-xs font-mono text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    placeholder="可留空"
                  />
                </label>

                <label className="space-y-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500 lg:col-span-2">
                  包含卡池 ID
                  <textarea
                    value={row.poolIdsText}
                    onChange={event => updateRow(index, { poolIdsText: event.target.value })}
                    rows={2}
                    className="w-full rounded-none border border-zinc-200 bg-white px-2 py-1.5 text-xs font-mono text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    placeholder="每行一个，或用逗号分隔"
                  />
                </label>
              </div>

              {rowErrors.length > 0 ? (
                <div className="border-t border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                  {rowErrors.join('；')}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-blue-500 dark:hover:text-blue-300"
      >
        <Plus size={14} />
        添加版本节点
      </button>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-3 py-2">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">首页预览</div>
          {preview ? (
            <div className="mt-2 space-y-1 text-xs text-slate-700 dark:text-zinc-300">
              <div>当前版本：{preview.currentVersion?.displayName || '无'}</div>
              <div>下个版本：{preview.nextVersion?.displayName || '无'}</div>
              <div>倒计时目标：{preview.countdownVersion?.displayName || '无'} / {formatAdminDateTime(preview.targetAt)}</div>
              <div>版本节点：{preview.versions.length} 个</div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-red-500">修复校验错误后才能生成预览。</div>
          )}
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-3 py-2">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">JSON 预览</div>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed text-slate-500 dark:text-zinc-500">
            {serializeHomeVersionTimelineRows(rows)}
          </pre>
        </div>
      </div>

      {!validation.valid ? (
        <div className="rounded-none border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-[11px] leading-relaxed text-red-700 dark:text-red-300">
          {validation.errors.join('；')}
        </div>
      ) : null}

      <div className="flex gap-2">
        <div className="flex-1" />
        <button
          onClick={onSave}
          disabled={saving || !validation.valid}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-none transition-colors disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? '...' : '保存'}
        </button>
        <button
          onClick={onCancel}
          className="px-2 py-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function EditableConfigItem({ item, isJsonField, editValue, setEditValue, onSave, onCancel, saving }) {
  const jsonError = useMemo(() => {
    if (!isJsonField) return null;
    try {
      JSON.parse(editValue);
      return null;
    } catch (e) {
      return e.message;
    }
  }, [isJsonField, editValue]);

  const formatJson = () => {
    try {
      setEditValue(JSON.stringify(JSON.parse(editValue), null, 2));
    } catch { /* ignore */ }
  };

  if (item.key === HOME_VERSION_TIMELINE_CONFIG_KEY) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <code className="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded font-mono">{item.key}</code>
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{item.label}</span>
        </div>
        <HomeVersionTimelineEditor
          editValue={editValue}
          setEditValue={setEditValue}
          onSave={onSave}
          onCancel={onCancel}
          saving={saving}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <code className="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded font-mono">{item.key}</code>
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{item.label}</span>
      </div>
      {isJsonField ? (
        <>
          <textarea
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            rows={Math.min(Math.max(editValue.split('\n').length, 4), 16)}
            className="w-full px-3 py-2 text-xs font-mono border border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Escape') onCancel();
            }}
          />
          {jsonError && (
            <p className="text-[11px] text-red-500 dark:text-red-400">JSON 格式错误：{jsonError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={formatJson}
              disabled={!!jsonError}
              className="text-[11px] px-2 py-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30"
            >
              格式化 JSON
            </button>
            <div className="flex-1" />
            <button
              onClick={onSave}
              disabled={saving || !!jsonError}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-none transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? '...' : '保存'}
            </button>
            <button
              onClick={onCancel}
              className="px-2 py-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') onSave();
              if (e.key === 'Escape') onCancel();
            }}
          />
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-none transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? '...' : '保存'}
          </button>
          <button
            onClick={onCancel}
            className="px-2 py-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 站点配置管理面板
 * 编辑备案号、作者信息、版本号等从数据库读取的站点配置
 */
const SiteConfigPanel = ({ showToast }) => {
  const [configItems, setConfigItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  // 从数据库加载完整配置（含 label, category）
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const data = await loadAdminSiteConfigItems();
        const mergedItems = [...data];
        VIRTUAL_CONFIG_ITEMS.forEach((virtualItem) => {
          if (!mergedItems.some((item) => item.key === virtualItem.key)) {
            mergedItems.push({
              ...virtualItem,
              updated_at: null,
            });
          }
        });
        setConfigItems(mergedItems);
      } catch (error) {
        showToast?.(`站点配置加载失败: ${error.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [showToast]);

  const startEdit = (item) => {
    setEditingKey(item.key);
    setEditValue(item.value);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const handleSave = async () => {
    if (!editingKey) return;
    setSaving(true);
    try {
      const currentItem = configItems.find((item) => item.key === editingKey);
      const success = await useSiteConfigStore.getState().updateConfig(editingKey, editValue, {
        label: currentItem?.label,
        category: currentItem?.category,
      });
      if (success) {
        setConfigItems(prev => prev.map(item =>
          item.key === editingKey ? { ...item, value: editValue, updated_at: new Date().toISOString() } : item
        ));
        showToast?.('配置已更新', 'success');
        cancelEdit();
      } else {
        const updateError = useSiteConfigStore.getState().updateError;
        showToast?.(`保存失败: ${updateError?.message || '请检查登录状态和超级管理员权限'}`, 'error');
      }
    } catch (error) {
      showToast?.(`保存失败: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-400 text-sm">
        <Settings size={16} className="animate-spin mr-2" />
        加载站点配置...
      </div>
    );
  }

  // 按 category 分组
  const grouped = {};
  configItems.forEach(item => {
    const cat = item.category || 'general';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  const categoryOrder = ['alert', 'content', 'legal', 'social', 'general'];

  const renderConfigItem = (item) => {
    const isJsonField = isJsonConfigItem(item);
    const isEditing = editingKey === item.key;

    return (
      <div key={item.key} className="px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
        {isEditing ? (
          <EditableConfigItem
            item={item}
            isJsonField={isJsonField}
            editValue={editValue}
            setEditValue={setEditValue}
            onSave={handleSave}
            onCancel={cancelEdit}
            saving={saving}
          />
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{item.label}</span>
                <code className="text-[10px] px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded font-mono">{item.key}</code>
              </div>
              {isJsonField ? (
                <>
                  <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono truncate max-w-full">
                    {item.value ? `JSON (${item.value.length} 字符)` : '(空)'}
                  </p>
                  {item.description ? (
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400 dark:text-zinc-500">
                      {item.description}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-slate-600 dark:text-zinc-400 truncate font-mono">{item.value || '(空)'}</p>
              )}
            </div>
            <button
              onClick={() => startEdit(item)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded shrink-0"
              title="编辑"
              aria-label={`编辑${item.label}`}
            >
              <Edit2 size={14} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500 dark:text-zinc-500">
        管理站点显示的备案号、作者信息、版本号等配置。修改后即时生效。
      </p>

      {categoryOrder.map(cat => {
        const items = grouped[cat];
        if (!items || items.length === 0) return null;
        const meta = CATEGORY_META[cat] || CATEGORY_META.general;
        const Icon = meta.icon;

        return (
          <div key={cat} className="border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {/* 分组标题 */}
            <div className="px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
              <Icon size={14} className={meta.color} />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                {meta.label}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono ml-auto">{items.length} 项</span>
            </div>

            {/* 配置项列表 */}
            {items.some(item => item.key === editingKey) ? (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.map(renderConfigItem)}
              </div>
            ) : (
              <VirtualizedList
                items={items}
                getKey={(item) => item.key}
                itemHeight={118}
                maxHeight={520}
                className="divide-y divide-zinc-100 dark:divide-zinc-800"
                renderItem={renderConfigItem}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SiteConfigPanel;
