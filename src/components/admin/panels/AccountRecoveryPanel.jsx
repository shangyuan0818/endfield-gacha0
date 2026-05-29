import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Eye,
  KeyRound,
  Mail,
  RefreshCw,
  Search,
  ShieldAlert
} from 'lucide-react';
import { ACCOUNT_RECOVERY_QQ_GROUP } from '../../../constants/community';
import {
  getPrimaryAccountPasswordError,
  validateAccountPassword,
} from '../../../utils/authSecurity.js';
import VirtualizedList from '../VirtualizedList';

const STATUS_META = {
  pending: { label: '待处理', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  processing: { label: '处理中', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  verified: { label: '已核验', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  rejected: { label: '已拒绝', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  closed: { label: '已关闭', className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400' }
};

const REQUEST_TYPE_META = {
  password_reset: { label: '恢复登录', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  delete_account: { label: '注销旧账号', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
};

const DELIVERY_CHANNEL_META = {
  manual: '人工处理',
  mail_outbox: '邮件队列',
  disabled: '暂停发送',
};

const NEXT_STEP_META = {
  manual_review_pending: '等待人工核验',
  temporary_password_issued_force_change: '临时密码已发放，等待用户改密',
  mail_reset_queued: '重置邮件已入队',
  mail_reset_sent: '重置邮件已发送',
  mail_reset_failed: '重置邮件失败，需人工处理',
};

const AUDIT_EVENT_META = {
  request_received: '提交申请',
  temporary_password_issued: '发放临时密码',
};

function formatTime(value) {
  if (!value) {
    return '未知';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '未知';
  }

  return date.toLocaleString('zh-CN');
}

function normalizeRecoveryAudit(rawAudit) {
  if (!rawAudit) {
    return null;
  }

  if (typeof rawAudit === 'string') {
    try {
      return JSON.parse(rawAudit);
    } catch {
      return null;
    }
  }

  return typeof rawAudit === 'object' ? rawAudit : null;
}

function getLatestAuditEvents(rawAudit) {
  const audit = normalizeRecoveryAudit(rawAudit);
  const events = Array.isArray(audit?.events) ? audit.events : [];
  return events.slice(-3).reverse();
}

function formatAuditEventLabel(event) {
  if (!event || typeof event !== 'object') {
    return '未知事件';
  }

  return AUDIT_EVENT_META[event.type] || event.type || '未知事件';
}

function getDeliveryChannelLabel(value) {
  return DELIVERY_CHANNEL_META[value] || value || '未知';
}

function getNextStepLabel(value) {
  return NEXT_STEP_META[value] || value || '未知';
}

function hasTemporaryPasswordMetadata(request) {
  return Boolean(
    request?.temporary_password_set_at
    || request?.temporary_password_expires_at
    || request?.temporary_password_force_change
  );
}

function getTemporaryPasswordValidationMessage(password) {
  const validation = validateAccountPassword(password);
  if (validation.isValid) {
    return null;
  }

  switch (getPrimaryAccountPasswordError(validation)) {
    case 'required':
    case 'too_short':
      return '临时密码至少需要 8 位字符';
    case 'too_long':
      return '临时密码长度不能超过 100 位';
    case 'too_simple':
      return '临时密码需要至少包含两类字符，例如字母和数字';
    default:
      return '临时密码不符合安全要求';
  }
}

export default function AccountRecoveryPanel({
  requests,
  actionLoading,
  onInspectUser,
  onRefresh,
  onResetPassword,
  onUpdateRequest
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [draftNotes, setDraftNotes] = useState({});
  const [draftPasswords, setDraftPasswords] = useState({});

  const filteredRequests = useMemo(() => (
    requests.filter((request) => {
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      const keyword = searchQuery.trim().toLowerCase();
      const matchesSearch = !keyword
        || String(request.email || '').toLowerCase().includes(keyword)
        || String(request.note || '').toLowerCase().includes(keyword)
        || (request.verification_claims || []).some((claim) => (
          String(claim?.gameUid || '').toLowerCase().includes(keyword)
          || String(claim?.nickName || '').toLowerCase().includes(keyword)
        ));

      return matchesStatus && matchesSearch;
    })
  ), [requests, searchQuery, statusFilter]);

  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((item) => item.status === 'pending').length,
    processing: requests.filter((item) => item.status === 'processing').length,
    verified: requests.filter((item) => item.status === 'verified').length
  }), [requests]);

  const updateStatus = (request, nextStatus) => {
    onUpdateRequest(request, {
      status: nextStatus,
      admin_note: draftNotes[request.id] ?? request.admin_note ?? ''
    });
  };

  const handleResetPassword = (request) => {
    const temporaryPassword = String(draftPasswords[request.id] || '').trim();
    const passwordError = getTemporaryPasswordValidationMessage(temporaryPassword);
    if (passwordError) {
      window.alert(passwordError);
      return;
    }

    if (!window.confirm('确认要为该账号设置临时密码吗？请仅通过已确认身份的线下渠道告知用户。')) {
      return;
    }

    onResetPassword(request, temporaryPassword, draftNotes[request.id] ?? request.admin_note ?? '');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '总申请', value: stats.total, icon: Mail },
          { label: '待处理', value: stats.pending, icon: Clock3 },
          { label: '处理中', value: stats.processing, icon: ShieldAlert },
          { label: '已核验', value: stats.verified, icon: CheckCircle2 }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{item.label}</span>
                <Icon size={16} className="text-zinc-400" />
              </div>
              <div className="mt-3 text-2xl font-bold text-zinc-800 dark:text-zinc-100">{item.value}</div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索邮箱、UID 或昵称..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
        >
          <option value="all">全部状态</option>
          <option value="pending">待处理</option>
          <option value="processing">处理中</option>
          <option value="verified">已核验</option>
          <option value="rejected">已拒绝</option>
          <option value="closed">已关闭</option>
        </select>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-sm font-medium"
        >
          <RefreshCw size={16} />
          刷新
        </button>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="p-12 text-center border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400">
          暂无符合条件的恢复申请
        </div>
      ) : (
        <VirtualizedList
          items={filteredRequests}
          getKey={(request) => request.id}
          itemHeight={580}
          maxHeight={780}
          className="space-y-3"
          renderItem={(request) => {
            const statusMeta = STATUS_META[request.status] || STATUS_META.pending;
            const typeMeta = REQUEST_TYPE_META[request.request_type] || REQUEST_TYPE_META.password_reset;
            const auditEvents = getLatestAuditEvents(request.recovery_audit);
            const forceChangeRequired = Boolean(request.temporary_password_force_change);

            return (
              <div key={request.id} className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-zinc-800 dark:text-zinc-100">{request.email}</span>
                      <span className={`text-[11px] px-2 py-1 font-bold ${typeMeta.className}`}>{typeMeta.label}</span>
                      <span className={`text-[11px] px-2 py-1 font-bold ${statusMeta.className}`}>{statusMeta.label}</span>
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      提交于 {formatTime(request.created_at)}
                      {request.handled_at ? ` · 最近处理于 ${formatTime(request.handled_at)}` : ''}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      申报账号数：{request.claimed_account_count || 0}
                      {request.handlerProfile?.username ? ` · 处理人：${request.handlerProfile.username}` : ''}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      匹配用户：{request.matched_user_id ? (
                        <span className="font-mono">{request.matched_user_id}</span>
                      ) : '未匹配'}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-2 py-1 text-zinc-500 dark:text-zinc-400">
                        通道：{getDeliveryChannelLabel(request.delivery_channel)}
                      </span>
                      <span className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-2 py-1 text-zinc-500 dark:text-zinc-400">
                        下一步：{getNextStepLabel(request.next_step)}
                      </span>
                      {forceChangeRequired && (
                        <span className="border border-amber-300 bg-amber-50 px-2 py-1 font-bold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                          登录后强制改密
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onInspectUser(request)}
                      disabled={!request.matched_user_id}
                      className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Eye size={14} />
                      查看账号数据
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
                  <div className="space-y-3">
                    <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">验证信息</p>
                      <div className="space-y-2">
                        {(request.verification_claims || []).map((claim, index) => (
                          <div key={`${request.id}-claim-${index}`} className="text-sm text-zinc-700 dark:text-zinc-300">
                            UID <span className="font-mono">{claim?.gameUid || '-'}</span>
                            {' · '}
                            昵称 <span className="font-mono">{claim?.nickName || '-'}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">补充说明</p>
                      <p className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                        {request.note || '无'}
                      </p>
                    </div>

                    <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">恢复流程状态</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                        <div>
                          <span className="text-zinc-400">处理通道：</span>
                          {getDeliveryChannelLabel(request.delivery_channel)}
                        </div>
                        <div>
                          <span className="text-zinc-400">下一步：</span>
                          {getNextStepLabel(request.next_step)}
                        </div>
                        <div>
                          <span className="text-zinc-400">临时密码：</span>
                          {hasTemporaryPasswordMetadata(request) ? '已设置' : '未设置'}
                        </div>
                        <div>
                          <span className="text-zinc-400">强制改密：</span>
                          {forceChangeRequired ? '是' : '否'}
                        </div>
                        <div>
                          <span className="text-zinc-400">设置时间：</span>
                          {formatTime(request.temporary_password_set_at)}
                        </div>
                        <div>
                          <span className="text-zinc-400">过期时间：</span>
                          {formatTime(request.temporary_password_expires_at)}
                        </div>
                      </div>
                      {forceChangeRequired && (
                        <div className="mt-2 border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                          用户下次登录后会在设置页看到强制改密提示。密码修改成功后，私有安全状态会被清除。
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                        超管备注
                      </label>
                      <textarea
                        value={draftNotes[request.id] ?? request.admin_note ?? ''}
                        onChange={(event) => setDraftNotes((prev) => ({
                          ...prev,
                          [request.id]: event.target.value
                        }))}
                        placeholder="记录核验结果、后续处理方式或驳回原因"
                        className="w-full min-h-[120px] px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => updateStatus(request, 'processing')}
                        disabled={actionLoading === request.id}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                      >
                        处理中
                      </button>
                      <button
                        onClick={() => updateStatus(request, 'verified')}
                        disabled={actionLoading === request.id}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                      >
                        标记已核验
                      </button>
                      <button
                        onClick={() => updateStatus(request, 'rejected')}
                        disabled={actionLoading === request.id}
                        className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                      >
                        驳回
                      </button>
                      <button
                        onClick={() => updateStatus(request, 'closed')}
                        disabled={actionLoading === request.id}
                        className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                      >
                        关闭
                      </button>
                    </div>

                    {request.request_type === 'password_reset' && request.matched_user_id && (
                      <div className="space-y-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3">
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          临时密码
                        </label>
                        <input
                          type="password"
                          value={draftPasswords[request.id] ?? ''}
                          onChange={(event) => setDraftPasswords((prev) => ({
                            ...prev,
                            [request.id]: event.target.value
                          }))}
                          placeholder="至少 8 位字符，包含两类字符"
                          className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 outline-none"
                        />
                        <button
                          onClick={() => handleResetPassword(request)}
                          disabled={actionLoading === `reset_password_${request.id}` || request.status !== 'verified'}
                          className="w-full px-3 py-2 bg-endfield-yellow hover:bg-yellow-400 text-black text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <KeyRound size={14} />
                          设置临时密码并关闭申请
                        </button>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          仅在“已核验”后启用。系统不会站内回传该密码，请引导用户加入 QQ 群 {ACCOUNT_RECOVERY_QQ_GROUP} 获取临时密码。
                        </div>
                      </div>
                    )}

                    <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">审计摘要</p>
                      {auditEvents.length > 0 ? (
                        <div className="space-y-2">
                          {auditEvents.map((event, index) => (
                            <div key={`${request.id}-audit-${index}`} className="border-l-2 border-zinc-300 dark:border-zinc-700 pl-2 text-[11px] leading-5 text-zinc-600 dark:text-zinc-300">
                              <div className="font-bold text-zinc-700 dark:text-zinc-200">
                                {formatAuditEventLabel(event)}
                                {Array.isArray(event.warnings) && event.warnings.length > 0 ? (
                                  <span className="ml-2 text-amber-600 dark:text-amber-300">
                                    {event.warnings.length} 条 warning
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-zinc-500 dark:text-zinc-400">
                                {formatTime(event.at)}
                                {event.expiresAt ? ` · 有效期至 ${formatTime(event.expiresAt)}` : ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          暂无结构化审计记录。
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1">
                      <div>当前版本不提供匿名用户的站内安全回传。</div>
                      <div>“已核验”表示超管已完成身份核查；若需恢复登录，请在核验后设置临时密码，并让用户加入 QQ 群 {ACCOUNT_RECOVERY_QQ_GROUP} 获取密码。</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
