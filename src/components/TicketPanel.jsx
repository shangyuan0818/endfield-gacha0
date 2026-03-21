import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, MessageSquare, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { attachPublicProfiles, loadPublicProfilesMap } from '../services/publicProfileService';
import CreateTicketForm from './tickets/CreateTicketForm';
import TicketCard from './tickets/TicketCard';
import { TICKET_STATUS } from './tickets/constants';
import { ACCOUNT_RECOVERY_QQ_GROUP } from '../constants/community';

const TicketPanel = React.memo(({ user, userRole, showToast }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [tableExists, setTableExists] = useState(true);

  const loadTickets = useCallback(async () => {
    if (!user) return;

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
        } else {
          showToast?.('加载工单失败', 'error');
        }
        return;
      }

      setTableExists(true);
      const profilesMap = await loadPublicProfilesMap((data || []).map((ticket) => ticket.user_id));
      setTickets(attachPublicProfiles(data || [], profilesMap));
    } catch (error) {
      showToast?.(`加载工单失败：${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, user]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleCreateTicket = async (formData) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .insert({
          ...formData,
          user_id: user.id,
        });

      if (error) throw error;

      showToast?.('工单提交成功', 'success');
      setShowCreateForm(false);
      await loadTickets();
    } catch (error) {
      showToast?.(`提交工单失败：${error.message}`, 'error');
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString(),
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
      await loadTickets();
    } catch (error) {
      showToast?.(`更新失败：${error.message}`, 'error');
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (filter === 'my') return ticket.user_id === user?.id;
      if (filter === 'pending') return ticket.status === 'pending';
      return true;
    });
  }, [tickets, filter, user]);

  const stats = useMemo(() => ({
    total: tickets.length,
    pending: tickets.filter((ticket) => ticket.status === 'pending').length,
    my: tickets.filter((ticket) => ticket.user_id === user?.id).length,
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
      <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 border-l-4 border-endfield-yellow p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold flex items-center gap-3 font-mono tracking-tighter">
            <MessageSquare size={28} />
            工单反馈
          </h2>
          <p className="text-zinc-400 mt-1 text-xs tracking-widest uppercase">
            {userRole === 'super_admin'
              ? '系统管理与用户反馈'
              : userRole === 'admin'
                ? '用户支持与反馈升级'
                : '支持与反馈通道'}
          </p>
        </div>
      </div>

      <div className="border border-blue-200 dark:border-blue-900/40 bg-blue-50/70 dark:bg-blue-950/20 px-4 py-3 text-xs text-blue-800 dark:text-blue-300 space-y-1">
        <div>工单用于提交 Bug、数据异常、功能建议和使用问题。</div>
        <div>忘记密码请回登录弹窗使用“账号恢复”；已登录需要删除账号，请到设置页使用“注销账号”。</div>
        <div>请不要在工单中填写密码；若超管已设置临时密码，请加入 QQ 群 {ACCOUNT_RECOVERY_QQ_GROUP} 线下领取。</div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors border ${
              filter === 'all'
                ? 'bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
            }`}
          >
            全部 ({stats.total})
          </button>
          <button
            onClick={() => setFilter('my')}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors border ${
              filter === 'my'
                ? 'bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
            }`}
          >
            我的 ({stats.my})
          </button>
          {(userRole === 'admin' || userRole === 'super_admin') && (
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors border ${
                filter === 'pending'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
              }`}
            >
              待处理 ({stats.pending})
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadTickets}
            className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-sm transition-colors"
            title="刷新"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-endfield-yellow hover:bg-yellow-400 text-black text-xs font-bold uppercase tracking-wider rounded-sm transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            新建工单
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
          <div className="relative z-10">
            <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-4 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <Plus size={20} className="text-endfield-yellow" />
              新建工单
            </h3>
            <CreateTicketForm
              userRole={userRole}
              onSubmit={handleCreateTicket}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        </div>
      )}

      {!tableExists ? (
        <div className="text-center py-12 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-sm">
          <AlertCircle size={48} className="mx-auto text-amber-500 mb-4" />
          <h3 className="font-bold text-amber-800 dark:text-amber-300 mb-2">工单功能尚未启用</h3>
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
            数据库中尚未创建工单表，请联系管理员执行数据库迁移。
          </p>
          <p className="text-xs text-amber-500 font-mono">Migration: 004_tickets_system.sql</p>
        </div>
      ) : loading ? (
        <div className="text-center py-12">
          <RefreshCw size={24} className="animate-spin mx-auto text-zinc-400 mb-2" />
          <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest">加载工单中...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm">
          <MessageSquare size={48} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-4 opacity-50" />
          <p className="text-zinc-500 font-mono text-sm">
            {filter === 'my' ? '无工单记录' : filter === 'pending' ? '无待处理工单' : '暂无工单'}
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
              showToast={showToast}
              onStatusChange={handleStatusChange}
              onReply={loadTickets}
              expanded={expandedTicketId === ticket.id}
              onToggle={() => setExpandedTicketId(expandedTicketId === ticket.id ? null : ticket.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
});

TicketPanel.displayName = 'TicketPanel';

export default TicketPanel;
