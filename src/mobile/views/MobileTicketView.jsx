import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Plus, Send, Clock, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, User, Shield, RefreshCw, Bug,
  Lightbulb, HelpCircle, Database, MoreHorizontal, X, Smile,
  AlertCircle, ChevronLeft
} from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';
import { supabase } from '../../supabaseClient';
import { attachPublicProfiles, loadPublicProfilesMap } from '../../services/publicProfileService';
import { getMobilePathForTab } from '../../constants/appRoutes';

// 工单类型
const TICKET_TYPES = {
  bug: { label: 'Bug', icon: Bug, color: 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
  feature: { label: '建议', icon: Lightbulb, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
  question: { label: '咨询', icon: HelpCircle, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  data_issue: { label: '数据', icon: Database, color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
  other: { label: '其他', icon: MoreHorizontal, color: 'text-zinc-500 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700' }
};

// 工单状态
const TICKET_STATUS = {
  pending: { label: '待处理', icon: Clock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
  processing: { label: '处理中', icon: RefreshCw, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  resolved: { label: '已解决', icon: CheckCircle2, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
  rejected: { label: '已拒绝', icon: XCircle, color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
  closed: { label: '已关闭', icon: X, color: 'text-zinc-600 bg-zinc-50 dark:bg-zinc-800' }
};

// 常用表情（精简版）
const EMOJI_LIST = [
  '😀', '😅', '😂', '😊', '😍', '🤔', '😏', '😭', '😱', '😤',
  '👍', '👎', '👌', '👏', '🙏', '💪', '❤️', '🔥', '✨', '🎉'
];

/**
 * 移动端工单视图 - 工业风 (中文)
 */
function MobileTicketView() {
  const navigate = useNavigate();
  const { user, userRole } = useAuthStore();

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
      } else {
        setTableExists(true);
        const profilesMap = await loadPublicProfilesMap((data || []).map(ticket => ticket.user_id));
        setTickets(attachPublicProfiles(data || [], profilesMap));
      }
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
      loadTickets();
    }
  };

  // 更新状态
  const handleStatusChange = async (ticketId, newStatus) => {
    const updateData = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'resolved') updateData.resolved_by = user.id;
    const { error } = await supabase.from('tickets').update(updateData).eq('id', ticketId);
    if (!error) loadTickets();
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
    pending: tickets.filter(t => t.status === 'pending').length,
    my: tickets.filter(t => t.user_id === user?.id).length
  }), [tickets, user]);

  if (!user) {
    return (
      <div className="px-4 py-8 text-center">
        <MessageSquare size={32} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
        <p className="text-xs text-zinc-500 uppercase tracking-widest">需要身份验证</p>
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
        <span className="text-xs font-bold uppercase tracking-wide">返回控制台</span>
      </button>

      {/* 标题 */}
      <div className="bg-zinc-900 text-white p-4 border-l-4 border-endfield-yellow shadow-md">
        <h1 className="text-lg font-bold flex items-center gap-2 uppercase tracking-wide">
          <MessageSquare size={20} className="text-endfield-yellow" />
          工单反馈
        </h1>
        <p className="text-[10px] text-zinc-400 mt-1 font-mono uppercase tracking-widest">
          Support & Feedback Channel
        </p>
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {[
            { key: 'all', label: `全部(${stats.total})` },
            { key: 'my', label: `我的(${stats.my})` },
            ...(isAdmin ? [{ key: 'pending', label: `待处理(${stats.pending})` }] : [])
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap transition-colors ${
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
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 bg-endfield-yellow text-black text-[10px] font-bold uppercase tracking-wider touch-feedback flex items-center gap-1"
          >
            <Plus size={12} />
            新建
          </button>
        </div>
      </div>

      {/* 创建表单弹窗 */}
      {showCreate && (
        <CreateForm
          userRole={userRole}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* 工单列表 */}
      {!tableExists ? (
        <div className="text-center py-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertCircle size={32} className="mx-auto text-amber-500 mb-3" />
          <p className="text-xs text-amber-700 dark:text-amber-400 font-mono uppercase">工单功能尚未启用</p>
        </div>
      ) : loading ? (
        <div className="text-center py-8">
          <RefreshCw size={20} className="animate-spin mx-auto text-zinc-400 mb-2" />
          <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">加载中...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <MessageSquare size={32} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
          <p className="text-xs text-zinc-500 font-mono">
            {filter === 'my' ? '无工单记录' : filter === 'pending' ? '无待处理工单' : '暂无工单'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              userRole={userRole}
              currentUserId={user.id}
              expanded={expandedId === ticket.id}
              onToggle={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}
              onStatusChange={handleStatusChange}
              onReply={loadTickets}
            />
          ))}
        </div>
      )}

      {/* 底部留白 */}
      <div className="h-4" />
    </div>
  );
}

/**
 * 创建工单表单（全屏弹窗）
 */
function CreateForm({ userRole, onSubmit, onCancel }) {
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
        {/* 头部 */}
        <div className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-between items-center">
          <h3 className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2 uppercase tracking-wide text-sm">
            <Plus size={16} className="text-endfield-yellow" />
            新建工单
          </h3>
          <button onClick={onCancel} className="p-1 touch-feedback">
            <X size={18} className="text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* 类型 */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider">工单类型</label>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(TICKET_TYPES).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: key }))}
                    className={`p-2 border flex flex-col items-center gap-1 touch-feedback transition-all ${
                      formData.type === key
                        ? config.color + ' border-current'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="text-[9px] font-bold">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 标题 */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider">标题</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="简要描述您的问题..."
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:border-endfield-yellow outline-none"
              maxLength={100}
              required
            />
          </div>

          {/* 内容 */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider">详细描述</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="请详细描述您遇到的问题或建议..."
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:border-endfield-yellow outline-none min-h-[120px] resize-none"
              maxLength={2000}
              required
            />
            <div className="text-[10px] text-zinc-400 mt-1 text-right font-mono">{formData.content.length}/2000</div>
          </div>

          {/* 优先级 */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider">优先级</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:border-endfield-yellow outline-none"
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

          {/* 按钮 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 text-xs font-bold text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 uppercase tracking-wider touch-feedback"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || !formData.title.trim() || !formData.content.trim()}
              className="flex-1 py-3 bg-endfield-yellow text-black text-xs font-bold uppercase tracking-wider touch-feedback disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send size={14} />
              {submitting ? '提交中...' : '提交工单'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * 工单卡片
 */
function TicketCard({ ticket, userRole, currentUserId, expanded, onToggle, onStatusChange, onReply }) {
  const typeConfig = TICKET_TYPES[ticket.type] || TICKET_TYPES.other;
  const statusConfig = TICKET_STATUS[ticket.status] || TICKET_STATUS.pending;
  const StatusIcon = statusConfig.icon;
  const TypeIcon = typeConfig.icon;
  const isOwner = ticket.user_id === currentUserId;
  const canManage = userRole === 'super_admin' || (userRole === 'admin' && ticket.target_role === 'admin');

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* 头部（可点击展开） */}
      <button onClick={onToggle} className="w-full p-3 text-left touch-feedback">
        <div className="flex items-start gap-3">
          <div className={`p-1.5 shrink-0 border ${typeConfig.color}`}>
            <TypeIcon size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-zinc-800 dark:text-zinc-100 truncate">{ticket.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[9px] px-1.5 py-0.5 font-bold ${statusConfig.color}`}>{statusConfig.label}</span>
              <span className="text-[9px] text-zinc-400 font-mono">
                {ticket.profiles?.username || '用户'}
              </span>
              <span className="text-[9px] text-zinc-400 font-mono">
                {new Date(ticket.created_at).toLocaleDateString()}
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
          {/* 工单内容 */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950">
            <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {ticket.content}
            </p>
          </div>

          {/* 管理操作 */}
          {canManage && ticket.status !== 'closed' && (
            <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 flex gap-2 flex-wrap">
              {ticket.status === 'pending' && (
                <button
                  onClick={() => onStatusChange(ticket.id, 'processing')}
                  className="px-3 py-1.5 text-[10px] bg-blue-500 text-white font-bold uppercase touch-feedback"
                >
                  开始处理
                </button>
              )}
              {(ticket.status === 'pending' || ticket.status === 'processing') && (
                <>
                  <button
                    onClick={() => onStatusChange(ticket.id, 'resolved')}
                    className="px-3 py-1.5 text-[10px] bg-green-500 text-white font-bold uppercase touch-feedback"
                  >
                    已解决
                  </button>
                  <button
                    onClick={() => onStatusChange(ticket.id, 'rejected')}
                    className="px-3 py-1.5 text-[10px] bg-red-500 text-white font-bold uppercase touch-feedback"
                  >
                    拒绝
                  </button>
                </>
              )}
              <button
                onClick={() => onStatusChange(ticket.id, 'closed')}
                className="px-3 py-1.5 text-[10px] bg-zinc-500 text-white font-bold uppercase touch-feedback"
              >
                关闭
              </button>
            </div>
          )}

          {/* 回复区域 */}
          {ticket.status !== 'closed' && (isOwner || canManage) && (
            <ReplySection ticketId={ticket.id} currentUserId={currentUserId} onReply={onReply} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 回复区域（懒加载回复列表 + 输入框）
 */
function ReplySection({ ticketId, currentUserId, onReply }) {
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
      {/* 回复列表 */}
      {loadingReplies ? (
        <div className="p-3 text-center text-zinc-400 text-[10px] font-mono">加载回复...</div>
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
                  {reply.profiles?.username || '用户'}
                </span>
                <span className="text-[9px] text-zinc-400 font-mono">
                  {new Date(reply.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 pl-7 whitespace-pre-wrap">
                {reply.content}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3 text-center text-zinc-400 text-[10px] font-mono">暂无回复</div>
      )}

      {/* 输入框 */}
      <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="输入回复..."
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
          >
            <Smile size={16} />
          </button>
          <button
            onClick={handleSubmit}
            disabled={!replyText.trim() || submitting}
            className="px-4 py-1.5 bg-endfield-yellow text-black text-[10px] font-bold uppercase tracking-wider touch-feedback disabled:opacity-50 flex items-center gap-1"
          >
            <Send size={12} />
            {submitting ? '发送中' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MobileTicketView;
