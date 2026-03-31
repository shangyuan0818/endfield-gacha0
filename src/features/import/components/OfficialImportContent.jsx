import React from 'react';
import {
  RefreshCw,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  User,
  ArrowRight,
  Clock,
  Loader2
} from 'lucide-react';
import { ImportStatus } from '../importStatus';

const FetchProgressBar = ({ progress, message }) => (
  <div className="w-full">
    <div className="flex justify-between items-center mb-1 text-[10px] font-mono uppercase text-slate-500 dark:text-zinc-500 transition-colors">
      <span className="flex items-center gap-2">
        <RefreshCw size={10} className="animate-spin text-amber-500 dark:text-yellow-500" />
        正在获取数据
      </span>
      <span>{progress}%</span>
    </div>
    <div className="h-1 w-full bg-slate-200 dark:bg-zinc-800 relative overflow-hidden transition-colors">
      <div
        className="h-full bg-amber-500 dark:bg-yellow-500 transition-all duration-300"
        style={{ width: `${progress}%` }}
      />
    </div>
    <div className="mt-2 flex justify-between items-center text-xs font-mono">
      <span className="text-slate-600 dark:text-zinc-300 transition-colors">{message}</span>
    </div>
  </div>
);

const QueueStatusDisplay = ({ queueStatus, retryInfo }) => {
  if (!queueStatus && !retryInfo) return null;

  return (
    <div className="mt-3 p-3 bg-slate-100 dark:bg-zinc-800/70 border border-slate-300 dark:border-zinc-600 rounded transition-colors">
      <div className="flex items-start gap-2">
        <Clock size={14} className="text-amber-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          {queueStatus && (
            <div className="text-xs font-mono">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-700 dark:text-zinc-300 font-semibold">请求队列状态</span>
                {queueStatus.isProcessing && (
                  <Loader2 size={12} className="animate-spin text-amber-500 dark:text-yellow-500" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">队列长度:</span>
                  <span className="text-slate-700 dark:text-zinc-200 font-semibold">{queueStatus.queueLength}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">活动请求:</span>
                  <span className="text-slate-700 dark:text-zinc-200 font-semibold">{queueStatus.activeRequests || 0}</span>
                </div>
              </div>
              {queueStatus.oldestTaskAge > 0 && (
                <div className="mt-1 text-[10px] text-slate-500 dark:text-zinc-400">
                  最早任务等待: {Math.round(queueStatus.oldestTaskAge / 1000)}秒
                </div>
              )}
            </div>
          )}

          {retryInfo && (
            <div className="text-xs font-mono border-t border-slate-300 dark:border-zinc-600 pt-2">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw size={12} className="text-orange-500 dark:text-orange-400" />
                <span className="text-slate-700 dark:text-zinc-300 font-semibold">正在重试</span>
              </div>
              <div className="text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">重试次数:</span>
                  <span className="text-orange-600 dark:text-orange-400 font-semibold">
                    {retryInfo.currentRetry}/{retryInfo.maxRetries}
                  </span>
                </div>
                {retryInfo.nextRetryIn && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-zinc-400">下次重试:</span>
                    <span className="text-slate-700 dark:text-zinc-200 font-semibold">
                      {Math.round(retryInfo.nextRetryIn / 1000)}秒后
                    </span>
                  </div>
                )}
                {retryInfo.reason && (
                  <div className="mt-1 text-orange-600 dark:text-orange-400">
                    原因: {retryInfo.reason}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function getPoolName(poolType) {
  const nameMap = {
    limited_character: '限定角色',
    standard: '常驻',
    beginner: '新手',
    limited_weapon: '武器',
    unknown: '未知'
  };
  return nameMap[poolType] || poolType;
}

const IMPORT_SOURCE_OPTIONS = [
  { key: 'cn', label: '国服', description: '官服 / B服' },
  { key: 'intl', label: '国际服', description: '亚服 / 欧/美服' }
];

const IMPORT_SOURCE_GUIDES = {
  cn: {
    bindingTitle: '登录官网并绑定',
    bindingDesc: '官服与B服均需在此绑定终末地角色：',
    bindingUrl: 'https://user.hypergryph.com/bindCharacters?game=endfield',
    bindingHost: 'user.hypergryph.com',
    tokenTitle: '获取数据内容',
    tokenDesc: '在新标签页打开链接，建议复制页面显示的完整内容，或仅复制 content 字段的值：',
    tokenUrl: 'https://web-api.hypergryph.com/account/info/hg',
    tokenHost: 'web-api.hypergryph.com'
  },
  intl: {
    bindingTitle: '登录充值中心',
    bindingDesc: '请先登录国际服充值中心，确保角色列表可见：',
    bindingUrl: 'https://topup.gryphline.com/endfield',
    bindingHost: 'topup.gryphline.com',
    tokenTitle: '获取认证内容',
    tokenDesc: '登录后在新标签页打开链接，复制页面显示的完整内容，或仅复制 content 字段的值：',
    tokenUrl: 'https://web-api.gryphline.com/cookie_store/account_token',
    tokenHost: 'web-api.gryphline.com'
  }
};

function getAccountAccent(account = {}) {
  const tag = account.serverTag || '';

  if (tag === 'B服') {
    return {
      border: 'border-pink-300 dark:border-pink-600 bg-pink-50 dark:bg-pink-900/20 hover:bg-pink-100 dark:hover:bg-pink-900/30',
      iconBg: 'bg-pink-100 dark:bg-pink-800/50',
      iconText: 'text-pink-600 dark:text-pink-400',
      badge: 'bg-pink-500 dark:bg-pink-600 text-white'
    };
  }

  if (tag?.includes('国际服')) {
    return {
      border: 'border-sky-300 dark:border-sky-600 bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30',
      iconBg: 'bg-sky-100 dark:bg-sky-800/50',
      iconText: 'text-sky-600 dark:text-sky-400',
      badge: 'bg-sky-500 dark:bg-sky-600 text-white'
    };
  }

  return {
    border: 'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30',
    iconBg: 'bg-amber-100 dark:bg-amber-800/50',
    iconText: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500 dark:bg-amber-600 text-white'
  };
}

export default function OfficialImportContent({
  source,
  status,
  tokenInput,
  autoDetected,
  availableAccounts,
  progress,
  statusMessage,
  queueStatus,
  retryInfo,
  sourceSwitchInfo,
  error,
  importSummary,
  userInfo,
  onSourceChange,
  onTokenChange,
  onStartImport,
  onSelectAccount,
  onCancel,
  onReset,
  onConfirmImport
}) {
  const guide = IMPORT_SOURCE_GUIDES[source] || IMPORT_SOURCE_GUIDES.cn;
  const userInfoAccent = userInfo ? getAccountAccent(userInfo) : null;

  return (
    <div className="space-y-6">
      {status === ImportStatus.IDLE && (
        <div className="bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-4 transition-colors">
          <div className="mb-4">
            <div className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-2">
              区服来源
            </div>
            <div className="grid grid-cols-2 gap-2">
              {IMPORT_SOURCE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onSourceChange(option.key)}
                  className={`border p-3 text-left transition-colors ${
                    source === option.key
                      ? 'border-amber-500 dark:border-yellow-500 bg-amber-50 dark:bg-yellow-500/10'
                      : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/40 hover:bg-slate-100 dark:hover:bg-zinc-800/70'
                  }`}
                >
                  <div className="text-sm font-bold text-slate-800 dark:text-white">{option.label}</div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 mt-1">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          <h3 className="text-slate-800 dark:text-zinc-300 text-sm font-bold flex items-center gap-2 mb-4">
            <HelpCircle size={14} className="text-amber-600 dark:text-yellow-500" />
            快速指南
          </h3>

          <div className="space-y-4 pt-2 text-xs text-slate-500 dark:text-zinc-400 font-mono">
            <div className="flex gap-3">
              <div className="w-5 h-5 flex-shrink-0 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-slate-600 dark:text-zinc-300">1</div>
              <div>
                <p className="text-slate-800 dark:text-zinc-300 font-bold mb-1">{guide.bindingTitle}</p>
                <p className="mb-1 text-slate-500 dark:text-zinc-500">{guide.bindingDesc}</p>
                <a href={guide.bindingUrl} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 flex items-center gap-1 underline">
                  {guide.bindingHost} <ExternalLink size={10} />
                </a>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-5 h-5 flex-shrink-0 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-slate-600 dark:text-zinc-300">2</div>
              <div>
                <p className="text-slate-800 dark:text-zinc-300 font-bold mb-1">{guide.tokenTitle}</p>
                <p className="mb-1 text-slate-500 dark:text-zinc-500">{guide.tokenDesc}</p>
                <a href={guide.tokenUrl} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 flex items-center gap-1 underline">
                  {guide.tokenHost} <ExternalLink size={10} />
                </a>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-5 h-5 flex-shrink-0 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-slate-600 dark:text-zinc-300">3</div>
              <div>
                <p className="text-slate-800 dark:text-zinc-300 font-bold mb-1">粘贴至下方</p>
                <p className="text-slate-500 dark:text-zinc-500 mb-2">将复制的内容粘贴在下方输入框中：</p>
                <div className="bg-slate-100 dark:bg-black/40 border border-zinc-200 dark:border-zinc-700 p-2 text-[10px] font-mono rounded-sm leading-relaxed transition-colors">
                  <span className="text-slate-500 dark:text-zinc-500">{'{'}</span><br />
                  <span className="text-slate-500 dark:text-zinc-500 ml-2">"code": 0,</span><br />
                  <span className="text-slate-500 dark:text-zinc-500 ml-2">"data": {'{'}</span><br />
                  <span className="text-purple-600 dark:text-purple-400 ml-4">"content"</span><span className="text-slate-500 dark:text-zinc-500">: </span>
                  <span className="text-green-600 dark:text-green-400">"AbCdEf123456789012345678"</span><br />
                  <span className="text-slate-500 dark:text-zinc-500 ml-2">{'}'}</span><span className="text-slate-400 dark:text-zinc-600 ml-2">// ← 复制引号内的24位字符</span><br />
                  <span className="text-slate-500 dark:text-zinc-500">{'}'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {status === ImportStatus.IDLE && (
        <div className="space-y-4">
          <div className="relative">
            <label className="block text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-2">
              身份认证 Token
            </label>
            <input
              type="text"
              value={tokenInput}
              onChange={onTokenChange}
              className="w-full bg-white dark:bg-black/30 border border-zinc-300 dark:border-zinc-700 p-4 font-mono text-center text-lg text-slate-800 dark:text-white focus:border-amber-500 dark:focus:border-yellow-500 focus:outline-none transition-colors placeholder:text-slate-400 dark:placeholder:text-zinc-700"
              placeholder={`粘贴${source === 'intl' ? '国际服' : '国服'}24位Token或完整JSON`}
            />
            <div className="absolute right-3 top-[38px] text-[10px] text-slate-400 dark:text-zinc-600 font-mono pointer-events-none">
              {tokenInput.trim().length} 字符
            </div>
          </div>

          {autoDetected && tokenInput.length === 24 && (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-500 font-mono bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/30 px-3 py-2 transition-colors">
              <CheckCircle size={14} />
              <span>已从JSON中自动提取Token</span>
            </div>
          )}

          <button
            onClick={onStartImport}
            disabled={!tokenInput.trim()}
            className="w-full bg-amber-500 hover:bg-amber-600 dark:bg-yellow-500 dark:hover:bg-yellow-400 disabled:opacity-50 disabled:hover:bg-amber-500 dark:disabled:hover:bg-yellow-500 text-white dark:text-black font-bold py-3 text-sm tracking-wider transition-colors flex items-center justify-center gap-2 group"
          >
            开始导入
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}

      {status === ImportStatus.ACCOUNT_SELECTION && availableAccounts.length > 1 && (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 p-4 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-blue-700 dark:text-blue-400 font-bold text-sm">检测到多个游戏账号</span>
            </div>
            <p className="text-slate-600 dark:text-zinc-400 text-xs font-mono mb-4">
              请选择要导入抽卡记录的账号：
            </p>

            <div className="space-y-2">
              {availableAccounts.map((account) => {
                const accent = getAccountAccent(account);
                return (
                <button
                  key={`${account.uid}-${account.gameUid || 'unknown'}-${account.serverId || 'unknown'}`}
                  onClick={() => onSelectAccount(account)}
                  className={`w-full p-3 border transition-all text-left flex items-center gap-3 ${accent.border}`}
                >
                  <div className={`w-10 h-10 flex items-center justify-center ${accent.iconBg}`}>
                    <User size={20} className={accent.iconText} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-white">{account.nickName}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 font-bold uppercase ${accent.badge}`}>
                        {account.serverTag || account.channelName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono mt-0.5">
                      UID: {account.gameUid} • Lv.{account.level}
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-slate-400 dark:text-zinc-500" />
                </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={onReset}
            className="w-full text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 text-xs font-mono uppercase tracking-widest transition-colors"
          >
            [ 取消并返回 ]
          </button>
        </div>
      )}

      {(status === ImportStatus.AUTHENTICATING || status === ImportStatus.FETCHING || status === ImportStatus.PROCESSING) && (
        <div className="py-8 px-4 border border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 transition-colors">
          <FetchProgressBar progress={progress} message={statusMessage} />
          {sourceSwitchInfo && (
            <div className="mt-3 flex items-center gap-2 text-xs font-mono bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 px-3 py-2 text-sky-700 dark:text-sky-400 transition-colors">
              <RefreshCw size={12} className="animate-spin" />
              <span>
                正在自动切换到{sourceSwitchInfo.to === 'intl' ? '国际服' : '国服'}
                {sourceSwitchInfo.countdown > 0 && `（${sourceSwitchInfo.countdown}s）`}
              </span>
            </div>
          )}
          <QueueStatusDisplay queueStatus={queueStatus} retryInfo={retryInfo} />
          <button
            onClick={onCancel}
            className="mt-6 w-full text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 text-xs font-mono uppercase tracking-widest transition-colors"
          >
            [ 取消操作 ]
          </button>
        </div>
      )}

      {status === ImportStatus.ERROR && (
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 p-4 flex gap-3 transition-colors">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 shrink-0" />
            <div>
              <h4 className="text-red-600 dark:text-red-500 font-bold text-sm mb-1">导入失败</h4>
              <p className="text-slate-600 dark:text-zinc-400 text-xs font-mono">{error}</p>
            </div>
          </div>
          <button
            onClick={onReset}
            className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-transparent hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-white font-bold py-3 text-sm tracking-wider transition-colors"
          >
            重试
          </button>
        </div>
      )}

      {status === ImportStatus.SUCCESS && importSummary && (
        <div className="space-y-6">
          {userInfo && userInfoAccent && (
            <div className="flex items-center gap-3 p-3 border border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 transition-colors">
              <div className={`w-10 h-10 flex items-center justify-center ${userInfoAccent.iconBg}`}>
                <User size={20} className={userInfoAccent.iconText} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800 dark:text-white">{userInfo.nickName || 'Unknown User'}</span>
                  {(userInfo.serverTag || userInfo.channelName) && (
                    <span className={`text-[10px] px-1.5 py-0.5 font-bold uppercase ${userInfoAccent.badge}`}>
                      {userInfo.serverTag || userInfo.channelName}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono">UID: {userInfo.gameUid || userInfo.hgUid}</p>
              </div>
            </div>
          )}

          <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-500/20 p-4 transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="text-green-600 dark:text-green-500" size={16} />
              <span className="text-green-600 dark:text-green-500 font-bold text-sm">数据获取成功</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="text-center bg-white dark:bg-zinc-900/50 p-2 border border-zinc-200 dark:border-zinc-800/50 transition-colors">
                <div className="text-xs font-bold text-slate-400 dark:text-zinc-400">TOTAL</div>
                <div className="text-lg font-mono text-slate-800 dark:text-white">{importSummary.total}</div>
              </div>

              {['6', '5', '4'].map(rarity => (
                <div key={rarity} className="text-center bg-white dark:bg-zinc-900/50 p-2 border border-zinc-200 dark:border-zinc-800/50 transition-colors">
                  <div className={`text-xs font-bold ${rarity === '6' ? 'text-amber-600 dark:text-yellow-500' : rarity === '5' ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    {rarity}★
                  </div>
                  <div className="text-lg font-mono text-slate-700 dark:text-zinc-300">{importSummary.byRarity[rarity] || 0}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/50 transition-colors">
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono uppercase mb-2">卡池分布</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(importSummary.byPoolType || importSummary.byPool).map(([pool, count]) => (
                  <span
                    key={pool}
                    className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 px-2 py-1 text-xs text-slate-500 dark:text-zinc-400 font-mono transition-colors"
                  >
                    {getPoolName(pool)}: <span className="text-slate-800 dark:text-white">{count}</span>
                  </span>
                ))}
              </div>
            </div>

            {importSummary.sixStars && importSummary.sixStars.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] text-amber-600/70 dark:text-yellow-500/70 font-mono uppercase mb-2">获得的6星</p>
                <div className="flex flex-wrap gap-2">
                  {importSummary.sixStars.map((record, index) => (
                    <span
                      key={index}
                      className="bg-amber-50 dark:bg-yellow-500/10 border border-amber-200 dark:border-yellow-500/20 px-2 py-1 text-xs text-amber-700 dark:text-yellow-500 font-bold transition-colors"
                    >
                      {record.name}
                      {record.isNew && <span className="ml-1 text-[10px] bg-amber-500 dark:bg-yellow-500 text-white dark:text-black px-1 rounded-sm">NEW</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={onReset}
              className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-transparent hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-white font-bold py-3 text-sm tracking-wider transition-colors"
            >
              重新获取
            </button>
            <button
              onClick={onConfirmImport}
              className="flex-1 bg-amber-500 hover:bg-amber-600 dark:bg-yellow-500 dark:hover:bg-yellow-400 text-white dark:text-black font-bold py-3 text-sm tracking-wider transition-colors"
            >
              确认并保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
