import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Copy,
  Globe,
  KeyRound,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Users,
} from 'lucide-react';
import {
  deleteApiClientKey,
  loadApiClients,
  revokeApiClientKey,
  reviewApiClient,
  rotateApiClientKey,
  rotateApiClientVerifier,
} from '../../../services/admin/developerApiService.js';
import { buildDeveloperApiReviewNotification } from '../../../utils/notificationModel.js';
import { useI18n } from '../../../i18n/index.js';
import VirtualizedList from '../VirtualizedList';
import { PanelSection, PanelToolbarButton, StatCard, StatusDot } from './shared/PanelUi.jsx';

const CLIENT_STATUS_META = {
  pending: {
    label: '待审核',
    dotTone: 'warning',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200',
  },
  active: {
    label: '已通过',
    dotTone: 'ok',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
  },
  rejected: {
    label: '已拒绝',
    dotTone: 'danger',
    badgeClass: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
  },
  revoked: {
    label: '已吊销',
    dotTone: 'unknown',
    badgeClass: 'border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400',
  },
};

const KEY_STATUS_LABEL = {
  active: '已启用',
  revoked: '已吊销',
};

function getStatusMeta(status, kind = 'client') {
  const meta = CLIENT_STATUS_META[status] || {
    label: status || '未知',
    dotTone: 'unknown',
    badgeClass: CLIENT_STATUS_META.revoked.badgeClass,
  };
  if (kind === 'key' && KEY_STATUS_LABEL[status]) {
    return { ...meta, label: KEY_STATUS_LABEL[status] };
  }
  return meta;
}

