import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { getTicketPriorities, getTicketTypes } from './constants';
import { ACCOUNT_RECOVERY_QQ_GROUP, ENGLISH_COMMUNITY_DISCORD_URL } from '../../constants/community';
import { useI18n } from '../../i18n/index.js';

export default function CreateTicketForm({ userRole, onCancel, onSubmit }) {
  const { isEnglish, locale } = useI18n();
  const [formData, setFormData] = useState({
    type: 'question',
    title: '',
    content: '',
    priority: 'medium',
    target_role: userRole === 'admin' ? 'super_admin' : 'admin'
  });
  const [submitting, setSubmitting] = useState(false);
  const ticketTypes = getTicketTypes(locale);
  const priorityConfig = getTicketPriorities(locale);
  const tt = React.useCallback((zh, en) => (isEnglish ? en : zh), [isEnglish]);

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
      <div className="border border-blue-200 dark:border-blue-900/40 bg-blue-50/70 dark:bg-blue-950/20 px-4 py-3 text-xs text-blue-800 dark:text-blue-300 space-y-1">
        <div>{tt('此处适合提交 Bug、数据问题和功能建议。', 'Use tickets for bugs, data issues, and feature requests.')}</div>
        <div>{tt('忘记密码请使用登录弹窗里的“账号恢复”，不要在工单里填写密码或请求站内直接发密码。', 'Use Account Recovery from the login modal if you forgot the password. Do not paste passwords into tickets or ask for passwords in-site.')}</div>
        <div>
          {isEnglish ? (
            <>
              If a temporary password has been approved, join
              {' '}
              <a href={ENGLISH_COMMUNITY_DISCORD_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                Discord
              </a>
              {' '}
              to receive it.
            </>
          ) : (
            <>若超管已完成核验并设置临时密码，请加入 QQ 群 {ACCOUNT_RECOVERY_QQ_GROUP} 线下领取。</>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">{tt('工单类型', 'Ticket Type')}</label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {Object.entries(ticketTypes).map(([key, config]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, type: key }))}
              className={`min-h-[68px] p-2 rounded-none border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                formData.type === key
                  ? config.color + ' border-current'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
              }`}
            >
              <config.icon size={18} />
              <span className="text-[11px] leading-tight text-center whitespace-normal break-words">{config.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">{tt('标题', 'Title')}</label>
        <input
          type="text"
          value={formData.title}
          onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
          placeholder={tt('简要描述您的问题...', 'Summarize the issue briefly...')}
          className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          maxLength={100}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">{tt('详细描述', 'Details')}</label>
        <textarea
          value={formData.content}
          onChange={(event) => setFormData((prev) => ({ ...prev, content: event.target.value }))}
          placeholder={tt('请详细描述您遇到的问题或建议...', 'Describe the problem or request in detail...')}
          className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-none focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px] resize-none"
          maxLength={2000}
          required
        />
        <div className="text-xs text-slate-400 mt-1 text-right">{formData.content.length}/2000</div>
        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-2">
          {tt('建议附上所用账号、卡池、时间范围和复现步骤；不要填写密码或完整访问令牌。', 'Include account, banner, timeframe, and repro steps when possible. Do not paste passwords or full access tokens.')}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">{tt('优先级', 'Priority')}</label>
          <select
            value={formData.priority}
            onChange={(event) => setFormData((prev) => ({ ...prev, priority: event.target.value }))}
            className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="low">{priorityConfig.low.label}</option>
            <option value="medium">{priorityConfig.medium.label}</option>
            {(userRole === 'admin' || userRole === 'super_admin') && (
              <>
                <option value="high">{priorityConfig.high.label}</option>
                <option value="urgent">{priorityConfig.urgent.label}</option>
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
          {tt('取消', 'Cancel')}
        </button>
        <button
          type="submit"
          disabled={submitting || !formData.title.trim() || !formData.content.trim()}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-none transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-normal text-center leading-tight"
        >
          <Send size={16} />
          {submitting ? tt('提交中...', 'Submitting...') : tt('提交工单', 'Submit Ticket')}
        </button>
      </div>
    </form>
  );
}
