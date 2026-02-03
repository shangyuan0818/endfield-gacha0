import React, { useState } from 'react';
import { Search, Plus, Ban, Trash2, X } from 'lucide-react';

/**
 * 黑名单管理面板
 */
const BlacklistPanel = ({
  blacklist,
  actionLoading,
  onSaveEntry,
  onRemoveEntry
}) => {
  const [blacklistSearch, setBlacklistSearch] = useState('');
  const [showBlacklistForm, setShowBlacklistForm] = useState(false);
  const [blacklistForm, setBlacklistForm] = useState({
    email: '',
    reason: '',
    type: 'email'
  });

  const resetBlacklistForm = () => {
    setBlacklistForm({ email: '', reason: '', type: 'email' });
    setShowBlacklistForm(false);
  };

  const handleSave = () => {
    onSaveEntry(blacklistForm, resetBlacklistForm);
  };

  const filteredBlacklist = blacklist.filter(entry =>
    entry.email?.toLowerCase().includes(blacklistSearch.toLowerCase()) ||
    entry.reason?.toLowerCase().includes(blacklistSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            value={blacklistSearch}
            onChange={(e) => setBlacklistSearch(e.target.value)}
            placeholder="搜索邮箱或原因..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
          />
        </div>
        {!showBlacklistForm && (
          <button
            onClick={() => setShowBlacklistForm(true)}
            className="flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-none transition-colors"
          >
            <Plus size={16} />
            添加黑名单
          </button>
        )}
      </div>

      {/* 添加表单 */}
      {showBlacklistForm && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-red-800 dark:text-red-300">添加黑名单</h4>
            <button onClick={resetBlacklistForm} className="text-red-400 hover:text-red-600">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-1">类型</label>
              <select
                value={blacklistForm.type}
                onChange={(e) => setBlacklistForm(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
              >
                <option value="email">邮箱地址</option>
                <option value="domain">邮箱域名</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-1">
                {blacklistForm.type === 'email' ? '邮箱地址' : '域名'}
              </label>
              <input
                type="text"
                value={blacklistForm.email}
                onChange={(e) => setBlacklistForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                placeholder={blacklistForm.type === 'email' ? 'spam@example.com' : 'spam-domain.com'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-1">原因</label>
              <input
                type="text"
                value={blacklistForm.reason}
                onChange={(e) => setBlacklistForm(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                placeholder="刷号、垃圾邮件等"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={actionLoading === 'blacklist'}
              className="flex items-center gap-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-none transition-colors disabled:opacity-50"
            >
              <Ban size={16} />
              {actionLoading === 'blacklist' ? '添加中...' : '添加'}
            </button>
            <button onClick={resetBlacklistForm} className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-none">
              取消
            </button>
          </div>
        </div>
      )}

      {/* 黑名单列表 */}
      <div className="text-xs text-slate-500 dark:text-zinc-500 mb-2">
        共 {filteredBlacklist.length} 条记录
      </div>

      {filteredBlacklist.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
          <Ban size={48} className="mx-auto mb-4 opacity-50" />
          <p>黑名单为空</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredBlacklist.map(entry => (
            <div key={entry.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    entry.type === 'domain' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {entry.type === 'domain' ? '域名' : '邮箱'}
                  </span>
                  <span className="font-mono text-slate-700 dark:text-zinc-300">{entry.email}</span>
                </div>
                <p className="text-sm text-slate-500 dark:text-zinc-500">{entry.reason}</p>
                <span className="text-xs text-slate-400 dark:text-zinc-600">
                  添加于 {new Date(entry.created_at).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => onRemoveEntry(entry)}
                disabled={actionLoading === entry.id}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                title="移除"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BlacklistPanel;
