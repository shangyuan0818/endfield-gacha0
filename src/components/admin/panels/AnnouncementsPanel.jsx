import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, FileText, Eye, EyeOff } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import {
  ANNOUNCEMENT_SEVERITY_OPTIONS,
  ANNOUNCEMENT_TYPE_OPTIONS,
  getAnnouncementSeverityMeta,
  getAnnouncementTypeLabel,
  normalizeAnnouncementSeverity,
  normalizeAnnouncementType
} from '../../../utils/announcementMeta';

/**
 * 公告管理面板
 */
const AnnouncementsPanel = ({
  announcements,
  actionLoading,
  onSaveAnnouncement,
  onToggleActive,
  onDeleteAnnouncement
}) => {
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    title_en: '',
    content: '',
    content_en: '',
    version: '1.0.0',
    announcement_type: 'update',
    severity: 'info',
    is_active: true,
    priority: 0
  });

  const resetAnnouncementForm = () => {
    setAnnouncementForm({
      title: '',
      title_en: '',
      content: '',
      content_en: '',
      version: '1.0.0',
      announcement_type: 'update',
      severity: 'info',
      is_active: true,
      priority: 0
    });
    setEditingAnnouncement(null);
    setShowAnnouncementForm(false);
  };

  const startEditAnnouncement = (announcement) => {
    setAnnouncementForm({
      title: announcement.title,
      title_en: announcement.title_en || '',
      content: announcement.content,
      content_en: announcement.content_en || '',
      version: announcement.version || '1.0.0',
      announcement_type: normalizeAnnouncementType(announcement.announcement_type),
      severity: normalizeAnnouncementSeverity(announcement.severity),
      is_active: announcement.is_active,
      priority: announcement.priority || 0
    });
    setEditingAnnouncement(announcement);
    setShowAnnouncementForm(true);
  };

  const handleSave = () => {
    onSaveAnnouncement(announcementForm, editingAnnouncement, resetAnnouncementForm);
  };

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500 dark:text-zinc-500">
          共 {announcements.length} 条公告
        </span>
        {!showAnnouncementForm && (
          <button
            onClick={() => setShowAnnouncementForm(true)}
            className="flex items-center gap-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-none transition-colors"
          >
            <Plus size={16} />
            新建公告
          </button>
        )}
      </div>

      {/* 公告编辑表单 */}
      {showAnnouncementForm && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-amber-800 dark:text-amber-300">
              {editingAnnouncement ? '编辑公告' : '新建公告'}
            </h4>
            <button onClick={resetAnnouncementForm} className="text-amber-400 hover:text-amber-600">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">标题</label>
                <input
                  type="text"
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                  placeholder="公告标题"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">英文标题</label>
                <input
                  type="text"
                  value={announcementForm.title_en}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title_en: e.target.value }))}
                  className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                  placeholder="English announcement title"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">版本号</label>
                  <input
                    type="text"
                    value={announcementForm.version}
                    onChange={(e) => setAnnouncementForm(prev => ({ ...prev, version: e.target.value }))}
                    className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                    placeholder="1.0.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">优先级</label>
                  <input
                    type="number"
                    value={announcementForm.priority}
                    onChange={(e) => setAnnouncementForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">公告类型</label>
                  <select
                    value={announcementForm.announcement_type}
                    onChange={(e) => setAnnouncementForm(prev => ({
                      ...prev,
                      announcement_type: e.target.value,
                      severity: e.target.value === 'temporary' ? prev.severity : 'info'
                    }))}
                    className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                  >
                    {ANNOUNCEMENT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">重要程度</label>
                  <select
                    value={announcementForm.severity}
                    disabled={announcementForm.announcement_type !== 'temporary'}
                    onChange={(e) => setAnnouncementForm(prev => ({ ...prev, severity: e.target.value }))}
                    className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 disabled:opacity-50"
                  >
                    {ANNOUNCEMENT_SEVERITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="text-xs text-amber-700/80 dark:text-amber-300/80">
              现有公告默认为更新公告。临时公告用于故障、维护、提示等短期状态，可通过重要程度改变前台颜色。
              英文字段为可选，英文环境下若未填写，将自动回退到中文公告内容。
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">
                  中文内容 <span className="text-xs opacity-75">(Markdown 编辑器)</span>
                </label>
                <div data-color-mode="light" className="dark:hidden">
                  <MDEditor
                    value={announcementForm.content}
                    onChange={(val) => setAnnouncementForm(prev => ({ ...prev, content: val || '' }))}
                    height={300}
                    preview="live"
                    hideToolbar={false}
                    enableScroll={true}
                  />
                </div>
                <div data-color-mode="dark" className="hidden dark:block">
                  <MDEditor
                    value={announcementForm.content}
                    onChange={(val) => setAnnouncementForm(prev => ({ ...prev, content: val || '' }))}
                    height={300}
                    preview="live"
                    hideToolbar={false}
                    enableScroll={true}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">
                  英文内容 <span className="text-xs opacity-75">(Markdown 编辑器，可选)</span>
                </label>
                <div data-color-mode="light" className="dark:hidden">
                  <MDEditor
                    value={announcementForm.content_en}
                    onChange={(val) => setAnnouncementForm(prev => ({ ...prev, content_en: val || '' }))}
                    height={300}
                    preview="live"
                    hideToolbar={false}
                    enableScroll={true}
                  />
                </div>
                <div data-color-mode="dark" className="hidden dark:block">
                  <MDEditor
                    value={announcementForm.content_en}
                    onChange={(val) => setAnnouncementForm(prev => ({ ...prev, content_en: val || '' }))}
                    height={300}
                    preview="live"
                    hideToolbar={false}
                    enableScroll={true}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                <input
                  type="checkbox"
                  checked={announcementForm.is_active}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-amber-500"
                />
                立即激活
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={actionLoading === 'announcement'}
                className="flex items-center gap-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-none transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                {actionLoading === 'announcement' ? '保存中...' : '保存'}
              </button>
              <button onClick={resetAnnouncementForm} className="px-4 py-2 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-none">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 公告列表 */}
      {announcements.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
          <FileText size={48} className="mx-auto mb-4 opacity-50" />
          <p>暂无公告</p>
        </div>
      ) : (
        <div className="space-y-2">
          {announcements.map(announcement => {
            const severityMeta = getAnnouncementSeverityMeta(announcement.severity);
            const announcementType = normalizeAnnouncementType(announcement.announcement_type);
            return (
            <div key={announcement.id} className={`p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 ${!announcement.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-medium text-slate-700 dark:text-zinc-300">{announcement.title}</h4>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      announcementType === 'temporary'
                        ? severityMeta.badge
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}>
                      {getAnnouncementTypeLabel(announcementType)}
                    </span>
                    {announcementType === 'temporary' ? (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${severityMeta.badge}`}>
                        {severityMeta.label}
                      </span>
                    ) : null}
                    {announcement.title_en ? (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                        EN
                      </span>
                    ) : null}
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400 rounded">
                      v{announcement.version}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      announcement.is_active ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-500'
                    }`}>
                      {announcement.is_active ? '激活' : '停用'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-zinc-500 line-clamp-2">
                    {announcement.content.replace(/[#*>\-`]/g, '').slice(0, 100)}...
                  </p>
                  {announcement.content_en ? (
                    <p className="mt-1 text-xs text-slate-400 dark:text-zinc-600 line-clamp-1">
                      EN: {announcement.content_en.replace(/[#*>\-`]/g, '').slice(0, 80)}...
                    </p>
                  ) : null}
                  <span className="text-xs text-slate-400 dark:text-zinc-600">
                    优先级: {announcement.priority} · 更新于 {new Date(announcement.updated_at || announcement.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onToggleActive(announcement)} disabled={actionLoading === announcement.id} className={`p-1.5 rounded ${announcement.is_active ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`} title={announcement.is_active ? '停用' : '激活'}>
                    {announcement.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button onClick={() => startEditAnnouncement(announcement)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="编辑">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => onDeleteAnnouncement(announcement.id)} disabled={actionLoading === announcement.id} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="删除">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
};

export default AnnouncementsPanel;
