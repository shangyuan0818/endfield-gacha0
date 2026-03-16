import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Mail,
  RefreshCw,
  Search,
  ShieldAlert
} from 'lucide-react';

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

export default function AccountRecoveryPanel({
  requests,
  actionLoading,
  onRefresh,
  onUpdateRequest
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [draftNotes, setDraftNotes] = useState({});

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
        <div className="space-y-3">
          {filteredRequests.map((request) => {
            const statusMeta = STATUS_META[request.status] || STATUS_META.pending;
            const typeMeta = REQUEST_TYPE_META[request.request_type] || REQUEST_TYPE_META.password_reset;

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

                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1">
                      <div>当前版本不提供匿名用户的站内安全回传。</div>
                      <div>“已核验”只表示超管已完成身份核查，不代表系统已经向对方发放重置入口。</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
