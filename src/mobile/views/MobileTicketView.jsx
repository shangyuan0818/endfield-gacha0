import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  MessageSquare, Plus, Send, ChevronDown, ChevronUp, User, Shield, RefreshCw, X, Smile,
  AlertCircle, Clipboard, RotateCcw
} from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';
import { attachPublicProfiles, loadPublicProfilesMap } from '../../services/publicProfileService';
import {
  createTicket,
  loadTicketReplies,
  loadTickets as loadTicketRows,
  reopenTicket,
  updateTicketStatus,
} from '../../services/ticketService.js';
import { loadTicketReplyWorkflowSummaries } from '../../services/ticketWorkflowService.js';
import { buildUsernameHandle } from '../../utils/usernameValidation.js';
import { ACCOUNT_RECOVERY_QQ_GROUP, ENGLISH_COMMUNITY_DISCORD_URL } from '../../constants/community';
import { getTicketPriorities, getTicketStatus, getTicketTypes } from '../../components/tickets/constants';
import { useI18n } from '../../i18n/index.js';
import { MobilePillTabs, MobileStickyHeader } from '../components/ux/MobilePrimitives.jsx';
import { buildTicketReplyNotification } from '../../utils/notificationModel.js';
import { submitTicketReply } from '../../services/ticketReplyService.js';
import {
  enrichTicketsWithWorkflow,
  filterTicketsByWorkflow,
  getTicketWorkflowCounts,
} from '../../utils/ticketWorkflow.js';
import {
  buildTicketDiagnostic,
  canReopenTicket,
  copyTextToClipboard,
  markTicketsViewed,
} from '../../utils/ticketSupportUtils.js';

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
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');

  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  // 加载工单
  const loadTickets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError('');
    try {
      const result = await loadTicketRows();
      if (result.tableExists === false) {
        setTableExists(false);
        setTickets([]);
        return;
      }

      setTableExists(true);
      const rows = Array.isArray(result.tickets) ? result.tickets : [];
      const [profilesMap, replySummaries] = await Promise.all([
        loadPublicProfilesMap(rows.map((ticket) => ticket.user_id)),
        loadTicketReplyWorkflowSummaries(rows.map((ticket) => ticket.id)),
      ]);
      const ticketsWithProfiles = attachPublicProfiles(rows, profilesMap);
      setTickets(enrichTicketsWithWorkflow(ticketsWithProfiles, {
        currentUserId: user?.id,
        currentUserRole: userRole,
        replySummaries,
      }));
    } catch (error) {
      setLoadError(`${tt('加载工单失败', 'Failed to load tickets')}: ${error?.message || tt('未知错误', 'Unknown error')}`);
    } finally {
      setLoading(false);
    }
  }, [tt, user, userRole]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  useEffect(() => {
    if (user) {
      markTicketsViewed();
    }
  }, [user]);

  // 创建工单
  const handleCreate = async (formData) => {
    setActionError('');
    try {
      await createTicket(formData);
      setShowCreate(false);
      await loadTickets();
    } catch (error) {
      setActionError(`${tt('提交工单失败', 'Failed to submit ticket')}: ${error?.message || tt('未知错误', 'Unknown error')}`);
      throw error;
    }
  };

  // 更新状态
  const handleStatusChange = async (ticketId, newStatus) => {
    setActionError('');
    try {
      await updateTicketStatus(ticketId, newStatus);
      await loadTickets();
    } catch (error) {
      setActionError(`${tt('更新失败', 'Update failed')}: ${error?.message || tt('未知错误', 'Unknown error')}`);
      throw error;
    }
  };

  const handleReopen = async (ticketId) => {
    setActionError('');
    try {
      await reopenTicket(ticketId);
      await loadTickets();
    } catch (error) {
      setActionError(`${tt('重新打开失败', 'Failed to reopen')}: ${error?.message || tt('未知错误', 'Unknown error')}`);
      throw error;
    }
  };

  // 过滤
  const filteredTickets = useMemo(() => {
    return filterTicketsByWorkflow(tickets, filter, user?.id);
  }, [tickets, filter, user]);

  const stats = useMemo(() => getTicketWorkflowCounts(tickets, user?.id), [tickets, user]);

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
    ...(isAdmin ? [
      { value: 'needs_staff', label: `${tt('需要处理', 'Needs Staff')} (${formatNumber(stats.needsStaff)})` },
      { value: 'waiting_user', label: `${tt('等待用户', 'Waiting User')} (${formatNumber(stats.waitingUser)})` },
    ] : [])
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

      {(loadError || actionError) && (
        <div className="mobile-ux-soft-card mobile-ux-soft-card--danger flex items-start gap-2 p-3 text-[11px] leading-relaxed text-red-700 dark:text-red-200">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            {loadError && <div>{loadError}</div>}
            {actionError && <div>{actionError}</div>}
          </div>
        </div>
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
              : filter === 'needs_staff'
                ? tt('没有需要处理的工单', 'No tickets need staff action')
                : filter === 'waiting_user'
                  ? tt('没有等待用户回复的工单', 'No tickets are waiting for users')
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
              onReopen={handleReopen}
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

function TicketCard({ ticket, userRole, currentUserId, expanded, onToggle, onStatusChange, onReopen, onReply, addDurableNotification, locale, formatDateTime }) {
  const { isEnglish } = useI18n();
  const tt = useCallback((zh, en) => (isEnglish ? en : zh), [isEnglish]);
  const ticketTypes = getTicketTypes(locale);
  const ticketStatus = getTicketStatus(locale);
  const typeConfig = ticketTypes[ticket.type] || ticketTypes.other;
  const statusConfig = ticketStatus[ticket.status] || ticketStatus.pending;
  const TypeIcon = typeConfig.icon;
  const isOwner = ticket.user_id === currentUserId;
  const canManage = userRole === 'super_admin' || (userRole === 'admin' && ticket.target_role === 'admin');
  const canReopen = isOwner && canReopenTicket(ticket);
  const publicReplyAllowed = ticket.status !== 'closed' && (isOwner || canManage);
  const internalNoteAllowed = canManage;

  const handleCopyDiagnostic = useCallback(async () => {
    const copied = await copyTextToClipboard(buildTicketDiagnostic(ticket));
    if (!copied) {
      // Mobile view has no toast channel here, so leave the action silent on success
      // and use the button title for the fallback affordance.
      window.alert?.(tt('复制失败，请长按手动复制页面信息。', 'Copy failed. Please copy the page details manually.'));
    }
  }, [ticket, tt]);

  return (
    <div className="mobile-ux-card overflow-hidden">
      <div className="w-full p-3 text-left">
        <div className="flex items-start gap-3">
          <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-start gap-3 text-left touch-feedback">
            <div className={`mobile-ux-card-chip p-1.5 shrink-0 ${typeConfig.color}`}>
              <TypeIcon size={14} />
            </div>
            <div className="min-w-0 flex-1">
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
              {ticket.workflow?.lastReplyAt && (
                <div className={`mt-1 text-[9px] font-mono ${
                  ticket.workflow?.needsStaffAttention
                    ? 'text-amber-600 dark:text-amber-300'
                    : ticket.workflow?.waitingForUser
                      ? 'text-sky-600 dark:text-sky-300'
                      : 'text-slate-500 dark:text-zinc-400'
                }`}>
                  {ticket.workflow?.needsStaffAttention
                    ? tt('用户有新回复', 'User replied')
                    : ticket.workflow?.waitingForUser
                      ? tt('等待用户回复', 'Waiting for user')
                      : tt('最后回复', 'Last reply')}
                  {' · '}
                  {formatDateTime(ticket.workflow.lastReplyAt, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                </div>
              )}
            </div>
          </button>
          <div className="flex shrink-0 items-center gap-1 text-slate-400 dark:text-zinc-600">
            <button
              type="button"
              onClick={handleCopyDiagnostic}
              className="rounded-full border border-zinc-200 bg-zinc-50 p-1.5 text-slate-500 touch-feedback dark:border-white/8 dark:bg-white/5 dark:text-zinc-400"
              title={tt('复制诊断', 'Copy diagnostics')}
            >
              <Clipboard size={14} />
            </button>
            <button
              type="button"
              onClick={onToggle}
              className="rounded-full p-1.5 touch-feedback"
              title={expanded ? tt('收起', 'Collapse') : tt('展开', 'Expand')}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="border-t border-zinc-200 dark:border-white/8">
          <div className="bg-zinc-50/75 p-3 dark:bg-white/[0.03]">
            <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-300 whitespace-pre-wrap">
              {ticket.content}
            </p>
          </div>

          {canReopen && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-200 bg-amber-50/80 p-3 text-[10px] leading-relaxed text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
              <span>{tt('问题仍未解决时，可以重新打开工单并补充说明。', 'If the issue is still unresolved, reopen it and add details.')}</span>
              <button
                type="button"
                onClick={() => onReopen?.(ticket.id)}
                className="flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1.5 font-bold uppercase text-white touch-feedback"
              >
                <RotateCcw size={12} />
                {tt('重新打开', 'Reopen')}
              </button>
            </div>
          )}

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

          {(publicReplyAllowed || internalNoteAllowed) && (
            <ReplySection
              ticketId={ticket.id}
              ticketStatus={ticket.status}
              authorRole={userRole}
              canManage={canManage}
              publicReplyAllowed={publicReplyAllowed}
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

function ReplySection({ ticketId, ticketStatus, authorRole, canManage, publicReplyAllowed, onReply, addDurableNotification, locale, formatDateTime }) {
  const { isEnglish } = useI18n();
  const tt = useCallback((zh, en) => (isEnglish ? en : zh), [isEnglish]);
  const [replies, setReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [replyMode, setReplyMode] = useState(publicReplyAllowed ? 'public' : 'internal');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!publicReplyAllowed && replyMode === 'public') {
      setReplyMode('internal');
    }
  }, [publicReplyAllowed, replyMode]);

  const loadReplies = useCallback(async () => {
    setLoadingReplies(true);
    try {
      const result = await loadTicketReplies(ticketId);
      const rows = Array.isArray(result.replies) ? result.replies : [];
      const profilesMap = await loadPublicProfilesMap(rows.map(reply => reply.user_id));
      setReplies(attachPublicProfiles(rows, profilesMap));
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
    const isInternal = canManage && replyMode === 'internal';
    try {
      const result = await submitTicketReply({
        ticketId,
        content: replyText.trim(),
        locale,
        isInternal,
      });
      const createdAt = result?.reply?.created_at || submittedAt;
      setReplyText('');
      if (!isInternal) {
        addDurableNotification?.(buildTicketReplyNotification({
          authorRole,
          ticketStatus,
          createdAt,
          dedupeKey: `ticket-reply:${createdAt}:${authorRole || 'user'}`
        }, { locale }));
      }
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
            <div key={reply.id} className={`p-3 ${reply.is_internal ? 'bg-amber-50/60 dark:bg-amber-500/10' : ''}`}>
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
                {reply.is_internal && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-100">
                    {tt('内部备注', 'Internal note')}
                  </span>
                )}
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
        {canManage && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!publicReplyAllowed}
              onClick={() => setReplyMode('public')}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase transition-colors ${
                replyMode === 'public'
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-100'
                  : 'border-zinc-200 bg-white text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-zinc-400'
              } disabled:opacity-40`}
            >
              {tt('公开回复', 'Public reply')}
            </button>
            <button
              type="button"
              onClick={() => setReplyMode('internal')}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase transition-colors ${
                replyMode === 'internal'
                  ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-100'
                  : 'border-zinc-200 bg-white text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-zinc-400'
              }`}
            >
              {tt('内部备注', 'Internal note')}
            </button>
            {replyMode === 'internal' && (
              <span className="text-[10px] leading-relaxed text-amber-700 dark:text-amber-200">
                {tt('仅管理员可见，不会通知用户。', 'Only staff can see this. Users are not notified.')}
              </span>
            )}
          </div>
        )}
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
            placeholder={replyMode === 'internal' ? tt('输入内部备注...', 'Write an internal note...') : tt('输入回复...', 'Write a reply...')}
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
            {submitting
              ? tt('处理中...', 'Saving...')
              : replyMode === 'internal'
                ? tt('保存备注', 'Save Note')
                : tt('发送', 'Send')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MobileTicketView;
