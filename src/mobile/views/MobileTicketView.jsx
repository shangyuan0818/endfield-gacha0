import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Plus, Send, ChevronDown, ChevronUp, User, Shield, RefreshCw, X, Smile,
  AlertCircle, ChevronLeft
} from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';
import { supabase } from '../../supabaseClient';
import { attachPublicProfiles, loadPublicProfilesMap } from '../../services/publicProfileService';
import { getMobilePathForTab } from '../../constants/appRoutes';
import { ACCOUNT_RECOVERY_QQ_GROUP, ENGLISH_COMMUNITY_DISCORD_URL } from '../../constants/community';
import { getTicketPriorities, getTicketStatus, getTicketTypes } from '../../components/tickets/constants';
import { useI18n } from '../../i18n/index.js';

// 常用表情（精简版）
const EMOJI_LIST = [
  '😀', '😅', '😂', '😊', '😍', '🤔', '😏', '😭', '😱', '😤',
  '👍', '👎', '👌', '👏', '🙏', '💪', '❤️', '🔥', '✨', '🎉'
];

function MobileTicketView() {
  const navigate = useNavigate();
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
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

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
    const { error } = await supabase
      .from('tickets')
      .insert({ ...formData, user_id: user.id });
    if (!error) {
      setShowCreate(false);
      await loadTickets();
    }
  };

  // 更新状态
  const handleStatusChange = async (ticketId, newStatus) => {
    const updateData = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'resolved') updateData.resolved_by = user.id;
    const { error } = await supabase.from('tickets').update(updateData).eq('id', ticketId);
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
      <div className="px-4 py-8 text-center">
        <MessageSquare size={32} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
        <p className="text-xs text-zinc-500 uppercase tracking-widest">{tt('请先登录', 'Sign In Required')}</p>
        <p className="text-[11px] text-zinc-400 mt-2">{tt('登录后才能使用工单系统。', 'Sign in first to use the ticket system.')}</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* 返回 */}
      <button
        onClick={() => navigate(getMobilePathForTab('home'))}
        className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 touch-feedback -ml-1 hover:text-endfield-yellow transition-colors"
      >
        <ChevronLeft size={16} />
        <span className="text-xs font-bold uppercase tracking-wide">{tt('返回首页', 'Back Home')}</span>
      </button>

      <div className="bg-zinc-900 text-white p-4 border-l-4 border-endfield-yellow shadow-md">
        <h1 className="text-lg font-bold flex items-center gap-2 uppercase tracking-wide">
          <MessageSquare size={20} className="text-endfield-yellow" />
          {tt('工单反馈', 'Tickets')}
        </h1>
        <p className="text-[10px] text-zinc-400 mt-1 font-mono uppercase tracking-widest leading-tight">
          {userRole === 'super_admin'
            ? tt('系统管理与用户反馈', 'System Ops & Feedback')
            : userRole === 'admin'
              ? tt('用户支持与反馈升级', 'Support & Escalations')
              : tt('支持与反馈通道', 'Support Channel')}
        </p>
      </div>

      <div className="border border-blue-200 dark:border-blue-900/40 bg-blue-50/70 dark:bg-blue-950/20 px-3 py-3 text-[11px] text-blue-800 dark:text-blue-300 space-y-1">
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
        <div className="grid flex-1 grid-cols-2 gap-1.5">
          {[
            { key: 'all', label: `${tt('全部', 'All')} (${formatNumber(stats.total)})` },
            { key: 'my', label: `${tt('我的', 'Mine')} (${formatNumber(stats.my)})` },
            ...(isAdmin ? [{ key: 'pending', label: `${tt('待处理', 'Pending')} (${formatNumber(stats.pending)})` }] : [])
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`min-h-[40px] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-colors whitespace-normal text-center leading-tight ${
                filter === f.key
                  ? 'bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-800 dark:border-zinc-100'
                  : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={loadTickets}
            className="p-2 border border-zinc-200 dark:border-zinc-700 text-zinc-500 touch-feedback"
            title={tt('刷新', 'Refresh')}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="min-h-[40px] px-3 py-1.5 bg-endfield-yellow text-black text-[10px] font-bold uppercase tracking-wider touch-feedback flex items-center justify-center gap-1 whitespace-normal text-center leading-tight"
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
        <div className="text-center py-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertCircle size={32} className="mx-auto text-amber-500 mb-3" />
          <p className="text-xs text-amber-700 dark:text-amber-400 font-mono uppercase">{tt('工单功能尚未启用', 'Tickets Not Enabled')}</p>
        </div>
      ) : loading ? (
        <div className="text-center py-8">
          <RefreshCw size={20} className="animate-spin mx-auto text-zinc-400 mb-2" />
          <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">{tt('加载工单中...', 'Loading tickets...')}</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <MessageSquare size={32} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
          <p className="text-xs text-zinc-500 font-mono">
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 w-full max-h-[90vh] overflow-y-auto animate-slide-up border-t border-zinc-200 dark:border-zinc-700 shadow-2xl">
        <div className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-between items-center">
          <h3 className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2 uppercase tracking-wide text-sm">
            <Plus size={16} className="text-endfield-yellow" />
            {tt('新建工单', 'New Ticket')}
          </h3>
          <button onClick={onCancel} className="p-1 touch-feedback">
            <X size={18} className="text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="border border-blue-200 dark:border-blue-900/40 bg-blue-50/70 dark:bg-blue-950/20 px-3 py-3 text-[11px] text-blue-800 dark:text-blue-300 space-y-1">
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
                    className={`min-h-[64px] p-2 border flex flex-col items-center justify-center gap-1 touch-feedback transition-all ${
                      formData.type === key
                        ? `${config.color} border-current`
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700'
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
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:border-endfield-yellow outline-none"
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
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:border-endfield-yellow outline-none min-h-[120px] resize-none"
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
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:border-endfield-yellow outline-none"
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
              className="flex-1 min-h-[44px] py-3 text-xs font-bold text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 uppercase tracking-wider touch-feedback whitespace-normal text-center leading-tight"
            >
              {tt('取消', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || !formData.title.trim() || !formData.content.trim()}
              className="flex-1 min-h-[44px] py-3 bg-endfield-yellow text-black text-xs font-bold uppercase tracking-wider touch-feedback disabled:opacity-50 flex items-center justify-center gap-2 whitespace-normal text-center leading-tight"
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

function TicketCard({ ticket, userRole, currentUserId, expanded, onToggle, onStatusChange, onReply, locale, formatDateTime }) {
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
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <button onClick={onToggle} className="w-full p-3 text-left touch-feedback">
        <div className="flex items-start gap-3">
          <div className={`p-1.5 shrink-0 border ${typeConfig.color}`}>
            <TypeIcon size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-zinc-800 dark:text-zinc-100 break-words">{ticket.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[9px] px-1.5 py-0.5 font-bold ${statusConfig.color}`}>{statusConfig.label}</span>
              <span className="text-[9px] text-zinc-400 font-mono">
                {ticket.profiles?.username || tt('用户', 'User')}
              </span>
              <span className="text-[9px] text-zinc-400 font-mono">
                {formatDateTime(ticket.created_at, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            </div>
          </div>
          <div className="text-zinc-300 dark:text-zinc-600 shrink-0">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950">
            <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {ticket.content}
            </p>
          </div>

          {canManage && ticket.status !== 'closed' && (
            <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 flex gap-2 flex-wrap">
              {ticket.status === 'pending' && (
                <button
                  onClick={() => onStatusChange(ticket.id, 'processing')}
                  className="px-3 py-1.5 text-[10px] bg-blue-500 text-white font-bold uppercase touch-feedback whitespace-normal text-center leading-tight"
                >
                  {tt('开始处理', 'Start Review')}
                </button>
              )}
              {(ticket.status === 'pending' || ticket.status === 'processing') && (
                <>
                  <button
                    onClick={() => onStatusChange(ticket.id, 'resolved')}
                    className="px-3 py-1.5 text-[10px] bg-green-500 text-white font-bold uppercase touch-feedback whitespace-normal text-center leading-tight"
                  >
                    {tt('标记解决', 'Mark Resolved')}
                  </button>
                  <button
                    onClick={() => onStatusChange(ticket.id, 'rejected')}
                    className="px-3 py-1.5 text-[10px] bg-red-500 text-white font-bold uppercase touch-feedback whitespace-normal text-center leading-tight"
                  >
                    {tt('拒绝', 'Reject')}
                  </button>
                </>
              )}
              <button
                onClick={() => onStatusChange(ticket.id, 'closed')}
                className="px-3 py-1.5 text-[10px] bg-zinc-500 text-white font-bold uppercase touch-feedback whitespace-normal text-center leading-tight"
              >
                {tt('关闭', 'Close')}
              </button>
            </div>
          )}

          {ticket.status !== 'closed' && (isOwner || canManage) && (
            <ReplySection ticketId={ticket.id} currentUserId={currentUserId} onReply={onReply} formatDateTime={formatDateTime} />
          )}
        </div>
      )}
    </div>
  );
}

function ReplySection({ ticketId, currentUserId, onReply, formatDateTime }) {
  const { isEnglish } = useI18n();
  const tt = useCallback((zh, en) => (isEnglish ? en : zh), [isEnglish]);
  const [replies, setReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef(null);

  const loadReplies = useCallback(async () => {
    setLoadingReplies(true);
    try {
      const { data } = await supabase
        .from('ticket_replies')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (data) {
        const profilesMap = await loadPublicProfilesMap(data.map(reply => reply.user_id));
        setReplies(attachPublicProfiles(data, profilesMap));
      }
    } finally {
      setLoadingReplies(false);
    }
  }, [ticketId]);

  useEffect(() => {
    loadReplies();
  }, [loadReplies]);

  const handleSubmit = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('ticket_replies')
        .insert({ ticket_id: ticketId, user_id: currentUserId, content: replyText.trim() });
      if (!error) {
        setReplyText('');
        loadReplies();
        onReply?.();
      }
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
    <div className="border-t border-zinc-100 dark:border-zinc-800">
      {loadingReplies ? (
        <div className="p-3 text-center text-zinc-400 text-[10px] font-mono">{tt('加载回复中...', 'Loading replies...')}</div>
      ) : replies.length > 0 ? (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-60 overflow-y-auto">
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
                <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                  {reply.profiles?.username || tt('用户', 'User')}
                </span>
                <span className="text-[9px] text-zinc-400 font-mono">
                  {formatDateTime(reply.created_at, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 pl-7 whitespace-pre-wrap">
                {reply.content}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3 text-center text-zinc-400 text-[10px] font-mono">{tt('暂无回复', 'No replies yet')}</div>
      )}

      <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={tt('输入回复...', 'Write a reply...')}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs focus:border-endfield-yellow outline-none min-h-[48px] max-h-[96px] resize-none"
            rows={2}
          />
          {showEmoji && (
            <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-lg z-50 p-2 w-56">
              <div className="grid grid-cols-10 gap-1">
                {EMOJI_LIST.map((emoji, i) => (
                  <button key={i} type="button" onClick={() => insertEmoji(emoji)} className="w-5 h-5 flex items-center justify-center text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
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
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 touch-feedback"
            title={tt('插入表情', 'Insert emoji')}
          >
            <Smile size={16} />
          </button>
          <button
            onClick={handleSubmit}
            disabled={!replyText.trim() || submitting}
            className="px-4 py-1.5 bg-endfield-yellow text-black text-[10px] font-bold uppercase tracking-wider touch-feedback disabled:opacity-50 flex items-center gap-1 whitespace-normal text-center leading-tight"
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
