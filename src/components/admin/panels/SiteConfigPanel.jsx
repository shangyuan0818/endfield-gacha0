import React, { useState, useEffect } from 'react';
import { Save, X, Edit2, Settings, Globe, Scale, Link } from 'lucide-react';
import useSiteConfigStore from '../../../stores/useSiteConfigStore';
import { supabase } from '../../../supabaseClient';

const CATEGORY_META = {
  legal: { label: '法律合规', icon: Scale, color: 'text-red-600 dark:text-red-400' },
  social: { label: '社交链接', icon: Link, color: 'text-blue-600 dark:text-blue-400' },
  general: { label: '通用配置', icon: Globe, color: 'text-zinc-600 dark:text-zinc-400' },
};

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
          setConfigItems(data);
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
      const success = await useSiteConfigStore.getState().updateConfig(editingKey, editValue);
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

  const categoryOrder = ['legal', 'social', 'general'];

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
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map(item => (
                <div key={item.key} className="px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  {editingKey === item.key ? (
                    /* 编辑模式 */
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <code className="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded font-mono">{item.key}</code>
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{item.label}</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="flex-1 px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSave();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-none transition-colors disabled:opacity-50"
                        >
                          <Save size={14} />
                          {saving ? '...' : '保存'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-2 py-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 显示模式 */
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{item.label}</span>
                          <code className="text-[10px] px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded font-mono">{item.key}</code>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-zinc-400 truncate font-mono">{item.value || '(空)'}</p>
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
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SiteConfigPanel;
