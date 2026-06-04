import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, MessageCircle, RefreshCw, Shield, User } from 'lucide-react';
import { attachPublicProfiles, loadPublicProfilesMap } from '../../services/publicProfileService';
import { buildUsernameHandle } from '../../utils/usernameValidation.js';
import ReplyInput from './ReplyInput';
import { getTicketPriorities, getTicketStatus, getTicketTypes } from './constants';
import { useI18n } from '../../i18n/index.js';
import { buildTicketReplyNotification } from '../../utils/notificationModel.js';
import { submitTicketReply } from '../../services/ticketReplyService.js';
import { loadTicketReplies } from '../../services/ticketService.js';

export default function TicketCard({
  ticket,
  userRole,
  currentUserId,
  showToast,
  addDurableNotification,
  onStatusChange,
  onReply,
  expanded,
  onToggle
}) {
  const { isEnglish, locale, formatDateTime } = useI18n();
  const [replyContent, setReplyContent] = useState('');
  const [replies, setReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const ticketTypes = getTicketTypes(locale);
  const ticketStatus = getTicketStatus(locale);
  const priorityConfigMap = getTicketPriorities(locale);
  const tt = React.useCallback((zh, en) => (isEnglish ? en : zh), [isEnglish]);

  const typeConfig = ticketTypes[ticket.type] || ticketTypes.other;
  const statusConfig = ticketStatus[ticket.status] || ticketStatus.pending;
  const priorityConfig = priorityConfigMap[ticket.priority] || priorityConfigMap.medium;
  const isOwner = ticket.user_id === currentUserId;
  const canManage = userRole === 'super_admin' || (userRole === 'admin' && ticket.target_role === 'admin');

  const loadReplies = useCallback(async () => {
    setLoadingReplies(true);
    try {
      const result = await loadTicketReplies(ticket.id);
      const rows = Array.isArray(result.replies) ? result.replies : [];
      const profilesMap = await loadPublicProfilesMap(rows.map((reply) => reply.user_id));
      setReplies(attachPublicProfiles(rows, profilesMap));
    } catch (error) {
      showToast?.(`${tt('加载回复失败', 'Failed to load replies')}: ${error.message}`, 'error');
    } finally {
      setLoadingReplies(false);
    }
  }, [showToast, ticket.id, tt]);

  useEffect(() => {
    if (expanded && replies.length === 0) {
      loadReplies();
    }
  }, [expanded, loadReplies, replies.length]);

  const handleSubmitReply = useCallback(async () => {
    if (!replyContent.trim()) return;

    setSubmittingReply(true);
    const submittedAt = new Date().toISOString();
    try {
      const result = await submitTicketReply({
        ticketId: ticket.id,
        content: replyContent.trim(),
        locale,
      });
      const createdAt = result?.reply?.created_at || submittedAt;

      setReplyContent('');
      addDurableNotification?.(buildTicketReplyNotification({
        authorRole: userRole,
        ticketStatus: ticket.status,
        createdAt,
        dedupeKey: `ticket-reply:${createdAt}:${userRole || 'user'}`
      }, { locale }));
      await loadReplies();
      await onReply?.();
    } catch (error) {
      showToast?.(`${tt('发送回复失败', 'Failed to send reply')}: ${error.message}`, 'error');
    } finally {
      setSubmittingReply(false);
    }
  }, [addDurableNotification, loadReplies, locale, onReply, replyContent, showToast, ticket.id, ticket.status, tt, userRole]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none overflow-hidden">
      <div
        onClick={onToggle}
        className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-950 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-none ${typeConfig.color}`}>
            <typeConfig.icon size={18} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="font-medium text-slate-800 dark:text-zinc-100 break-words">{ticket.title}</h4>
              <span className={`text-xs px-2 py-0.5 rounded-sm ${statusConfig.color}`}>{statusConfig.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-sm ${priorityConfig.color}`}>{priorityConfig.label}</span>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-sm flex items-center justify-center text-white text-[10px] ${
                  ticket.profiles?.role === 'super_admin' ? 'bg-purple-500' :
                  ticket.profiles?.role === 'admin' ? 'bg-indigo-500' : 'bg-slate-500'
                }`}>
                  {ticket.profiles?.role === 'super_admin' ? <Shield size={10} /> :
                    ticket.profiles?.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                  {ticket.profiles ? buildUsernameHandle(ticket.profiles) : tt('未知用户', 'Unknown User')}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  ticket.profiles?.role === 'super_admin' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                  ticket.profiles?.role === 'admin' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' :
                  'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                  {ticket.profiles?.role === 'super_admin'
                    ? tt('超管', 'Super Admin')
                    : ticket.profiles?.role === 'admin'
                      ? tt('管理员', 'Admin')
                      : tt('用户', 'User')}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-500 dark:text-zinc-500 flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatDateTime(ticket.created_at, { hour12: false })}
              </span>
              {ticket.workflow?.lastReplyAt && (
                <span className={`flex items-center gap-1 ${
                  ticket.workflow?.needsStaffAttention
                    ? 'text-amber-600 dark:text-amber-400'
                    : ticket.workflow?.waitingForUser
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-slate-500 dark:text-zinc-500'
                }`}>
                  <MessageCircle size={12} />
                  {ticket.workflow?.needsStaffAttention
                    ? tt('用户有新回复', 'User replied')
                    : ticket.workflow?.waitingForUser
                      ? tt('等待用户回复', 'Waiting for user')
                      : tt('最后回复', 'Last reply')}
                  {' · '}
                  {formatDateTime(ticket.workflow.lastReplyAt, { hour12: false })}
                </span>
              )}
              {ticket.target_role === 'super_admin' && (
                <span className="flex items-center gap-1 text-purple-500">
                  <Shield size={12} />
                  {tt('发送给超管', 'Escalated to Super Admin')}
                </span>
              )}
            </div>
          </div>

          <div className="text-slate-400">
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          <div className="p-4 bg-slate-50 dark:bg-zinc-950">
            <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">{ticket.content}</p>
          </div>

          {canManage && ticket.status !== 'closed' && (
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
              {ticket.status === 'pending' && (
                <button
                  onClick={() => onStatusChange(ticket.id, 'processing')}
                  className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-none transition-colors whitespace-normal text-center leading-tight"
                >
                  {tt('开始处理', 'Start Review')}
                </button>
              )}
              {(ticket.status === 'pending' || ticket.status === 'processing') && (
                <>
                  <button
                    onClick={() => onStatusChange(ticket.id, 'resolved')}
                    className="px-3 py-1.5 text-xs bg-green-500 hover:bg-green-600 text-white rounded-none transition-colors whitespace-normal text-center leading-tight"
                  >
                    {tt('标记解决', 'Mark Resolved')}
                  </button>
                  <button
                    onClick={() => onStatusChange(ticket.id, 'rejected')}
                    className="px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-none transition-colors whitespace-normal text-center leading-tight"
                  >
                    {tt('拒绝', 'Reject')}
                  </button>
                </>
              )}
              <button
                onClick={() => onStatusChange(ticket.id, 'closed')}
                className="px-3 py-1.5 text-xs bg-slate-500 hover:bg-slate-600 text-white rounded-none transition-colors whitespace-normal text-center leading-tight"
              >
                {tt('关闭', 'Close')}
              </button>
            </div>
          )}

          <div className="border-t border-zinc-100 dark:border-zinc-800">
            {loadingReplies ? (
              <div className="p-4 text-center text-slate-400">
                <RefreshCw size={16} className="animate-spin inline mr-2" />
                {tt('加载回复中...', 'Loading replies...')}
              </div>
            ) : replies.length > 0 ? (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {replies.map((reply) => (
                  <div key={reply.id} className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-6 h-6 rounded-sm flex items-center justify-center text-white text-xs ${
                        reply.profiles?.role === 'super_admin' ? 'bg-purple-500' :
                        reply.profiles?.role === 'admin' ? 'bg-indigo-500' : 'bg-slate-500'
                      }`}>
                        {reply.profiles?.role === 'super_admin' ? <Shield size={12} /> :
                          reply.profiles?.role === 'admin' ? <Shield size={12} /> : <User size={12} />}
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                        {reply.profiles ? buildUsernameHandle(reply.profiles) : tt('用户', 'User')}
                      </span>
                      <span className="text-xs text-slate-400">{formatDateTime(reply.created_at, { hour12: false })}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-zinc-400 pl-8 whitespace-pre-wrap">{reply.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-slate-400 text-sm">{tt('暂无回复', 'No replies yet')}</div>
            )}
          </div>

          {ticket.status !== 'closed' && (isOwner || canManage) && (
            <ReplyInput
              value={replyContent}
              onChange={setReplyContent}
              onSubmit={handleSubmitReply}
              submitting={submittingReply}
            />
          )}
        </div>
      )}
    </div>
  );
}
