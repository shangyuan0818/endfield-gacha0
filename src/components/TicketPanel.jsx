import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  Plus,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  User,
  Shield,
  Filter,
  RefreshCw,
  Bug,
  Lightbulb,
  HelpCircle,
  Database,
  MoreHorizontal,
  X
} from 'lucide-react';
import { supabase } from '../supabaseClient';

// 工单类型配置
const TICKET_TYPES = {
  bug: { label: 'Bug反馈', icon: Bug, color: 'text-red-500 bg-red-50 border-red-200' },
  feature: { label: '功能建议', icon: Lightbulb, color: 'text-amber-500 bg-amber-50 border-amber-200' },
  question: { label: '使用咨询', icon: HelpCircle, color: 'text-blue-500 bg-blue-50 border-blue-200' },
  data_issue: { label: '数据问题', icon: Database, color: 'text-purple-500 bg-purple-50 border-purple-200' },
  other: { label: '其他', icon: MoreHorizontal, color: 'text-slate-500 bg-slate-50 border-slate-200' }
};

// 工单状态配置
const TICKET_STATUS = {
  pending: { label: '待处理', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  processing: { label: '处理中', icon: RefreshCw, color: 'text-blue-600 bg-blue-50' },
  resolved: { label: '已解决', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  rejected: { label: '已拒绝', icon: XCircle, color: 'text-red-600 bg-red-50' },
  closed: { label: '已关闭', icon: X, color: 'text-slate-600 bg-slate-50' }
};

// 优先级配置
const PRIORITY_CONFIG = {
  low: { label: '低', color: 'bg-slate-100 text-slate-600' },
  medium: { label: '中', color: 'bg-blue-100 text-blue-600' },
  high: { label: '高', color: 'bg-orange-100 text-orange-600' },
  urgent: { label: '紧急', color: 'bg-red-100 text-red-600' }
};

/**
 * 创建工单表单
 */
const CreateTicketForm = ({ userRole, onSubmit, onCancel }) => {
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
      {/* 类型选择 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
          工单类型
        </label>
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(TICKET_TYPES).map(([key, config]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, type: key }))}
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

      {/* 标题 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
          标题
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="简要描述您的问题..."
          className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          maxLength={100}
          required
        />
      </div>

      {/* 内容 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
          详细描述
        </label>
        <textarea
          value={formData.content}
          onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
          placeholder="请详细描述您遇到的问题或建议..."
          className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-none focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px] resize-none"
          maxLength={2000}
          required
        />
        <div className="text-xs text-slate-400 mt-1 text-right">
          {formData.content.length}/2000
        </div>
      </div>

      {/* 优先级（仅管理员可设置高优先级） */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
            优先级
          </label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
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

      {/* 按钮 */}
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
};

/**
 * 工单详情卡片
 */
const TicketCard = ({ ticket, userRole, currentUserId, onStatusChange, onReply, expanded, onToggle }) => {
  const [replyContent, setReplyContent] = useState('');
  const [replies, setReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);

  const typeConfig = TICKET_TYPES[ticket.type] || TICKET_TYPES.other;
  const statusConfig = TICKET_STATUS[ticket.status] || TICKET_STATUS.pending;
  const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
  const isOwner = ticket.user_id === currentUserId;
  const canManage = userRole === 'super_admin' || (userRole === 'admin' && ticket.target_role === 'admin');

  // 加载回复
  useEffect(() => {
    if (expanded && replies.length === 0) {
      loadReplies();
    }
  }, [expanded]);

  const loadReplies = async () => {
    setLoadingReplies(true);
    try {
      const { data, error } = await supabase
        .from('ticket_replies')
        .select(`
          *,
          profiles:user_id (username, role)
        `)
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setReplies(data);
      }
    } finally {
      setLoadingReplies(false);
    }
  };

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

      if (!error) {
        setReplyContent('');
        loadReplies();
        onReply?.();
      }
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none overflow-hidden">
      {/* 头部 */}
      <div
        onClick={onToggle}
        className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-950 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* 类型图标 */}
          <div className={`p-2 rounded-none ${typeConfig.color}`}>
            <typeConfig.icon size={18} />
          </div>

          {/* 主要信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="font-medium text-slate-800 dark:text-zinc-100 truncate">
                {ticket.title}
              </h4>
              <span className={`text-xs px-2 py-0.5 rounded-sm ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-sm ${priorityConfig.color}`}>
                {priorityConfig.label}
              </span>
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

          {/* 展开图标 */}
          <div className="text-slate-400">
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          {/* 工单内容 */}
          <div className="p-4 bg-slate-50 dark:bg-zinc-950">
            <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">
              {ticket.content}
            </p>
          </div>

          {/* 状态操作（仅管理员） */}
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

          {/* 回复列表 */}
          <div className="border-t border-zinc-100 dark:border-zinc-800">
            {loadingReplies ? (
              <div className="p-4 text-center text-slate-400">
                <RefreshCw size={16} className="animate-spin inline mr-2" />
                加载回复中...
              </div>
            ) : replies.length > 0 ? (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {replies.map(reply => (
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
                      <span className="text-xs text-slate-400">
                        {new Date(reply.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-zinc-400 pl-8 whitespace-pre-wrap">
                      {reply.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-slate-400 text-sm">
                暂无回复
              </div>
            )}
          </div>

          {/* 回复输入框 */}
          {ticket.status !== 'closed' && (isOwner || canManage) && (
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="输入回复内容..."
                  className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmitReply()}
                />
                <button
                  onClick={handleSubmitReply}
                  disabled={!replyContent.trim() || submittingReply}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-none transition-colors disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 工单面板主组件
 */
const TicketPanel = React.memo(({ user, userRole, showToast }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [filter, setFilter] = useState('all'); // all, my, pending

  // 工单表是否存在
  const [tableExists, setTableExists] = useState(true);

  // 加载工单
  const loadTickets = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('tickets')
        .select(`
          *,
          profiles:user_id (username, role)
        `)
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        // 检查是否是表不存在的错误
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.code === 'PGRST200') {
          console.warn('Tickets table not found, migration may be needed');
          setTableExists(false);
          setTickets([]);
        } else {
          console.error('Error loading tickets:', error);
          showToast?.('加载工单失败', 'error');
        }
      } else {
        setTableExists(true);
        setTickets(data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // 创建工单
  const handleCreateTicket = async (formData) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .insert({
          ...formData,
          user_id: user.id
        });

      if (error) throw error;

      showToast?.('工单提交成功', 'success');
      setShowCreateForm(false);
      loadTickets();
    } catch (error) {
      console.error('Error creating ticket:', error);
      showToast?.('提交工单失败：' + error.message, 'error');
    }
  };

  // 更新工单状态
  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'resolved') {
        updateData.resolved_by = user.id;
      }

      const { error } = await supabase
        .from('tickets')
        .update(updateData)
        .eq('id', ticketId);

      if (error) throw error;

      showToast?.(`工单已${TICKET_STATUS[newStatus]?.label || '更新'}`, 'success');
      loadTickets();
    } catch (error) {
      console.error('Error updating ticket:', error);
      showToast?.('更新失败：' + error.message, 'error');
    }
  };

  // 过滤工单
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      if (filter === 'my') return ticket.user_id === user?.id;
      if (filter === 'pending') return ticket.status === 'pending';
      return true;
    });
  }, [tickets, filter, user]);

  // 统计
  const stats = useMemo(() => ({
    total: tickets.length,
    pending: tickets.filter(t => t.status === 'pending').length,
    my: tickets.filter(t => t.user_id === user?.id).length
  }), [tickets, user]);

  if (!user) {
    return (
      <div className="text-center py-12">
        <MessageSquare size={48} className="mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500">请先登录以使用工单功能</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 页面标题 */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-none p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <MessageSquare size={28} />
          工单系统
        </h2>
        <p className="text-indigo-100 mt-1">
          {userRole === 'super_admin' ? '管理所有用户工单' :
           userRole === 'admin' ? '处理用户工单 / 向超管反馈' : '向管理员提交问题或建议'}
        </p>
      </div>

      {/* 操作栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-none transition-colors ${
              filter === 'all' ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
            }`}
          >
            全部 ({stats.total})
          </button>
          <button
            onClick={() => setFilter('my')}
            className={`px-3 py-1.5 text-sm rounded-none transition-colors ${
              filter === 'my' ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
            }`}
          >
            我的 ({stats.my})
          </button>
          {(userRole === 'admin' || userRole === 'super_admin') && (
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 text-sm rounded-none transition-colors ${
                filter === 'pending' ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
              }`}
            >
              待处理 ({stats.pending})
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadTickets}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-none transition-colors"
            title="刷新"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-none transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            新建工单
          </button>
        </div>
      </div>

      {/* 创建工单表单 */}
      {showCreateForm && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none p-6">
          <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
            <Plus size={20} />
            新建工单
          </h3>
          <CreateTicketForm
            userRole={userRole}
            onSubmit={handleCreateTicket}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {/* 工单列表 */}
      {!tableExists ? (
        <div className="text-center py-12 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-none">
          <AlertCircle size={48} className="mx-auto text-amber-500 mb-4" />
          <h3 className="font-bold text-amber-800 dark:text-amber-300 mb-2">工单功能尚未启用</h3>
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
            数据库中尚未创建工单表，请联系管理员执行数据库迁移。
          </p>
          <p className="text-xs text-amber-500 font-mono">
            Migration: 004_tickets_system.sql
          </p>
        </div>
      ) : loading ? (
        <div className="text-center py-12">
          <RefreshCw size={24} className="animate-spin mx-auto text-indigo-500 mb-2" />
          <p className="text-slate-500">加载中...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none">
          <MessageSquare size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">
            {filter === 'my' ? '您还没有提交过工单' :
             filter === 'pending' ? '没有待处理的工单' : '暂无工单'}
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
              onStatusChange={handleStatusChange}
              onReply={loadTickets}
              expanded={expandedTicketId === ticket.id}
              onToggle={() => setExpandedTicketId(
                expandedTicketId === ticket.id ? null : ticket.id
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
});

TicketPanel.displayName = 'TicketPanel';

export default TicketPanel;
