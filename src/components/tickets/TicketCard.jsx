import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, RefreshCw, Shield, User } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { attachPublicProfiles, loadPublicProfilesMap } from '../../services/publicProfileService';
import ReplyInput from './ReplyInput';
import { PRIORITY_CONFIG, TICKET_STATUS, TICKET_TYPES } from './constants';

export default function TicketCard({
  ticket,
  userRole,
  currentUserId,
  showToast,
  onStatusChange,
  onReply,
  expanded,
  onToggle
}) {
  const [replyContent, setReplyContent] = useState('');
  const [replies, setReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);

  const typeConfig = TICKET_TYPES[ticket.type] || TICKET_TYPES.other;
  const statusConfig = TICKET_STATUS[ticket.status] || TICKET_STATUS.pending;
  const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
  const isOwner = ticket.user_id === currentUserId;
  const canManage = userRole === 'super_admin' || (userRole === 'admin' && ticket.target_role === 'admin');

  const loadReplies = useCallback(async () => {
    setLoadingReplies(true);
    try {
      const { data, error } = await supabase
        .from('ticket_replies')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const rows = data || [];
      const profilesMap = await loadPublicProfilesMap(rows.map((reply) => reply.user_id));
      setReplies(attachPublicProfiles(rows, profilesMap));
    } catch (error) {
      showToast?.(`加载回复失败：${error.message}`, 'error');
    } finally {
      setLoadingReplies(false);
    }
  }, [showToast, ticket.id]);

  useEffect(() => {
    if (expanded && replies.length === 0) {
      loadReplies();
    }
  }, [expanded, loadReplies, replies.length]);

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;

    setSubmittingReply(true);
    try {
      const { error } = await supabase
        .from('ticket_replies')
        .insert({
          ticket_id: ticket.id,
          user_id: currentUserId,
          content: replyContent.trim()
        });

      if (error) throw error;

      setReplyContent('');
      await loadReplies();
      await onReply?.();
    } catch (error) {
      showToast?.(`发送回复失败：${error.message}`, 'error');
    } finally {
      setSubmittingReply(false);
    }
  };

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
              <h4 className="font-medium text-slate-800 dark:text-zinc-100 truncate">{ticket.title}</h4>
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
                  {ticket.profiles?.username || '未知用户'}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  ticket.profiles?.role === 'super_admin' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                  ticket.profiles?.role === 'admin' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' :
                  'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                  {ticket.profiles?.role === 'super_admin' ? '超管' :
                    ticket.profiles?.role === 'admin' ? '管理员' : '用户'}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-500 dark:text-zinc-500 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {new Date(ticket.created_at).toLocaleString()}
              </span>
              {ticket.target_role === 'super_admin' && (
                <span className="flex items-center gap-1 text-purple-500">
                  <Shield size={12} />
                  发送给超管
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
                  className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-none transition-colors"
                >
                  开始处理
                </button>
              )}
              {(ticket.status === 'pending' || ticket.status === 'processing') && (
                <>
                  <button
                    onClick={() => onStatusChange(ticket.id, 'resolved')}
                    className="px-3 py-1.5 text-xs bg-green-500 hover:bg-green-600 text-white rounded-none transition-colors"
                  >
                    标记解决
                  </button>
                  <button
                    onClick={() => onStatusChange(ticket.id, 'rejected')}
                    className="px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-none transition-colors"
                  >
                    拒绝
                  </button>
                </>
              )}
              <button
                onClick={() => onStatusChange(ticket.id, 'closed')}
                className="px-3 py-1.5 text-xs bg-slate-500 hover:bg-slate-600 text-white rounded-none transition-colors"
              >
                关闭
              </button>
            </div>
          )}

          <div className="border-t border-zinc-100 dark:border-zinc-800">
            {loadingReplies ? (
              <div className="p-4 text-center text-slate-400">
                <RefreshCw size={16} className="animate-spin inline mr-2" />
                加载回复中...
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
                        {reply.profiles?.username || '用户'}
                      </span>
                      <span className="text-xs text-slate-400">{new Date(reply.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-zinc-400 pl-8 whitespace-pre-wrap">{reply.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-slate-400 text-sm">暂无回复</div>
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