function StatusBadge({ status, kind = 'client' }) {
  const meta = getStatusMeta(status, kind);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider transition-colors ${meta.badgeClass}`}>
      <StatusDot tone={meta.dotTone} pulse={status === 'pending'} />
      {meta.label}
    </span>
  );
}

function formatDateTime(value) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', { hour12: false });
}

function getOwnerLabel(client) {
  return client.owner?.username || client.owner?.email || client.owner_user_id || '未知用户';
}

function getOwnerKey(client) {
  return client.owner?.id || client.owner_user_id || 'unknown';
}

function getReviewActionLabel(status) {
  switch (status) {
    case 'active':
      return '通过 / 启用';
    case 'rejected':
      return '拒绝';
    case 'revoked':
      return '撤销';
    default:
      return status || '审核';
  }
}

function getMailNotificationToast(notification) {
  switch (notification?.status) {
    case 'queued':
      return { message: '审核邮件通知已入队', type: 'success' };
    case 'deduped':
      return { message: '审核邮件通知已存在队列记录', type: 'success' };
    case 'disabled':
      return { message: '审核已完成；开发者 API 审核邮件通知未启用', type: 'warning' };
    case 'skipped':
      return { message: `审核已完成；邮件通知已跳过（${notification.code || 'skipped'}）`, type: 'warning' };
    case 'blocked':
      return { message: `审核已完成；邮件通知被发送策略拦截（${notification.code || 'blocked'}）`, type: 'warning' };
    case 'error':
      return { message: `审核已完成；邮件通知入队失败（${notification.code || 'error'}）`, type: 'warning' };
    default:
      return null;
  }
}

async function copyText(value) {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function KeyRow({ keyRow, actionLoading, onRevoke, onDelete, delay = 0 }) {
  return (
    <div
      className="animate-fade-in-up-small border border-zinc-100 bg-zinc-50 px-2.5 py-2 text-xs transition-colors hover:border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <KeyRound size={13} className="shrink-0 text-amber-500 dark:text-endfield-yellow" />
          <span className="truncate font-semibold text-slate-700 dark:text-zinc-200">{keyRow.label}</span>
        </div>
        <StatusBadge status={keyRow.status} kind="key" />
      </div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        Key 前缀（仅用于识别，不是完整密钥）
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-slate-600 dark:text-zinc-400">{keyRow.key_prefix}</div>
      <div className="mt-1 text-[11px] text-slate-500 dark:text-zinc-500">
        最近使用：{formatDateTime(keyRow.last_used_at)} · 创建：{formatDateTime(keyRow.created_at)}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {keyRow.status === 'active' ? (
          <PanelToolbarButton
            tone="danger"
            onClick={() => onRevoke(keyRow)}
            disabled={actionLoading === `revoke-key:${keyRow.id}`}
          >
            <ShieldOff size={12} />
            撤销此 Key
          </PanelToolbarButton>
        ) : null}
        <PanelToolbarButton
          tone="danger"
          onClick={() => onDelete(keyRow)}
          disabled={actionLoading === `delete-key:${keyRow.id}`}
        >
          <Trash2 size={12} />
          删除此 Key
        </PanelToolbarButton>
      </div>
    </div>
  );
}

export default function DeveloperApiPanel({ showToast, addDurableNotification }) {
  const { locale } = useI18n();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [secretNotice, setSecretNotice] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');

  const refresh = async () => {
    setLoading(true);
    try {
      const nextClients = await loadApiClients();
      setClients(nextClients);
    } catch (error) {
      showToast?.(`加载开发者 API 客户端失败：${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const developerClients = useMemo(
    () => clients.filter((client) => client.client_type === 'developer'),
    [clients]
  );
  const ownerOptions = useMemo(() => {
    const seen = new Set();
    return developerClients
      .map((client) => ({
        key: getOwnerKey(client),
        label: getOwnerLabel(client),
      }))
      .filter((owner) => {
        if (seen.has(owner.key)) return false;
        seen.add(owner.key);
        return true;
      });
  }, [developerClients]);
  const filteredDeveloperClients = useMemo(
    () => ownerFilter === 'all'
      ? developerClients
      : developerClients.filter((client) => getOwnerKey(client) === ownerFilter),
    [developerClients, ownerFilter]
  );
  const groupedDeveloperClients = useMemo(() => {
    const groups = new Map();
    filteredDeveloperClients.forEach((client) => {
      const ownerKey = getOwnerKey(client);
      if (!groups.has(ownerKey)) {
        groups.set(ownerKey, {
          key: ownerKey,
          label: getOwnerLabel(client),
          clients: [],
        });
      }
      groups.get(ownerKey).clients.push(client);
    });
    return [...groups.values()];
  }, [filteredDeveloperClients]);
  const officialBots = useMemo(
    () => clients.filter((client) => client.client_type === 'official_bot'),
    [clients]
  );

  const withRefresh = async (runner, successMessage) => {
    try {
      const result = await runner();
      await refresh();
      if (successMessage) {
        showToast?.(successMessage, 'success');
      }
      return result;
    } catch (error) {
      showToast?.(error.message || '操作失败', 'error');
      return null;
    }
  };

  const handleReview = async (clientId, status) => {
    const client = clients.find((item) => item.id === clientId);
    const actionLabel = getReviewActionLabel(status);
    const reviewNote = window.prompt(
      `请输入开发者 API ${actionLabel}备注。备注会展示给申请人，并写入审核记录；不应包含私密凭据。`,
      client?.review_note || ''
    );
    if (reviewNote === null) {
      return;
    }

    setActionLoading(`review:${clientId}:${status}`);
    const result = await withRefresh(
      () => reviewApiClient(clientId, status, reviewNote.trim()),
      status === 'active' ? '申请已通过' : status === 'rejected' ? '申请已拒绝' : '客户端已撤销'
    );
    if (result) {
      addDurableNotification?.(buildDeveloperApiReviewNotification({
        status,
        clientName: client?.name,
        clientType: client?.client_type,
        hasBootstrapKey: Boolean(result?.bootstrapKey?.secret),
      }, { locale }));
      const mailToast = getMailNotificationToast(result.mailNotification);
      if (mailToast) {
        showToast?.(mailToast.message, mailToast.type);
      }
    }
    if (result?.bootstrapKey?.secret) {
      setSecretNotice(`初始开发者 Key：${result.bootstrapKey.secret}`);
    }
    setActionLoading('');
  };

  const handleRotateKey = async (client) => {
    setActionLoading(`rotate-key:${client.id}`);
    const result = await withRefresh(
      () => rotateApiClientKey(client.id, `${client.client_type}-rotated`),
      '数据读取 Key 已轮换'
    );
    if (result?.key?.secret) {
      setSecretNotice(`新的 ${client.name} Key：${result.key.secret}`);
    }
    setActionLoading('');
  };

  const handleRevokeKey = async (keyRow) => {
    setActionLoading(`revoke-key:${keyRow.id}`);
    await withRefresh(
      () => revokeApiClientKey(keyRow.id),
      'API Key 已撤销'
    );
    setActionLoading('');
  };

  const handleDeleteKey = async (keyRow) => {
    const confirmed = window.confirm(`确认永久删除 Key 前缀 ${keyRow.key_prefix}？删除后不会保留在列表中。`);
    if (!confirmed) {
      return;
    }

    setActionLoading(`delete-key:${keyRow.id}`);
    await withRefresh(
      () => deleteApiClientKey(keyRow.id),
      'API Key 已删除'
    );
    setActionLoading('');
  };

  const handleRotateVerifier = async (client) => {
    setActionLoading(`rotate-verifier:${client.id}`);
    const result = await withRefresh(
      () => rotateApiClientVerifier(client.id),
      '绑定验证凭据已轮换'
    );
    if (result?.verifier?.secret) {
      setSecretNotice(`${client.provider} verifier：${result.verifier.secret}`);
    }
    setActionLoading('');
  };

  const pendingCount = developerClients.filter((client) => client.status === 'pending').length;
  const activeCount = developerClients.filter((client) => client.status === 'active').length;
  const rejectedCount = developerClients.filter((client) => client.status === 'rejected').length;
  const revokedCount = developerClients.filter((client) => client.status === 'revoked').length;

  return (
    <div className="space-y-3">
      <div className="animate-fade-in-up flex flex-wrap items-center justify-between gap-3 border border-zinc-200 bg-white px-3 py-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <span className="h-3 w-1 shrink-0 bg-amber-500 dark:bg-endfield-yellow" aria-hidden="true"></span>
          统一管理开发者申请、官方 Bot 只读 Key，以及 Discord / Telegram / QQ 的独立 verifier 凭据。
        </div>
        <PanelToolbarButton onClick={refresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          刷新
        </PanelToolbarButton>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard
          label="申请总数"
          value={developerClients.length}
          subtext={`已拒绝 ${rejectedCount} / 已吊销 ${revokedCount}`}
          delay={0}
        />
        <StatCard
          label="待审核"
          value={pendingCount}
          subtext="等待人工审核的开发者申请"
          tone={pendingCount > 0 ? 'warning' : 'default'}
          delay={40}
        />
        <StatCard
          label="已通过"
          value={activeCount}
          subtext="当前处于启用状态"
          tone={activeCount > 0 ? 'notice' : 'default'}
          delay={80}
        />
        <StatCard
          label="官方 Bot"
          value={officialBots.length}
          subtext="Discord / Telegram / QQ 客户端"
          delay={120}
        />
      </div>

      {secretNotice ? (
        <div className="animate-fade-in-up-small space-y-2 border border-l-4 border-amber-300 border-l-amber-500 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-endfield-yellow/40 dark:border-l-endfield-yellow dark:bg-endfield-yellow/5 dark:text-zinc-200">
          <div className="font-semibold uppercase tracking-wider text-amber-700 dark:text-endfield-yellow">一次性密钥输出</div>
          <div className="break-all font-mono">{secretNotice}</div>
          <button
            type="button"
            onClick={async () => {
              const copied = await copyText(secretNotice.replace(/^[^：]+：/, ''));
              showToast?.(copied ? '已复制密钥' : '复制失败', copied ? 'success' : 'error');
            }}
            className="inline-flex items-center gap-1.5 border border-amber-400/60 px-2 py-1 text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-endfield-yellow/40 dark:text-endfield-yellow dark:hover:bg-endfield-yellow/10"
          >
            <Copy size={12} />
            复制
          </button>
        </div>
      ) : null}

      <PanelSection title="开发者申请" icon={Globe} delay={100} bodyClassName="space-y-3 p-3">
        <div className="flex flex-col gap-2 border border-zinc-100 bg-zinc-50 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950/50 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
            <Users size={14} className="text-amber-500 dark:text-endfield-yellow" />
            多用户筛选
          </div>
          <select
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
            className="min-w-[14rem] border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none transition-colors focus:border-amber-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-endfield-yellow"
          >
            <option value="all">全部用户（{developerClients.length} 个申请）</option>
            {ownerOptions.map((owner) => (
              <option key={owner.key} value={owner.key}>
                {owner.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 border border-zinc-200 py-10 text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
              <RefreshCw size={18} className="animate-spin" />
              <span className="text-xs uppercase tracking-widest">正在读取开发者申请</span>
            </div>
          ) : filteredDeveloperClients.length === 0 ? (
            <div className="border border-dashed border-zinc-200 px-3 py-6 text-center text-xs text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
              当前没有开发者 API 申请。
            </div>
          ) : (
            <VirtualizedList
              items={groupedDeveloperClients}
              getKey={(group) => group.key}
              itemHeight={360}
              maxHeight={640}
              className="space-y-3"
              renderItem={(group) => (
                <div className="space-y-2.5 pb-3">
                  <div className="flex items-center gap-2 border-l-2 border-amber-500 pl-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-endfield-yellow dark:text-zinc-400">
                    <Users size={13} />
                    {group.label}
                  </div>
                  {group.clients.map((client, clientIndex) => (
                    <div
                      key={client.id}
                      className="animate-fade-in-up-small space-y-2.5 border border-zinc-200 bg-white p-2.5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-zinc-700"
                      style={{ animationDelay: `${Math.min(clientIndex, 6) * 40}ms` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold leading-tight text-slate-800 dark:text-zinc-100">{client.name}</div>
                          <div className="mt-1 break-words text-xs text-zinc-500 dark:text-zinc-400">{client.use_case}</div>
                          <div className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                            提交人：{getOwnerLabel(client)} · 创建于 {formatDateTime(client.created_at)}
                          </div>
                        </div>
                        <StatusBadge status={client.status} />
                      </div>

                      <div className="border border-zinc-100 bg-zinc-50/60 px-2.5 py-1.5 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
                        请求 scope：<span className="font-mono">{(client.requested_scopes || []).join(', ') || '无'}</span> · 已授予：<span className="font-mono">{(client.granted_scopes || []).join(', ') || '无'}</span>
                      </div>
                      {client.review_note ? (
                        <div className="border-l-2 border-amber-300 pl-2.5 text-[11px] text-zinc-500 dark:border-amber-700 dark:text-zinc-400">
                          审核备注：{client.review_note}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        {client.status === 'pending' ? (
                          <>
                            <PanelToolbarButton
                              tone="primary"
                              onClick={() => handleReview(client.id, 'active')}
                              disabled={actionLoading === `review:${client.id}:active`}
                            >
                              通过
                            </PanelToolbarButton>
                            <PanelToolbarButton
                              tone="danger"
                              onClick={() => handleReview(client.id, 'rejected')}
                              disabled={actionLoading === `review:${client.id}:rejected`}
                            >
                              拒绝
                            </PanelToolbarButton>
                          </>
                        ) : null}
                        {client.status === 'active' ? (
                          <PanelToolbarButton
                            tone="danger"
                            onClick={() => handleReview(client.id, 'revoked')}
                            disabled={actionLoading === `review:${client.id}:revoked`}
                          >
                            撤销应用
                          </PanelToolbarButton>
                        ) : null}
                        {client.status === 'rejected' || client.status === 'revoked' ? (
                          <PanelToolbarButton
                            onClick={() => handleReview(client.id, 'active')}
                            disabled={actionLoading === `review:${client.id}:active`}
                          >
                            重新启用
                          </PanelToolbarButton>
                        ) : null}
                        <PanelToolbarButton
                          onClick={() => handleRotateKey(client)}
                          disabled={actionLoading === `rotate-key:${client.id}` || client.status !== 'active'}
                        >
                          <RotateCw size={12} />
                          轮换完整 Key
                        </PanelToolbarButton>
                      </div>

                      {(client.keys || []).length > 0 ? (
                        <div className="space-y-2">
                          {(client.keys || []).map((keyRow, keyIndex) => (
                            <KeyRow
                              key={keyRow.id}
                              keyRow={keyRow}
                              actionLoading={actionLoading}
                              onRevoke={handleRevokeKey}
                              onDelete={handleDeleteKey}
                              delay={Math.min(keyIndex, 6) * 40}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            />
          )}
        </div>
      </PanelSection>

      <PanelSection title="官方 Bot 客户端" icon={Bot} delay={160}>
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
          {officialBots.map((client, botIndex) => (
            <div
              key={client.id}
              className="animate-fade-in-up-small space-y-2.5 border border-zinc-200 bg-white p-2.5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-zinc-700"
              style={{ animationDelay: `${Math.min(botIndex, 6) * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight text-slate-800 dark:text-zinc-100">{client.name}</div>
                  <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{client.provider}</div>
                </div>
                <StatusBadge status={client.status} />
              </div>

              <div className="space-y-1 border border-zinc-100 bg-zinc-50/60 px-2.5 py-1.5 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
                <div>scope：<span className="font-mono">{(client.granted_scopes || []).join(', ') || '无'}</span></div>
                <div>verifier 前缀：<span className="font-mono">{client.verifier_secret_prefix || '未配置'}</span></div>
                <div>verifier 最近使用：{formatDateTime(client.verifier_last_used_at)}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <PanelToolbarButton
                  onClick={() => handleRotateKey(client)}
                  disabled={actionLoading === `rotate-key:${client.id}`}
                >
                  <RotateCw size={12} />
                  轮换只读 Key
                </PanelToolbarButton>
                <PanelToolbarButton
                  tone="primary"
                  onClick={() => handleRotateVerifier(client)}
                  disabled={actionLoading === `rotate-verifier:${client.id}`}
                >
                  <ShieldCheck size={12} />
                  轮换 Verifier
                </PanelToolbarButton>
              </div>

              {(client.keys || []).length > 0 ? (
                <div className="space-y-2">
                  {(client.keys || []).map((keyRow, keyIndex) => (
                    <KeyRow
                      key={keyRow.id}
                      keyRow={keyRow}
                      actionLoading={actionLoading}
                      onRevoke={handleRevokeKey}
                      onDelete={handleDeleteKey}
                      delay={Math.min(keyIndex, 6) * 40}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </PanelSection>
    </div>
  );
}
