import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, Home, Eye, EyeOff } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';

/**
 * 页面内容管理面板
 */
const PageContentPanel = ({
  pageContents,
  actionLoading,
  onSavePageContent,
  onToggleActive,
  onDeletePageContent
}) => {
  const [editingPageContent, setEditingPageContent] = useState(null);
  const [showPageContentForm, setShowPageContentForm] = useState(false);
  const [pageContentForm, setPageContentForm] = useState({
    id: '',
    title: '',
    content: '',
    is_active: true
  });

  const resetPageContentForm = () => {
    setPageContentForm({ id: '', title: '', content: '', is_active: true });
    setEditingPageContent(null);
    setShowPageContentForm(false);
  };

  const startEditPageContent = (pageContent) => {
    setPageContentForm({
      id: pageContent.id,
      title: pageContent.title,
      content: pageContent.content,
      is_active: pageContent.is_active
    });
    setEditingPageContent(pageContent);
    setShowPageContentForm(true);
  };

  const handleSave = () => {
    onSavePageContent(pageContentForm, editingPageContent, resetPageContentForm);
  };

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500 dark:text-zinc-500">
          共 {pageContents.length} 条页面内容
        </span>
        {!showPageContentForm && (
          <button
            onClick={() => setShowPageContentForm(true)}
            className="flex items-center gap-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-none transition-colors"
          >
            <Plus size={16} />
            新建内容
          </button>
        )}
      </div>

      {/* 页面内容编辑表单 */}
      {showPageContentForm && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-blue-800 dark:text-blue-300">
              {editingPageContent ? '编辑页面内容' : '新建页面内容'}
            </h4>
            <button onClick={resetPageContentForm} className="text-blue-400 hover:text-blue-600">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                  ID <span className="text-xs opacity-75">(唯一标识符)</span>
                </label>
                <input
                  type="text"
                  value={pageContentForm.id}
                  onChange={(e) => setPageContentForm(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                  disabled={!!editingPageContent}
                  className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 disabled:bg-slate-100 disabled:dark:bg-zinc-800"
                  placeholder="home_guide"
                />
                <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-1">仅小写字母、数字和下划线</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">标题</label>
                <input
                  type="text"
                  value={pageContentForm.title}
                  onChange={(e) => setPageContentForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                  placeholder="使用指南"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                内容 <span className="text-xs opacity-75">(Markdown 编辑器)</span>
              </label>
              <div data-color-mode="light" className="dark:hidden">
                <MDEditor
                  value={pageContentForm.content}
                  onChange={(val) => setPageContentForm(prev => ({ ...prev, content: val || '' }))}
                  height={350}
                  preview="live"
                  hideToolbar={false}
                  enableScroll={true}
                />
              </div>
              <div data-color-mode="dark" className="hidden dark:block">
                <MDEditor
                  value={pageContentForm.content}
                  onChange={(val) => setPageContentForm(prev => ({ ...prev, content: val || '' }))}
                  height={350}
                  preview="live"
                  hideToolbar={false}
                  enableScroll={true}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                <input
                  type="checkbox"
                  checked={pageContentForm.is_active}
                  onChange={(e) => setPageContentForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-blue-500"
                />
                立即激活
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={actionLoading === 'pageContent'}
                className="flex items-center gap-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-none transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                {actionLoading === 'pageContent' ? '保存中...' : '保存'}
              </button>
              <button onClick={resetPageContentForm} className="px-4 py-2 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-none">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 页面内容列表 */}
      {pageContents.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
          <Home size={48} className="mx-auto mb-4 opacity-50" />
          <p>暂无页面内容</p>
          <p className="text-xs mt-2">点击「新建内容」添加可编辑的页面内容</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pageContents.map(pageContent => (
            <div key={pageContent.id} className={`p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 ${!pageContent.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <code className="text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded">
                      {pageContent.id}
                    </code>
                    <h4 className="font-medium text-slate-700 dark:text-zinc-300">{pageContent.title}</h4>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      pageContent.is_active ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-500'
                    }`}>
                      {pageContent.is_active ? '激活' : '停用'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-zinc-500 line-clamp-2">
                    {pageContent.content.replace(/[#*>\-`]/g, '').slice(0, 150)}...
                  </p>
                  <span className="text-xs text-slate-400 dark:text-zinc-600">
                    更新于 {new Date(pageContent.updated_at || pageContent.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onToggleActive(pageContent)} disabled={actionLoading === pageContent.id} className={`p-1.5 rounded ${pageContent.is_active ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`} title={pageContent.is_active ? '停用' : '激活'}>
                    {pageContent.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button onClick={() => startEditPageContent(pageContent)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="编辑">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => onDeletePageContent(pageContent.id)} disabled={actionLoading === pageContent.id} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="删除">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PageContentPanel;
