import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  MessageSquare, Plus, Send, ChevronDown, ChevronUp, User, Shield, RefreshCw, X, Smile,
  AlertCircle
} from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';
import { supabase } from '../../supabaseClient';
import { attachPublicProfiles, loadPublicProfilesMap } from '../../services/publicProfileService';
import { withAuthenticatedSupabaseRequest } from '../../services/authFetchService.js';
import { buildUsernameHandle } from '../../utils/usernameValidation.js';
import { ACCOUNT_RECOVERY_QQ_GROUP, ENGLISH_COMMUNITY_DISCORD_URL } from '../../constants/community';
import { getTicketPriorities, getTicketStatus, getTicketTypes } from '../../components/tickets/constants';
import { useI18n } from '../../i18n/index.js';
import { MobilePillTabs, MobileStickyHeader } from '../components/ux/MobilePrimitives.jsx';
import { buildTicketReplyNotification } from '../../utils/notificationModel.js';
import { submitTicketReply } from '../../services/ticketReplyService.js';

// 常用表情（精简版）
const EMOJI_LIST = [
  '😀', '😅', '😂', '😊', '😍', '🤔', '😏', '😭', '😱', '😤',
  '👍', '👎', '👌', '👏', '🙏', '💪', '❤️', '🔥', '✨', '🎉'
];

