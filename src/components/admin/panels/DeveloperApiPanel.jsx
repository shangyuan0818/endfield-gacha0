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
} from 'lucide-react';
import {
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
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-zinc-400">
              <RefreshCw size={18} className="animate-spin" />
            </div>
          ) : developerClients.length === 0 ? (
            <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 px-4 py-6 text-sm text-zinc-500">
              当前没有开发者 API 申请。
            </div>
          ) : developerClients.map((client) => (
            <div key={client.id} className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/40 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 dark:text-zinc-100">{client.name}</div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 break-words">{client.use_case}</div>
                  <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    提交人：{client.owner?.username || client.owner?.email || '未知'} · 创建于 {formatDateTime(client.created_at)}
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
                <button
                  type="button"
                  onClick={() => handleReview(client.id, 'revoked')}
                  disabled={actionLoading === `review:${client.id}:revoked`}
                  className="px-3 py-2 text-xs font-bold uppercase tracking-wider border border-orange-400/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 disabled:opacity-50"
                >
                  撤销
                </button>
                <button
                  type="button"
                  onClick={() => handleRotateKey(client)}
                  disabled={actionLoading === `rotate-key:${client.id}`}
                  className="px-3 py-2 text-xs font-bold uppercase tracking-wider border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  <RotateCw size={12} className="inline-block mr-1" />
                  轮换 Key
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
                      <div className="mt-1 font-mono text-zinc-500">{keyRow.key_prefix}</div>
                      <div className="mt-1 text-zinc-500 dark:text-zinc-400">
                        最近使用：{formatDateTime(keyRow.last_used_at)} · 创建：{formatDateTime(keyRow.created_at)}
                      </div>
                      {keyRow.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => handleRevokeKey(keyRow)}
                          disabled={actionLoading === `revoke-key:${keyRow.id}`}
                          className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold uppercase tracking-wider border border-orange-400/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 disabled:opacity-50"
                        >
                          <ShieldOff size={12} />
                          撤销此 Key
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
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
                      <div className="mt-1 font-mono text-zinc-500">{keyRow.key_prefix}</div>
                      <div className="mt-1 text-zinc-500 dark:text-zinc-400">
                        状态：{keyRow.status} · 最近使用：{formatDateTime(keyRow.last_used_at)}
                      </div>
                      {keyRow.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => handleRevokeKey(keyRow)}
                          disabled={actionLoading === `revoke-key:${keyRow.id}`}
                          className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold uppercase tracking-wider border border-orange-400/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 disabled:opacity-50"
                        >
                          <ShieldOff size={12} />
                          撤销此 Key
                        </button>
                      ) : null}
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
