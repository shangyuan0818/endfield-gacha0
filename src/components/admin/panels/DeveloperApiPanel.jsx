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

function getStatusTone(status) {
  switch (status) {
    case 'active':
      return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300';
    case 'rejected':
      return 'border-red-400/30 bg-red-500/10 text-red-300';
    case 'revoked':
      return 'border-orange-400/30 bg-orange-500/10 text-orange-300';
    default:
      return 'border-zinc-700 bg-zinc-900/60 text-zinc-300';
  }
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

async function copyText(value) {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export default function DeveloperApiPanel({ showToast }) {
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
    setActionLoading(`review:${clientId}:${status}`);
    const result = await withRefresh(
      () => reviewApiClient(clientId, status, ''),
      status === 'active' ? '申请已通过' : status === 'rejected' ? '申请已拒绝' : '客户端已撤销'
    );
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500 dark:text-zinc-400">
          统一管理开发者申请、官方 Bot 只读 Key，以及 Discord / Telegram / QQ 的独立 verifier 凭据。
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 border border-zinc-300 dark:border-zinc-700 text-sm text-slate-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      {secretNotice ? (
        <div className="border border-endfield-yellow/40 bg-endfield-yellow/5 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200 space-y-2">
          <div className="font-bold text-endfield-yellow">一次性密钥输出</div>
          <div className="font-mono break-all">{secretNotice}</div>
          <button
            type="button"
            onClick={async () => {
              const copied = await copyText(secretNotice.replace(/^[^：]+：/, ''));
              showToast?.(copied ? '已复制密钥' : '复制失败', copied ? 'success' : 'error');
            }}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-endfield-yellow/40 text-endfield-yellow hover:bg-endfield-yellow/10 transition-colors"
          >
            <Copy size={12} />
            复制
          </button>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-zinc-300">
          <Globe size={16} className="text-endfield-yellow" />
          开发者申请
        </div>
        <div className="flex flex-col gap-2 border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950/50 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
            <Users size={14} className="text-endfield-yellow" />
            多用户筛选
          </div>
          <select
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
            className="min-w-[14rem] border border-zinc-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="all">全部用户（{developerClients.length} 个申请）</option>
            {ownerOptions.map((owner) => (
              <option key={owner.key} value={owner.key}>
                {owner.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-zinc-400">
              <RefreshCw size={18} className="animate-spin" />
            </div>
          ) : filteredDeveloperClients.length === 0 ? (
            <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 px-4 py-6 text-sm text-zinc-500">
              当前没有开发者 API 申请。
            </div>
          ) : groupedDeveloperClients.map((group) => (
            <div key={group.key} className="space-y-3">
              <div className="flex items-center gap-2 border-l-2 border-endfield-yellow pl-3 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <Users size={13} />
                {group.label}
              </div>
              {group.clients.map((client) => (
                <div key={client.id} className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/40 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 dark:text-zinc-100">{client.name}</div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 break-words">{client.use_case}</div>
                      <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        提交人：{getOwnerLabel(client)} · 创建于 {formatDateTime(client.created_at)}
                      </div>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusTone(client.status)}`}>
                      {client.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    请求 scope：{(client.requested_scopes || []).join(', ') || '无'} · 已授予：{(client.granted_scopes || []).join(', ') || '无'}
                  </div>
                  {client.review_note ? (
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      审核备注：{client.review_note}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {client.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleReview(client.id, 'active')}
                          disabled={actionLoading === `review:${client.id}:active`}
                          className="px-3 py-2 text-xs font-bold uppercase tracking-wider border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          通过
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReview(client.id, 'rejected')}
                          disabled={actionLoading === `review:${client.id}:rejected`}
                          className="px-3 py-2 text-xs font-bold uppercase tracking-wider border border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          拒绝
                        </button>
                      </>
                    ) : null}
                    {client.status === 'active' ? (
                      <button
                        type="button"
                        onClick={() => handleReview(client.id, 'revoked')}
                        disabled={actionLoading === `review:${client.id}:revoked`}
                        className="px-3 py-2 text-xs font-bold uppercase tracking-wider border border-orange-400/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 disabled:opacity-50"
                      >
                        撤销应用
                      </button>
                    ) : null}
                    {client.status === 'rejected' || client.status === 'revoked' ? (
                      <button
                        type="button"
                        onClick={() => handleReview(client.id, 'active')}
                        disabled={actionLoading === `review:${client.id}:active`}
                        className="px-3 py-2 text-xs font-bold uppercase tracking-wider border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        重新启用
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleRotateKey(client)}
                      disabled={actionLoading === `rotate-key:${client.id}` || client.status !== 'active'}
                      className="px-3 py-2 text-xs font-bold uppercase tracking-wider border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                    >
                      <RotateCw size={12} className="inline-block mr-1" />
                      轮换完整 Key
                    </button>
                  </div>

                  {(client.keys || []).length > 0 ? (
                    <div className="space-y-2">
                      {(client.keys || []).map((keyRow) => (
                        <div key={keyRow.id} className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2 text-xs">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <KeyRound size={13} className="text-endfield-yellow shrink-0" />
                              <span className="truncate font-semibold text-slate-700 dark:text-zinc-200">{keyRow.label}</span>
                            </div>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusTone(keyRow.status)}`}>
                              {keyRow.status}
                            </span>
                          </div>
                          <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Key 前缀（仅用于识别，不是完整密钥）</div>
                          <div className="mt-0.5 font-mono text-zinc-500">{keyRow.key_prefix}</div>
                          <div className="mt-1 text-zinc-500 dark:text-zinc-400">
                            最近使用：{formatDateTime(keyRow.last_used_at)} · 创建：{formatDateTime(keyRow.created_at)}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {keyRow.status === 'active' ? (
                              <button
                                type="button"
                                onClick={() => handleRevokeKey(keyRow)}
                                disabled={actionLoading === `revoke-key:${keyRow.id}`}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold uppercase tracking-wider border border-orange-400/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 disabled:opacity-50"
                              >
                                <ShieldOff size={12} />
                                撤销此 Key
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleDeleteKey(keyRow)}
                              disabled={actionLoading === `delete-key:${keyRow.id}`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold uppercase tracking-wider border border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                            >
                              <Trash2 size={12} />
                              删除此 Key
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-zinc-300">
          <Bot size={16} className="text-endfield-yellow" />
          官方 Bot 客户端
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          {officialBots.map((client) => (
            <div key={client.id} className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/40 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-800 dark:text-zinc-100">{client.name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">{client.provider}</div>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusTone(client.status)}`}>
                  {client.status}
                </span>
              </div>

              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                scope：{(client.granted_scopes || []).join(', ') || '无'}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                verifier 前缀：{client.verifier_secret_prefix || '未配置'}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                verifier 最近使用：{formatDateTime(client.verifier_last_used_at)}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleRotateKey(client)}
                  disabled={actionLoading === `rotate-key:${client.id}`}
                  className="px-3 py-2 text-xs font-bold uppercase tracking-wider border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  <RotateCw size={12} className="inline-block mr-1" />
                  轮换只读 Key
                </button>
                <button
                  type="button"
                  onClick={() => handleRotateVerifier(client)}
                  disabled={actionLoading === `rotate-verifier:${client.id}`}
                  className="px-3 py-2 text-xs font-bold uppercase tracking-wider border border-endfield-yellow/40 bg-endfield-yellow/10 text-endfield-yellow hover:bg-endfield-yellow/20 disabled:opacity-50"
                >
                  <ShieldCheck size={12} className="inline-block mr-1" />
                  轮换 Verifier
                </button>
              </div>

              {(client.keys || []).length > 0 ? (
                <div className="space-y-2">
                  {(client.keys || []).map((keyRow) => (
                    <div key={keyRow.id} className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2 text-xs">
                      <div className="font-semibold text-slate-700 dark:text-zinc-200">{keyRow.label}</div>
                      <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Key 前缀（仅用于识别）</div>
                      <div className="mt-0.5 font-mono text-zinc-500">{keyRow.key_prefix}</div>
                      <div className="mt-1 text-zinc-500 dark:text-zinc-400">
                        状态：{keyRow.status} · 最近使用：{formatDateTime(keyRow.last_used_at)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {keyRow.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => handleRevokeKey(keyRow)}
                          disabled={actionLoading === `revoke-key:${keyRow.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold uppercase tracking-wider border border-orange-400/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 disabled:opacity-50"
                        >
                          <ShieldOff size={12} />
                          撤销此 Key
                        </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleDeleteKey(keyRow)}
                          disabled={actionLoading === `delete-key:${keyRow.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold uppercase tracking-wider border border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          <Trash2 size={12} />
                          删除此 Key
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
