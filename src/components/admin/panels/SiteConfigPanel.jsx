import React, { useState, useEffect, useMemo } from 'react';
import { Save, X, Edit2, Settings, Globe, Scale, Link, FileText, AlertTriangle } from 'lucide-react';
import useSiteConfigStore, {
  DEFAULT_HOME_NEXT_VERSION_TARGET_DATE,
  HOME_NEXT_VERSION_TARGET_CONFIG_KEY
} from '../../../stores/useSiteConfigStore';
import { supabase } from '../../../supabaseClient';
import { ENTITY_LOCALIZATION_CONFIG_KEY, POOL_LOCALIZATION_CONFIG_KEY } from '../../../utils/gameDataI18n.js';
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
    description: '用于覆盖 Warfarin 默认词条映射，优先按角色/武器 ID 生效。'
  },
  {
    key: HOME_NEXT_VERSION_TARGET_CONFIG_KEY,
    label: '首页下版本倒计时',
    category: 'content',
    value: DEFAULT_HOME_NEXT_VERSION_TARGET_DATE,
    description: '控制首页下版本倒计时目标时间，推荐使用带时区的 ISO 8601 时间字符串。'
  }
];

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
      if (!supabase) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('site_config')
          .select('*')
          .order('category', { ascending: true });

        if (!error && data) {
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
        }
      } catch {
        // 静默
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

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
        showToast?.('保存失败', 'error');
      }
    } catch {
      showToast?.('保存失败', 'error');
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
            <VirtualizedList
              items={items}
              getKey={(item) => item.key}
              itemHeight={118}
              maxHeight={520}
              className="divide-y divide-zinc-100 dark:divide-zinc-800"
              renderItem={(item) => {
                const isJsonField = item.category === 'content' || item.category === 'alert';
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
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default SiteConfigPanel;
