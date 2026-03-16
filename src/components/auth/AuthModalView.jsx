import React from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileSearch,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  User,
  UserPlus,
  X,
} from 'lucide-react';

export default function AuthModalView({
  agreedToTerms,
  confirmPassword,
  email,
  emailDomainError,
  emailValid,
  error,
  forgotPasswordStatus,
  hasEmailError,
  loading,
  message,
  mode,
  onAgreedToTermsChange,
  onClose,
  onConfirmPasswordChange,
  onEmailChange,
  onPasswordChange,
  onAddRecoveryClaim,
  onSubmit,
  onSubmitRecoveryRequest,
  onSwitchMode,
  onSwitchToForgotPassword,
  onSwitchToLoginWithEmail,
  onSwitchToRegisterWithEmail,
  onOpenRecoveryRequest,
  onCloseRecoveryRequest,
  onRecoveryClaimChange,
  onRecoveryClaimedAccountCountChange,
  onRecoveryNoteChange,
  onRemoveRecoveryClaim,
  onUsernameChange,
  password,
  recoveryRequestError,
  recoveryRequestForm,
  recoveryRequestLoading,
  recoveryRequestSuccess,
  resendCooldown,
  showDuplicateEmailPrompt,
  submitDisabled,
  username,
}) {
  const recoveryRequestTypeLabel =
    recoveryRequestForm.requestType === 'delete_account' ? '注销旧账号' : '申请人工恢复';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-zinc-200 dark:border-zinc-800"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-950 dark:to-zinc-900 text-white p-6 border-b-4 border-endfield-yellow">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                backgroundSize: '20px 20px',
              }}
            />
          </div>

          <button
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded z-50"
          >
            <X size={20} />
          </button>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-endfield-yellow flex items-center justify-center">
                {mode === 'login' ? <LogIn size={20} className="text-black" /> :
                  mode === 'register' ? <UserPlus size={20} className="text-black" /> :
                    <KeyRound size={20} className="text-black" />}
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight font-mono">
                  {mode === 'login' ? 'SIGN IN' : mode === 'register' ? 'REGISTER' : 'ACCOUNT RECOVERY'}
                </h2>
                <p className="text-zinc-400 text-xs uppercase tracking-widest">
                  {mode === 'login' ? '登录账户' : mode === 'register' ? '创建新账户' : '账号恢复'}
                </p>
              </div>
            </div>
            <p className="text-zinc-300 text-sm mt-3">
              {mode === 'login' ? '登录以同步你的抽卡数据到云端' :
                mode === 'register' ? '注册后可多设备同步数据' :
                  '输入邮箱地址，先检查该账号是否已注册。当前版本未启用邮件找回，已注册账号只能提交人工恢复申请。'}
            </p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="p-6 space-y-4 bg-slate-50 dark:bg-zinc-950"
        >
          {message && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-none text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
            </div>
          )}

          {error && !showDuplicateEmailPrompt && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-none text-sm flex items-start gap-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {showDuplicateEmailPrompt && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-none p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-amber-800 dark:text-amber-300 font-medium mb-2">
                    该邮箱已被注册
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                    邮箱 <span className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5">{email}</span> 已经注册过账号。
                  </p>
                  <button
                    type="button"
                    onClick={onSwitchToLoginWithEmail}
                    className="w-full bg-endfield-yellow hover:bg-yellow-400 text-black font-bold uppercase tracking-wider py-2 px-4 rounded-none transition-colors text-sm"
                  >
                    使用此邮箱登录
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-2">
                用户名 <span className="text-slate-400 dark:text-zinc-600 font-normal">(可选)</span>
              </label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                <input
                  type="text"
                  value={username}
                  onChange={onUsernameChange}
                  placeholder="显示名称"
                  className="w-full pl-10 pr-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:ring-2 focus:ring-endfield-yellow focus:border-endfield-yellow outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-2">
              邮箱地址
            </label>
            <div className="relative">
              <Mail
                size={18}
                className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                  hasEmailError ? 'text-red-500' : 'text-slate-400 dark:text-zinc-500'
                }`}
              />
              <input
                type="email"
                value={email}
                onChange={onEmailChange}
                placeholder="your@email.com"
                required
                className={`w-full pl-10 pr-4 py-3 border rounded-none bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 outline-none transition-all ${
                  hasEmailError
                    ? 'border-red-300 dark:border-red-700 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                    : 'border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-endfield-yellow focus:border-endfield-yellow'
                }`}
              />
            </div>
            {email && !emailValid && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                请输入有效的邮箱地址
              </p>
            )}
            {mode === 'register' && emailValid && emailDomainError && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-start gap-1">
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                <span>{emailDomainError}</span>
              </p>
            )}
          </div>

          {mode === 'forgotPassword' && forgotPasswordStatus === 'registered' && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-none p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-emerald-800 dark:text-emerald-300 font-medium mb-2">
                    该邮箱已注册
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-3">
                    当前版本未启用邮件找回，也不允许仅凭邮箱直接修改密码。若你还有已登录设备，请直接前往“设置 &gt; 修改密码”；若完全无法登录，可提交人工恢复或旧账号注销申请。
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenRecoveryRequest('password_reset')}
                      className={`px-3 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                        recoveryRequestForm.requestType === 'password_reset'
                          ? 'bg-endfield-yellow text-black'
                          : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700'
                      }`}
                    >
                      申请人工恢复
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenRecoveryRequest('delete_account')}
                      className={`px-3 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                        recoveryRequestForm.requestType === 'delete_account'
                          ? 'bg-red-600 text-white'
                          : 'bg-white text-red-600 border border-red-300 hover:bg-red-50 dark:bg-transparent dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20'
                      }`}
                    >
                      申请注销旧账号
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={onSwitchToLoginWithEmail}
                    className="w-full mt-2 bg-endfield-yellow hover:bg-yellow-400 text-black font-bold uppercase tracking-wider py-2 px-4 rounded-none transition-colors text-sm"
                  >
                    返回登录
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === 'forgotPassword' && forgotPasswordStatus === 'registered' && recoveryRequestForm.requestType && (
            <div className="border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-2">
                    <FileSearch size={16} className="text-endfield-yellow" />
                    {recoveryRequestTypeLabel}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
                    请尽量填写你曾上传过的 UID 和游戏内昵称。当前版本没有邮件和匿名站内回传，申请只会进入超管审核队列。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCloseRecoveryRequest}
                  className="text-xs text-slate-500 dark:text-zinc-500 hover:text-endfield-yellow transition-colors"
                >
                  收起
                </button>
              </div>

              {recoveryRequestSuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">恢复申请已提交</div>
                      <div className="mt-1">
                        超管会根据你填写的 UID、昵称和说明进行人工核验。当前系统不会向未登录用户发放自动重置入口。
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {recoveryRequestError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 text-sm flex items-start gap-2">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{recoveryRequestError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-2">
                  你曾上传过几个账号
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={recoveryRequestForm.claimedAccountCount}
                  onChange={onRecoveryClaimedAccountCountChange}
                  className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-endfield-yellow focus:border-endfield-yellow"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">
                    身份核验信息
                  </label>
                  <button
                    type="button"
                    onClick={onAddRecoveryClaim}
                    className="text-xs font-bold uppercase tracking-wider text-endfield-yellow hover:text-yellow-500 flex items-center gap-1"
                  >
                    <Plus size={12} />
                    新增一组
                  </button>
                </div>

                {recoveryRequestForm.verificationClaims.map((claim, index) => (
                  <div key={`claim-${index}`} className="border border-zinc-200 dark:border-zinc-700 p-3 space-y-3 bg-slate-50 dark:bg-zinc-950">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
                        账号线索 {index + 1}
                      </span>
                      {recoveryRequestForm.verificationClaims.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveRecoveryClaim(index)}
                          className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          删除
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={claim.gameUid}
                        onChange={(event) => onRecoveryClaimChange(index, 'gameUid', event.target.value)}
                        placeholder="游戏 UID"
                        className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-endfield-yellow focus:border-endfield-yellow"
                      />
                      <input
                        type="text"
                        value={claim.nickName}
                        onChange={(event) => onRecoveryClaimChange(index, 'nickName', event.target.value)}
                        placeholder="游戏内昵称"
                        className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-endfield-yellow focus:border-endfield-yellow"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-2">
                  补充说明
                </label>
                <textarea
                  value={recoveryRequestForm.note}
                  onChange={onRecoveryNoteChange}
                  placeholder={
                    recoveryRequestForm.requestType === 'delete_account'
                      ? '请说明为什么需要注销旧账号，以及你后续是否会重新注册。'
                      : '可补充上传时间、常用卡池、历史角色或其他只有你本人知道的信息。'
                  }
                  className="w-full min-h-[100px] px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-endfield-yellow focus:border-endfield-yellow"
                />
              </div>

              <button
                type="button"
                onClick={onSubmitRecoveryRequest}
                disabled={recoveryRequestLoading}
                className="w-full bg-endfield-yellow hover:bg-yellow-400 disabled:bg-yellow-300 dark:disabled:bg-yellow-600 disabled:cursor-not-allowed text-black font-bold uppercase tracking-wider py-3 rounded-none flex items-center justify-center gap-2 transition-colors"
              >
                {recoveryRequestLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <FileSearch size={18} />
                )}
                提交{recoveryRequestTypeLabel}
              </button>
            </div>
          )}

          {mode === 'forgotPassword' && forgotPasswordStatus === 'unregistered' && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-none p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-amber-800 dark:text-amber-300 font-medium mb-2">
                    该邮箱尚未注册
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                    邮箱 <span className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5">{email}</span> 目前没有对应账号，请先注册后再使用云同步功能。
                  </p>
                  <button
                    type="button"
                    onClick={onSwitchToRegisterWithEmail}
                    className="w-full bg-endfield-yellow hover:bg-yellow-400 text-black font-bold uppercase tracking-wider py-2 px-4 rounded-none transition-colors text-sm"
                  >
                    使用此邮箱注册
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode !== 'forgotPassword' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-2">
                密码
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                <input
                  type="password"
                  value={password}
                  onChange={onPasswordChange}
                  placeholder={mode === 'register' ? '至少 6 位字符' : '输入密码'}
                  required
                  minLength={mode === 'register' ? 6 : undefined}
                  className="w-full pl-10 pr-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:ring-2 focus:ring-endfield-yellow focus:border-endfield-yellow outline-none transition-all"
                />
              </div>
              {mode === 'login' && (
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={onSwitchToForgotPassword}
                    className="text-xs text-slate-500 dark:text-zinc-500 hover:text-endfield-yellow transition-colors"
                  >
                    账号恢复
                  </button>
                </div>
              )}
              {mode === 'register' && password && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          password.length < 6
                            ? 'w-1/3 bg-red-500'
                            : password.length < 10
                              ? 'w-2/3 bg-amber-500'
                              : 'w-full bg-green-500'
                        }`}
                      />
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        password.length < 6
                          ? 'text-red-500'
                          : password.length < 10
                            ? 'text-amber-500'
                            : 'text-green-500'
                      }`}
                    >
                      {password.length < 6 ? '弱' : password.length < 10 ? '中' : '强'}
                    </span>
                  </div>
                  {password.length < 6 && (
                    <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
                      至少需要 6 位字符
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-2">
                确认密码
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={onConfirmPasswordChange}
                  placeholder="再次输入密码"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:ring-2 focus:ring-endfield-yellow focus:border-endfield-yellow outline-none transition-all"
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  两次输入的密码不一致
                </p>
              )}
              {confirmPassword && password === confirmPassword && password.length >= 6 && (
                <p className="text-xs text-green-500 dark:text-green-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  密码一致
                </p>
              )}
            </div>
          )}

          {mode === 'register' && (
            <label className="flex items-start gap-2 cursor-pointer mt-2">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={onAgreedToTermsChange}
                className="mt-0.5 accent-endfield-yellow"
              />
              <span className="text-xs text-slate-500 dark:text-zinc-500">
                我已阅读并同意
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-endfield-yellow hover:underline mx-0.5">隐私政策</a>
                和
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-endfield-yellow hover:underline mx-0.5">用户协议</a>
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={submitDisabled}
            className="w-full bg-endfield-yellow hover:bg-yellow-400 disabled:bg-yellow-300 dark:disabled:bg-yellow-600 disabled:cursor-not-allowed text-black font-bold uppercase tracking-wider py-3 rounded-none flex items-center justify-center gap-2 transition-colors shadow-lg mt-6"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : mode === 'login' ? (
              <>
                <LogIn size={20} />
                登录
              </>
            ) : mode === 'register' ? (
              <>
                <UserPlus size={20} />
                注册
              </>
            ) : resendCooldown > 0 ? (
              <>
                <RefreshCw size={20} />
                {resendCooldown}秒后可重新检查
              </>
            ) : (
              <>
                <KeyRound size={20} />
                检查账号状态
              </>
            )}
          </button>
        </form>

        <div className="px-6 py-4 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 text-center">
          <p className="text-slate-500 dark:text-zinc-500 text-sm">
            {mode === 'login' ? (
              <>
                还没有账户？{' '}
                <button
                  type="button"
                  onClick={() => onSwitchMode('register')}
                  className="text-endfield-yellow hover:text-yellow-500 font-bold uppercase text-xs tracking-wider"
                >
                  立即注册
                </button>
              </>
            ) : mode === 'register' ? (
              <>
                已有账户？{' '}
                <button
                  type="button"
                  onClick={() => onSwitchMode('login')}
                  className="text-endfield-yellow hover:text-yellow-500 font-bold uppercase text-xs tracking-wider"
                >
                  登录
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onSwitchMode('login')}
                className="text-slate-500 dark:text-zinc-500 hover:text-endfield-yellow transition-colors text-sm flex items-center gap-1 mx-auto"
              >
                <ArrowLeft size={14} />
                返回登录
              </button>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