function MobileTicketView({ addDurableNotification } = {}) {
  const { user, userRole } = useAuthStore();
  const { isEnglish, locale, formatDateTime, formatNumber } = useI18n();
  const tt = useCallback((zh, en) => (isEnglish ? en : zh), [isEnglish]);

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  // 加载工单
  const loadTickets = useCallback(async () => {
    if (!user || !supabase) return;
    setLoading(true);
    try {
      const { data, error } = await withAuthenticatedSupabaseRequest(
        () => supabase
          .from('tickets')
          .select('*')
          .order('created_at', { ascending: false }),
        { requireToken: true }
      );

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.code === 'PGRST200') {
          setTableExists(false);
          setTickets([]);
        }
      }

      setTableExists(true);
      const profilesMap = await loadPublicProfilesMap((data || []).map((ticket) => ticket.user_id));
      setTickets(attachPublicProfiles(data || [], profilesMap));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  // 创建工单
  const handleCreate = async (formData) => {
    const { error } = await withAuthenticatedSupabaseRequest(
      () => supabase
        .from('tickets')
        .insert({ ...formData, user_id: user.id }),
      { requireToken: true }
    );
    if (!error) {
      setShowCreate(false);
      await loadTickets();
    }
  };

  // 更新状态
  const handleStatusChange = async (ticketId, newStatus) => {
    const updateData = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'resolved') updateData.resolved_by = user.id;
    const { error } = await withAuthenticatedSupabaseRequest(
      () => supabase.from('tickets').update(updateData).eq('id', ticketId),
      { requireToken: true }
    );
    if (!error) await loadTickets();
  };

  // 过滤
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (filter === 'my') return t.user_id === user?.id;
      if (filter === 'pending') return t.status === 'pending';
      return true;
    });
  }, [tickets, filter, user]);

  const stats = useMemo(() => ({
    total: tickets.length,
    pending: tickets.filter((ticket) => ticket.status === 'pending').length,
    my: tickets.filter((ticket) => ticket.user_id === user?.id).length
  }), [tickets, user]);

  if (!user) {
    return (
      <div className="flex-1 h-full overflow-y-auto overflow-x-hidden slide-right-enter scroll-smooth w-full bg-ef-light dark:bg-ef-dark px-4 pb-6">
        <div className="mobile-ux-card p-8 text-center">
          <MessageSquare size={32} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-zinc-400">{tt('请先登录', 'Sign In Required')}</p>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-zinc-500">{tt('登录后才能使用工单系统。', 'Sign in first to use the ticket system.')}</p>
        </div>
      </div>
    );
  }

  const filterOptions = [
    { value: 'all', label: `${tt('全部', 'All')} (${formatNumber(stats.total)})` },
    { value: 'my', label: `${tt('我的', 'Mine')} (${formatNumber(stats.my)})` },
    ...(isAdmin ? [{ value: 'pending', label: `${tt('待处理', 'Pending')} (${formatNumber(stats.pending)})` }] : [])
  ];

  return (
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden slide-right-enter scroll-smooth w-full bg-ef-light dark:bg-ef-dark px-4 pb-6 space-y-4">
      <MobileStickyHeader
        eyebrow="SYSTEM"
        icon={MessageSquare}
        title={tt('工单反馈', 'Tickets')}
        subtitle={
          userRole === 'super_admin'
            ? tt('系统管理与用户反馈', 'System Ops & Feedback')
            : userRole === 'admin'
              ? tt('用户支持与反馈升级', 'Support & Escalations')
              : tt('支持与反馈通道', 'Support Channel')
        }
      />

      <div className="mobile-ux-soft-card mobile-ux-soft-card--info p-5 text-[11px] text-sky-700 dark:text-sky-200 space-y-1">
        <div>{tt('工单适用于 Bug、数据问题、功能建议和一般使用咨询。', 'Use tickets for bugs, data issues, feature requests, and usage questions.')}</div>
        <div>{tt('忘记密码请回登录弹窗使用“账号恢复”；已登录需要删除账号，请到设置页使用“注销账号”。', 'Use Account Recovery in the login modal if you forgot your password. To delete an account, go to Settings > Delete Account.')}</div>
        <div>
          {isEnglish ? (
            <>
              Do not put passwords into tickets. If a temporary password is approved, join
              {' '}
              <a href={ENGLISH_COMMUNITY_DISCORD_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                Discord
              </a>
              {' '}
              to receive it.
            </>
          ) : (
            <>请不要在工单里填写密码；若超管已设置临时密码，请加入 QQ 群 {ACCOUNT_RECOVERY_QQ_GROUP} 线下领取。</>
          )}
        </div>
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <MobilePillTabs
            options={filterOptions}
            value={filter}
            onChange={setFilter}
            compact
          />
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={loadTickets}
            className="mobile-ux-card-chip p-2 text-slate-500 dark:text-zinc-400 touch-feedback"
            title={tt('刷新', 'Refresh')}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex min-h-[40px] items-center justify-center gap-1 rounded-full bg-endfield-yellow px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-black touch-feedback whitespace-normal text-center leading-tight"
          >
            <Plus size={12} />
            {tt('新建工单', 'New Ticket')}
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateForm
          userRole={userRole}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {!tableExists ? (
        <div className="mobile-ux-soft-card mobile-ux-soft-card--warning p-5 py-8 text-center">
          <AlertCircle size={32} className="mx-auto mb-3 text-amber-500 dark:text-amber-300" />
          <p className="font-mono text-xs uppercase text-amber-700 dark:text-amber-200">{tt('工单功能尚未启用', 'Tickets Not Enabled')}</p>
        </div>
      ) : loading ? (
        <div className="text-center py-8">
          <RefreshCw size={20} className="animate-spin mx-auto text-zinc-400 mb-2" />
          <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">{tt('加载工单中...', 'Loading tickets...')}</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="mobile-ux-card p-5 py-12 text-center">
          <MessageSquare size={32} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono">
            {filter === 'my'
              ? tt('无工单记录', 'No tickets from you')
              : filter === 'pending'
                ? tt('无待处理工单', 'No pending tickets')
                : tt('暂无工单', 'No tickets yet')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              userRole={userRole}
              currentUserId={user.id}
              expanded={expandedId === ticket.id}
              onToggle={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}
              onStatusChange={handleStatusChange}
              onReply={loadTickets}
              addDurableNotification={addDurableNotification}
              locale={locale}
              formatDateTime={formatDateTime}
            />
          ))}
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}

function CreateForm({ userRole, onSubmit, onCancel }) {
  const { isEnglish, locale } = useI18n();
  const tt = useCallback((zh, en) => (isEnglish ? en : zh), [isEnglish]);
  const ticketTypes = getTicketTypes(locale);
  const priorityConfig = getTicketPriorities(locale);
  const [formData, setFormData] = useState({
    type: 'question',
    title: '',
    content: '',
    priority: 'medium',
    target_role: userRole === 'admin' ? 'super_admin' : 'admin'
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;
    setSubmitting(true);
    try { await onSubmit(formData); } finally { setSubmitting(false); }
  };

  return (
    <div className="mobile-ux-modal items-end">
      <div className="mobile-ux-modal-card max-h-[90vh] w-full animate-slide-up overflow-y-auto rounded-t-[1.5rem] rounded-b-none border-t border-zinc-200 dark:border-white/10">
        <div className="mobile-ux-modal-header sticky top-0 z-10">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-zinc-100">
            <Plus size={16} className="text-endfield-yellow" />
            {tt('新建工单', 'New Ticket')}
          </h3>
          <button onClick={onCancel} className="rounded-full border border-zinc-200 bg-zinc-50 p-1 text-slate-500 touch-feedback hover:bg-zinc-100 dark:border-white/8 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10">
            <X size={18} className="text-slate-500 dark:text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="mobile-ux-soft-card mobile-ux-soft-card--info space-y-1 px-3 py-3 text-[11px] text-sky-700 dark:text-sky-200">
            <div>{tt('请提交 Bug、数据异常或功能建议。', 'Use tickets for bugs, data issues, and feature requests.')}</div>
            <div>{tt('忘记密码请使用“账号恢复”，不要在工单里填写密码或要求站内直接发密码。', 'Use Account Recovery if you forgot your password. Do not paste passwords into tickets or ask for passwords in-site.')}</div>
            <div>
              {isEnglish ? (
                <>
                  If a temporary password is approved, join
                  {' '}
                  <a href={ENGLISH_COMMUNITY_DISCORD_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    Discord
                  </a>
                  {' '}
                  to receive it.
                </>
              ) : (
                <>若超管已设置临时密码，请加入 QQ 群 {ACCOUNT_RECOVERY_QQ_GROUP} 线下领取。</>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider">{tt('工单类型', 'Ticket Type')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(ticketTypes).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, type: key }))}
                    className={`min-h-[64px] rounded-[1rem] p-2 border flex flex-col items-center justify-center gap-1 touch-feedback transition-all ${
                      formData.type === key
                        ? `${config.color} border-current`
                        : 'border-zinc-200 bg-zinc-50/75 text-slate-600 hover:border-zinc-300 dark:border-white/8 dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:border-white/14'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="text-[10px] font-bold whitespace-normal break-words text-center leading-tight">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider">{tt('标题', 'Title')}</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder={tt('简要描述您的问题...', 'Summarize the issue briefly...')}
              className="mobile-ux-input px-3 py-2.5 text-sm"
              maxLength={100}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider">{tt('详细描述', 'Details')}</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
              placeholder={tt('请详细描述您遇到的问题或建议...', 'Describe the problem or request in detail...')}
              className="mobile-ux-input min-h-[120px] resize-none px-3 py-2.5 text-sm"
              maxLength={2000}
              required
            />
            <div className="text-[10px] text-zinc-400 mt-1 text-right font-mono">{formData.content.length}/2000</div>
            <p className="text-[10px] text-zinc-500 mt-2 font-mono">{tt('建议附上账号、卡池、时间范围和复现步骤；不要填写密码或完整访问令牌。', 'Include account, banner, timeframe, and repro steps. Do not paste passwords or full access tokens.')}</p>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider">{tt('优先级', 'Priority')}</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData((prev) => ({ ...prev, priority: e.target.value }))}
              className="mobile-ux-input px-3 py-2.5 text-sm"
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

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 min-h-[44px] rounded-full border border-zinc-200 bg-zinc-50 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 touch-feedback whitespace-normal text-center leading-tight dark:border-white/8 dark:bg-white/[0.03] dark:text-zinc-300"
            >
              {tt('取消', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || !formData.title.trim() || !formData.content.trim()}
              className="flex-1 min-h-[44px] rounded-full bg-endfield-yellow py-3 text-xs font-bold uppercase tracking-wider text-black touch-feedback disabled:opacity-50 flex items-center justify-center gap-2 whitespace-normal text-center leading-tight"
            >
              <Send size={14} />
              {submitting ? tt('提交中...', 'Submitting...') : tt('提交工单', 'Submit Ticket')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TicketCard({ ticket, userRole, currentUserId, expanded, onToggle, onStatusChange, onReply, addDurableNotification, locale, formatDateTime }) {
  const { isEnglish } = useI18n();
  const tt = useCallback((zh, en) => (isEnglish ? en : zh), [isEnglish]);
  const ticketTypes = getTicketTypes(locale);
  const ticketStatus = getTicketStatus(locale);
  const typeConfig = ticketTypes[ticket.type] || ticketTypes.other;
  const statusConfig = ticketStatus[ticket.status] || ticketStatus.pending;
  const TypeIcon = typeConfig.icon;
  const isOwner = ticket.user_id === currentUserId;
  const canManage = userRole === 'super_admin' || (userRole === 'admin' && ticket.target_role === 'admin');

  return (
    <div className="mobile-ux-card overflow-hidden">
      <button onClick={onToggle} className="w-full p-3 text-left touch-feedback">
        <div className="flex items-start gap-3">
          <div className={`mobile-ux-card-chip p-1.5 shrink-0 ${typeConfig.color}`}>
            <TypeIcon size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 break-words">{ticket.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[9px] px-1.5 py-0.5 font-bold ${statusConfig.color}`}>{statusConfig.label}</span>
              <span className="text-[9px] text-slate-500 dark:text-zinc-400 font-mono">
                {ticket.profiles ? buildUsernameHandle(ticket.profiles) : tt('用户', 'User')}
              </span>
              <span className="text-[9px] text-slate-500 dark:text-zinc-400 font-mono">
                {formatDateTime(ticket.created_at, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            </div>
          </div>
          <div className="text-slate-400 dark:text-zinc-600 shrink-0">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div className="border-t border-zinc-200 dark:border-white/8">
          <div className="bg-zinc-50/75 p-3 dark:bg-white/[0.03]">
            <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-300 whitespace-pre-wrap">
              {ticket.content}
            </p>
          </div>

          {canManage && ticket.status !== 'closed' && (
            <div className="flex flex-wrap gap-2 border-t border-zinc-200 dark:border-white/8 p-3">
              {ticket.status === 'pending' && (
                <button
                  onClick={() => onStatusChange(ticket.id, 'processing')}
                  className="rounded-full bg-blue-500 px-3 py-1.5 text-[10px] font-bold uppercase text-white touch-feedback whitespace-normal text-center leading-tight"
                >
                  {tt('开始处理', 'Start Review')}
                </button>
              )}
              {(ticket.status === 'pending' || ticket.status === 'processing') && (
                <>
                  <button
                    onClick={() => onStatusChange(ticket.id, 'resolved')}
                    className="rounded-full bg-green-500 px-3 py-1.5 text-[10px] font-bold uppercase text-white touch-feedback whitespace-normal text-center leading-tight"
                  >
                    {tt('标记解决', 'Mark Resolved')}
                  </button>
                  <button
                    onClick={() => onStatusChange(ticket.id, 'rejected')}
                    className="rounded-full bg-red-500 px-3 py-1.5 text-[10px] font-bold uppercase text-white touch-feedback whitespace-normal text-center leading-tight"
                  >
                    {tt('拒绝', 'Reject')}
                  </button>
                </>
              )}
              <button
                onClick={() => onStatusChange(ticket.id, 'closed')}
                className="rounded-full bg-zinc-700 px-3 py-1.5 text-[10px] font-bold uppercase text-white touch-feedback whitespace-normal text-center leading-tight"
              >
                {tt('关闭', 'Close')}
              </button>
            </div>
          )}

          {ticket.status !== 'closed' && (isOwner || canManage) && (
            <ReplySection
              ticketId={ticket.id}
              ticketStatus={ticket.status}
              authorRole={userRole}
              onReply={onReply}
              addDurableNotification={addDurableNotification}
              locale={locale}
              formatDateTime={formatDateTime}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ReplySection({ ticketId, ticketStatus, authorRole, onReply, addDurableNotification, locale, formatDateTime }) {
  const { isEnglish } = useI18n();
  const tt = useCallback((zh, en) => (isEnglish ? en : zh), [isEnglish]);
  const [replies, setReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyError, setReplyError] = useState('');
  const textareaRef = useRef(null);

  const loadReplies = useCallback(async () => {
    setLoadingReplies(true);
    try {
      const { data } = await withAuthenticatedSupabaseRequest(
        () => supabase
          .from('ticket_replies')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true }),
        { requireToken: true }
      );
      if (data) {
        const profilesMap = await loadPublicProfilesMap(data.map(reply => reply.user_id));
        setReplies(attachPublicProfiles(data, profilesMap));
      }
      setReplyError('');
    } catch (error) {
      setReplyError(`${tt('加载回复失败', 'Failed to load replies')}: ${error?.message || tt('未知错误', 'Unknown error')}`);
    } finally {
      setLoadingReplies(false);
    }
  }, [ticketId, tt]);

  useEffect(() => {
    loadReplies();
  }, [loadReplies]);

  const handleSubmit = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    setReplyError('');
    const submittedAt = new Date().toISOString();
    try {
      const result = await submitTicketReply({
        ticketId,
        content: replyText.trim(),
        locale,
      });
      const createdAt = result?.reply?.created_at || submittedAt;
      setReplyText('');
      addDurableNotification?.(buildTicketReplyNotification({
        authorRole,
        ticketStatus,
        createdAt,
        dedupeKey: `ticket-reply:${createdAt}:${authorRole || 'user'}`
      }, { locale }));
      loadReplies();
      onReply?.();
    } catch (error) {
      setReplyError(`${tt('发送回复失败', 'Failed to send reply')}: ${error?.message || tt('未知错误', 'Unknown error')}`);
    } finally {
      setSubmitting(false);
    }
  };

  const insertEmoji = (emoji) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const newVal = replyText.slice(0, start) + emoji + replyText.slice(ta.selectionEnd);
      setReplyText(newVal);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + emoji.length; ta.focus(); }, 0);
    } else {
      setReplyText(replyText + emoji);
    }
    setShowEmoji(false);
  };

  return (
    <div className="border-t border-zinc-200 dark:border-white/8">
      {loadingReplies ? (
        <div className="p-3 text-center text-[10px] font-mono text-zinc-500">{tt('加载回复中...', 'Loading replies...')}</div>
      ) : replies.length > 0 ? (
        <div className="max-h-60 divide-y divide-zinc-200 overflow-y-auto dark:divide-white/8">
          {replies.map(reply => (
            <div key={reply.id} className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-5 h-5 flex items-center justify-center text-white text-[8px] shrink-0 ${
                  reply.profiles?.role === 'super_admin' ? 'bg-purple-500' :
                  reply.profiles?.role === 'admin' ? 'bg-indigo-500' : 'bg-zinc-500'
                }`}>
                  {(reply.profiles?.role === 'super_admin' || reply.profiles?.role === 'admin')
                    ? <Shield size={10} /> : <User size={10} />}
                </div>
                <span className="text-[10px] font-bold text-slate-700 dark:text-zinc-300">
                  {reply.profiles ? buildUsernameHandle(reply.profiles) : tt('用户', 'User')}
                </span>
                <span className="text-[9px] text-slate-500 dark:text-zinc-400 font-mono">
                  {formatDateTime(reply.created_at, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                </span>
              </div>
              <p className="pl-7 text-xs text-slate-600 dark:text-zinc-400 whitespace-pre-wrap">
                {reply.content}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3 text-center text-[10px] font-mono text-zinc-500">{tt('暂无回复', 'No replies yet')}</div>
      )}

      <div className="border-t border-zinc-200 bg-zinc-50/75 p-3 dark:border-white/8 dark:bg-white/[0.03]">
        {replyError && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] leading-relaxed text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>{replyError}</span>
          </div>
        )}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={tt('输入回复...', 'Write a reply...')}
            className="mobile-ux-input min-h-[48px] max-h-[96px] resize-none px-3 py-2 text-xs"
            rows={2}
          />
          {showEmoji && (
            <div className="mobile-ux-dropdown absolute bottom-full left-0 z-50 mb-1 w-56 p-2">
              <div className="grid grid-cols-10 gap-1">
                {EMOJI_LIST.map((emoji, i) => (
                  <button key={i} type="button" onClick={() => insertEmoji(emoji)} className="flex h-5 w-5 items-center justify-center rounded-[0.7rem] hover:bg-zinc-100 dark:hover:bg-white/8 text-sm">
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-between items-center mt-2">
          <button
            type="button"
            onClick={() => setShowEmoji(!showEmoji)}
            className="rounded-full border border-zinc-200 bg-zinc-50 p-1.5 text-slate-500 hover:bg-zinc-100 hover:text-slate-700 touch-feedback dark:border-white/8 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            title={tt('插入表情', 'Insert emoji')}
          >
            <Smile size={16} />
          </button>
          <button
            onClick={handleSubmit}
            disabled={!replyText.trim() || submitting}
            className="flex items-center gap-1 rounded-full bg-endfield-yellow px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-black touch-feedback disabled:opacity-50 whitespace-normal text-center leading-tight"
          >
            <Send size={12} />
            {submitting ? tt('发送中...', 'Sending...') : tt('发送', 'Send')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MobileTicketView;
