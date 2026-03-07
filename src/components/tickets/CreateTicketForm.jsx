import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { TICKET_TYPES } from './constants';

export default function CreateTicketForm({ userRole, onCancel, onSubmit }) {
  const [formData, setFormData] = useState({
    type: 'question',
    title: '',
    content: '',
    priority: 'medium',
    target_role: userRole === 'admin' ? 'super_admin' : 'admin'
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit(formData);
      setFormData({
        type: 'question',
        title: '',
        content: '',
        priority: 'medium',
        target_role: userRole === 'admin' ? 'super_admin' : 'admin'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">工单类型</label>
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(TICKET_TYPES).map(([key, config]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, type: key }))}
              className={`p-2 rounded-none border-2 transition-all flex flex-col items-center gap-1 ${
                formData.type === key
                  ? config.color + ' border-current'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
              }`}
            >
              <config.icon size={18} />
              <span className="text-xs">{config.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">标题</label>
        <input
          type="text"
          value={formData.title}
          onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
          placeholder="简要描述您的问题..."
          className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          maxLength={100}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">详细描述</label>
        <textarea
          value={formData.content}
          onChange={(event) => setFormData((prev) => ({ ...prev, content: event.target.value }))}
          placeholder="请详细描述您遇到的问题或建议..."
          className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-none focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px] resize-none"
          maxLength={2000}
          required
        />
        <div className="text-xs text-slate-400 mt-1 text-right">{formData.content.length}/2000</div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">优先级</label>
          <select
            value={formData.priority}
            onChange={(event) => setFormData((prev) => ({ ...prev, priority: event.target.value }))}
            className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="low">低</option>
            <option value="medium">中</option>
            {(userRole === 'admin' || userRole === 'super_admin') && (
              <>
                <option value="high">高</option>
                <option value="urgent">紧急</option>
              </>
            )}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-none transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting || !formData.title.trim() || !formData.content.trim()}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-none transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <Send size={16} />
          {submitting ? '提交中...' : '提交工单'}
        </button>
      </div>
    </form>
  );
}
