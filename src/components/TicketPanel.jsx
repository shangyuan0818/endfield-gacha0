import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckSquare, MessageSquare, Plus, RefreshCw, Square } from 'lucide-react';
import { attachPublicProfiles, loadPublicProfilesMap } from '../services/publicProfileService';
import {
  bulkUpdateTicketStatus,
  createTicket,
  loadTickets as loadTicketRows,
  reopenTicket,
  updateTicketStatus,
} from '../services/ticketService.js';
import { loadTicketReplyWorkflowSummaries } from '../services/ticketWorkflowService.js';
import CreateTicketForm from './tickets/CreateTicketForm';
import TicketCard from './tickets/TicketCard';
import { getTicketStatus } from './tickets/constants';
import { ACCOUNT_RECOVERY_QQ_GROUP, ENGLISH_COMMUNITY_DISCORD_URL } from '../constants/community';
import { useI18n } from '../i18n/index.js';
import {
  enrichTicketsWithWorkflow,
  filterTicketsByWorkflow,
  getTicketWorkflowCounts,
} from '../utils/ticketWorkflow.js';
import { markTicketsViewed } from '../utils/ticketSupportUtils.js';

const TicketPanel = React.memo(({ user, userRole, showToast, addDurableNotification }) => {
  const { isEnglish, locale, formatNumber } = useI18n();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [tableExists, setTableExists] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [selectedTicketIds, setSelectedTicketIds] = useState([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const ticketStatus = getTicketStatus(locale);
  const tt = useCallback((zh, en) => (isEnglish ? en : zh), [isEnglish]);
  const canUseAdminActions = userRole === 'admin' || userRole === 'super_admin';

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
      setLoadError(`${tt('加载工单失败', 'Failed to load tickets')}: ${error.message}`);
      showToast?.(`${tt('加载工单失败', 'Failed to load tickets')}: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, tt, user, userRole]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (user) {
      markTicketsViewed();
    }
  }, [user]);

  const handleCreateTicket = useCallback(async (formData) => {
    setActionError('');
    try {
      await createTicket(formData);
      showToast?.(tt('工单提交成功', 'Ticket submitted successfully'), 'success');
      setShowCreateForm(false);
      await loadTickets();
    } catch (error) {
      setActionError(`${tt('提交工单失败', 'Failed to submit ticket')}: ${error.message}`);
      showToast?.(`${tt('提交工单失败', 'Failed to submit ticket')}: ${error.message}`, 'error');
    }
  }, [loadTickets, showToast, tt]);

  const handleStatusChange = useCallback(async (ticketId, newStatus) => {
    setActionError('');
    try {
      await updateTicketStatus(ticketId, newStatus);
      showToast?.(
        `${tt('工单已更新为', 'Ticket updated to')} ${ticketStatus[newStatus]?.label || tt('已更新', 'updated')}`,
        'success'
      );
      await loadTickets();
    } catch (error) {
      setActionError(`${tt('更新失败', 'Update failed')}: ${error.message}`);
      showToast?.(`${tt('更新失败', 'Update failed')}: ${error.message}`, 'error');
    }
  }, [loadTickets, showToast, ticketStatus, tt]);

  const handleBulkStatusChange = useCallback(async (newStatus) => {
    if (selectedTicketIds.length === 0) return;
    setActionError('');
    setBulkUpdating(true);
    try {
      const result = await bulkUpdateTicketStatus(selectedTicketIds, newStatus);
      const updated = Number(result.meta?.updated || result.tickets?.length || 0);
      const denied = Number(result.meta?.denied || 0);
      showToast?.(
        denied > 0
          ? tt(`已更新 ${updated} 个工单，${denied} 个无权限`, `Updated ${updated} tickets; ${denied} denied`)
          : tt(`已更新 ${updated} 个工单`, `Updated ${updated} tickets`),
        denied > 0 ? 'warning' : 'success'
      );
      setSelectedTicketIds([]);
      await loadTickets();
    } catch (error) {
      setActionError(`${tt('批量更新失败', 'Bulk update failed')}: ${error.message}`);
      showToast?.(`${tt('批量更新失败', 'Bulk update failed')}: ${error.message}`, 'error');
    } finally {
      setBulkUpdating(false);
    }
  }, [loadTickets, selectedTicketIds, showToast, tt]);

  const handleReopenTicket = useCallback(async (ticketId) => {
    setActionError('');
    try {
      const result = await reopenTicket(ticketId);
      showToast?.(
        result.meta?.reopened === false
          ? tt('工单仍在处理中', 'Ticket is already active')
          : tt('工单已重新打开', 'Ticket reopened'),
        'success'
      );
      await loadTickets();
    } catch (error) {
      setActionError(`${tt('重新打开失败', 'Failed to reopen')}: ${error.message}`);
      showToast?.(`${tt('重新打开失败', 'Failed to reopen')}: ${error.message}`, 'error');
    }
  }, [loadTickets, showToast, tt]);

  const filteredTickets = useMemo(() => {
    return filterTicketsByWorkflow(tickets, filter, user?.id);
  }, [tickets, filter, user]);

  const stats = useMemo(() => getTicketWorkflowCounts(tickets, user?.id), [tickets, user]);
  const selectableTicketIds = useMemo(() => {
    if (!canUseAdminActions) return [];
    return filteredTickets
      .filter((ticket) => userRole === 'super_admin' || (userRole === 'admin' && ticket.target_role === 'admin'))
      .map((ticket) => ticket.id)
      .filter(Boolean);
  }, [canUseAdminActions, filteredTickets, userRole]);
  const selectedVisibleCount = selectedTicketIds.filter((id) => selectableTicketIds.includes(id)).length;
  const allVisibleSelected = selectableTicketIds.length > 0 && selectedVisibleCount === selectableTicketIds.length;

  const toggleTicketSelection = useCallback((ticketId, checked) => {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(ticketId);
      } else {
        next.delete(ticketId);
      }
      return Array.from(next);
    });
  }, []);

  const toggleVisibleSelection = useCallback(() => {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        selectableTicketIds.forEach((id) => next.delete(id));
      } else {
        selectableTicketIds.forEach((id) => next.add(id));
      }
      return Array.from(next);
    });
  }, [allVisibleSelected, selectableTicketIds]);

  if (!user) {
    return (
      <div className="text-center py-12">
        <MessageSquare size={48} className="mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500">{tt('请先登录以使用工单功能', 'Log in to use tickets')}</p>
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
            {tt('工单反馈', 'Tickets')}
          </h2>
          <p className="text-zinc-400 mt-1 text-xs tracking-widest uppercase leading-tight">
            {userRole === 'super_admin'
              ? tt('系统管理与用户反馈', 'System operations & user feedback')
              : userRole === 'admin'
                ? tt('用户支持与反馈升级', 'User support & escalations')
                : tt('支持与反馈通道', 'Support & feedback channel')}
          </p>
        </div>
      </div>

      <div className="border border-blue-200 dark:border-blue-900/40 bg-blue-50/70 dark:bg-blue-950/20 px-4 py-3 text-xs text-blue-800 dark:text-blue-300 space-y-1">
        <div>{tt('工单用于提交 Bug、数据异常、功能建议和使用问题。', 'Use tickets for bugs, data anomalies, feature requests, and usage questions.')}</div>
        <div>{tt('忘记密码请回登录弹窗使用“账号恢复”；已登录需要删除账号，请到设置页使用“注销账号”。', 'Use Account Recovery in the login modal if you forgot your password. To delete an existing account, go to Settings > Delete Account.')}</div>
        <div>
          {isEnglish ? (
            <>
              Do not put passwords into tickets. If a temporary password has been approved, join
              {' '}
              <a href={ENGLISH_COMMUNITY_DISCORD_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                Discord
              </a>
              {' '}
              to receive it.
            </>
          ) : (
            <>请不要在工单中填写密码；若超管已设置临时密码，请加入 QQ 群 {ACCOUNT_RECOVERY_QQ_GROUP} 线下领取。</>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`min-h-[40px] px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors border whitespace-normal text-center leading-tight ${
              filter === 'all'
                ? 'bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
            }`}
          >
            {tt('全部', 'All')} ({formatNumber(stats.total)})
          </button>
          <button
            onClick={() => setFilter('my')}
            className={`min-h-[40px] px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors border whitespace-normal text-center leading-tight ${
              filter === 'my'
                ? 'bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
            }`}
          >
            {tt('我的', 'Mine')} ({formatNumber(stats.my)})
          </button>
          {(userRole === 'admin' || userRole === 'super_admin') && (
            <>
              <button
                onClick={() => setFilter('needs_staff')}
                className={`min-h-[40px] px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors border whitespace-normal text-center leading-tight ${
                  filter === 'needs_staff'
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                {tt('需要处理', 'Needs Staff')} ({formatNumber(stats.needsStaff)})
              </button>
              <button
                onClick={() => setFilter('waiting_user')}
                className={`min-h-[40px] px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors border whitespace-normal text-center leading-tight ${
                  filter === 'waiting_user'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                {tt('等待用户', 'Waiting User')} ({formatNumber(stats.waitingUser)})
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadTickets}
            className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-sm transition-colors"
            title={tt('刷新', 'Refresh')}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="min-h-[40px] px-4 py-2 bg-endfield-yellow hover:bg-yellow-400 text-black text-xs font-bold uppercase tracking-wider rounded-sm transition-colors flex items-center justify-center gap-2 whitespace-normal text-center leading-tight"
          >
            <Plus size={16} />
            {tt('新建工单', 'New Ticket')}
          </button>
        </div>
      </div>

      {(loadError || actionError) && (
        <div className="border border-red-200 dark:border-red-900/40 bg-red-50/80 dark:bg-red-950/20 px-4 py-3 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            {loadError && <div>{loadError}</div>}
            {actionError && <div>{actionError}</div>}
          </div>
        </div>
      )}

      {canUseAdminActions && selectableTicketIds.length > 0 && (
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={toggleVisibleSelection}
            className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
          >
            {allVisibleSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            {tt('选择当前列表', 'Select visible')} ({formatNumber(selectedVisibleCount)}/{formatNumber(selectableTicketIds.length)})
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {tt('批量状态', 'Bulk status')}
            </span>
            {['processing', 'resolved', 'closed'].map((status) => (
              <button
                key={status}
                type="button"
                disabled={selectedTicketIds.length === 0 || bulkUpdating}
                onClick={() => handleBulkStatusChange(status)}
                className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 disabled:opacity-50"
              >
                {ticketStatus[status]?.label || status}
              </button>
            ))}
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
          <div className="relative z-10">
            <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-4 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <Plus size={20} className="text-endfield-yellow" />
              {tt('新建工单', 'New Ticket')}
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
          <h3 className="font-bold text-amber-800 dark:text-amber-300 mb-2">{tt('工单功能尚未启用', 'Tickets Are Not Enabled')}</h3>
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
            {tt('数据库中尚未创建工单表，请联系管理员执行数据库迁移。', 'The ticket tables are missing in the database. Ask an administrator to run the migration.')}
          </p>
          <p className="text-xs text-amber-500 font-mono">Migration: 004_tickets_system.sql</p>
        </div>
      ) : loading ? (
        <div className="text-center py-12">
          <RefreshCw size={24} className="animate-spin mx-auto text-zinc-400 mb-2" />
          <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest">{tt('加载工单中...', 'Loading tickets...')}</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm">
          <MessageSquare size={48} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-4 opacity-50" />
          <p className="text-zinc-500 font-mono text-sm">
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
              showToast={showToast}
              addDurableNotification={addDurableNotification}
              onStatusChange={handleStatusChange}
              onReopen={handleReopenTicket}
              onReply={loadTickets}
              expanded={expandedTicketId === ticket.id}
              onToggle={() => setExpandedTicketId(expandedTicketId === ticket.id ? null : ticket.id)}
              selectable={canUseAdminActions && selectableTicketIds.includes(ticket.id)}
              selected={selectedTicketIds.includes(ticket.id)}
              onSelectionChange={toggleTicketSelection}
            />
          ))}
        </div>
      )}
    </div>
  );
});

TicketPanel.displayName = 'TicketPanel';

export default TicketPanel;
