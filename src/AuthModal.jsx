import React, { useState, useCallback, useEffect } from 'react';
import { X, Mail, Lock, User, LogIn, UserPlus, Loader2, AlertCircle, CheckCircle2, KeyRound, ArrowLeft, RefreshCw } from 'lucide-react';
import { supabase } from './supabaseClient';
import { showFriendlyError } from './utils/errorMessages';

// ========== 邮箱域名白名单配置 ==========
// 主流邮箱服务商
const MAINSTREAM_EMAIL_DOMAINS = [
  // 国际
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'yahoo.com', 'yahoo.co.jp', 'yahoo.co.uk',
  'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me',
  'zoho.com',
  'aol.com',
  'mail.com',
  'gmx.com', 'gmx.net',
  'yandex.com', 'yandex.ru',
  // 国内
  'qq.com', 'foxmail.com',
  '163.com', '126.com', 'yeah.net', 'netease.com',
  'sina.com', 'sina.cn',
  'sohu.com',
  'aliyun.com', 'alibaba-inc.com',
  '189.cn', '21cn.com',
  'tom.com',
];

// 知名论坛/社区邮箱
const COMMUNITY_EMAIL_DOMAINS = [
  'linux.do',
  'v2ex.com',
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'sourcehut.org',
];

// 企业邮箱常见后缀（这些通常是可信的）
const CORPORATE_EMAIL_PATTERNS = [
  // 科技公司
  'microsoft.com', 'apple.com', 'google.com', 'amazon.com', 'meta.com', 'facebook.com',
  'tencent.com', 'alibaba.com', 'bytedance.com', 'baidu.com', 'netease.com', 'bilibili.com',
  'mihoyo.com', 'hypergryph.com', 'grfrline.com',
];

/**
 * 验证邮箱域名是否可信
 * @param {string} email 邮箱地址
 * @returns {{ valid: boolean, reason?: string }}
 */
const validateEmailDomain = (email) => {
  if (!email || !email.includes('@')) {
    return { valid: false, reason: '邮箱格式不正确' };
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    return { valid: false, reason: '邮箱格式不正确' };
  }

  // 1. 检查主流邮箱服务商
  if (MAINSTREAM_EMAIL_DOMAINS.includes(domain)) {
    return { valid: true };
  }

  // 2. 检查知名社区邮箱
  if (COMMUNITY_EMAIL_DOMAINS.includes(domain)) {
    return { valid: true };
  }

  // 3. 检查企业邮箱
  if (CORPORATE_EMAIL_PATTERNS.includes(domain)) {
    return { valid: true };
  }

  // 4. 其他域名视为不可信
  return { 
    valid: false, 
    reason: '请使用主流邮箱服务商（如 Gmail、Outlook、QQ邮箱、163邮箱等）、知名论坛/社区邮箱或企业邮箱注册' 
  };
};

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgotPassword'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDuplicateEmailPrompt, setShowDuplicateEmailPrompt] = useState(false);
  const [emailValid, setEmailValid] = useState(true);
  const [emailDomainError, setEmailDomainError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0); // 重发验证邮件倒计时
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(''); // 待验证的邮箱

  // 管理重发验证邮件倒计时（修复内存泄漏 PERF-NEW-001）
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);

    // 组件卸载时清理定时器，防止内存泄漏
    return () => clearInterval(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;
  
  // 重发验证邮件
  const handleResendVerification = async () => {
    if (resendCooldown > 0 || !pendingVerificationEmail) return;
    
    setLoading(true);
    setError('');
    
    try {
      // 检查频率限制
      const rateLimitResult = await checkRateLimit('register');
      if (!rateLimitResult.allowed) {
        const retryAfter = rateLimitResult.retry_after ? Math.ceil(rateLimitResult.retry_after / 60) : 60;
        setError(`请求过于频繁，请 ${retryAfter} 分钟后再试`);
        setLoading(false);
        return;
      }
      
      // 使用 Supabase 重新发送验证邮件
      // 使用环境变量配置的域名作为验证后跳转地址
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: pendingVerificationEmail,
        options: {
          emailRedirectTo: appUrl,
        },
      });
      
      if (error) throw error;

      setMessage('验证邮件已重新发送！请查收邮箱。');

      // 设置60秒倒计时（定时器由useEffect管理）
      setResendCooldown(60);
    } catch (err) {
      setError(getSimpleFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  // 获取客户端标识符（用于频率限制）
  const getClientIdentifier = () => {
    // 使用 localStorage 中的匿名ID，如果没有则生成一个
    let clientId = localStorage.getItem('_client_id');
    if (!clientId) {
      // 使用 crypto.randomUUID() 生成不可预测的ID（修复 SEC-NEW-002）
      clientId = 'anon_' + crypto.randomUUID();
      localStorage.setItem('_client_id', clientId);
    }
    return clientId;
  };

  // 检查频率限制（调用后端RPC）
  const checkRateLimit = async (action) => {
    if (!supabase) return { allowed: true };
    
    try {
      const { data, error } = await supabase.rpc('check_and_log_rate_limit', {
        p_identifier: getClientIdentifier(),
        p_action: action
      });

      if (error) {
        // 频率限制检查失败，默认允许（不影响用户体验）
        return { allowed: true };
      }

      return data || { allowed: true };
    } catch (err) {
      // 频率限制检查异常，默认允许
      return { allowed: true };
    }
  };

  // 后端邮箱域名验证
  const validateEmailDomainBackend = async (emailToCheck) => {
    if (!supabase) {
      // 如果 Supabase 不可用，回退到前端验证
      return validateEmailDomain(emailToCheck);
    }
    
    try {
      const { data, error } = await supabase.rpc('validate_email_domain', {
        check_email: emailToCheck
      });

      if (error) {
        // 后端验证失败，回退到前端验证
        return validateEmailDomain(emailToCheck);
      }

      return data || { valid: true };
    } catch (err) {
      // 后端验证异常，回退到前端验证
      return validateEmailDomain(emailToCheck);
    }
  };

  // 实时邮箱格式验证
  const validateEmail = (email) => {
    if (!email) return true; // 空值不显示错误
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (e) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setEmailValid(validateEmail(newEmail));
    setShowDuplicateEmailPrompt(false);
    
    // 仅在注册模式下验证域名
    if (mode === 'register' && newEmail && validateEmail(newEmail)) {
      const domainResult = validateEmailDomain(newEmail);
      setEmailDomainError(domainResult.valid ? '' : domainResult.reason);
    } else {
      setEmailDomainError('');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 检查频率限制
      const rateLimitResult = await checkRateLimit('login');
      if (!rateLimitResult.allowed) {
        const retryAfter = rateLimitResult.retry_after ? Math.ceil(rateLimitResult.retry_after / 60) : 30;
        setError(`登录尝试过于频繁，请 ${retryAfter} 分钟后再试`);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setError(getSimpleFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  // 忘记密码处理
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('请输入有效的邮箱地址');
      setLoading(false);
      return;
    }

    try {
      // 检查频率限制
      const rateLimitResult = await checkRateLimit('password_reset');
      if (!rateLimitResult.allowed) {
        const retryAfter = rateLimitResult.retry_after ? Math.ceil(rateLimitResult.retry_after / 60) : 60;
        setError(`请求过于频繁，请 ${retryAfter} 分钟后再试`);
        setLoading(false);
        return;
      }

      // 使用环境变量配置的域名，避免 window.location.origin 被篡改
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/reset-password`
      });

      if (error) throw error;

      setMessage('密码重置邮件已发送！请查收邮箱并点击链接重置密码。');
      // 设置60秒倒计时
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(getSimpleFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    // 前端邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('请输入有效的邮箱地址');
      setLoading(false);
      return;
    }

    // 密码强度验证
    if (password.length < 6) {
      setError('密码至少需要 6 位字符');
      setLoading(false);
      return;
    }

    // 密码确认验证
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      setLoading(false);
      return;
    }

    try {
      // 检查频率限制
      const rateLimitResult = await checkRateLimit('register');
      if (!rateLimitResult.allowed) {
        const retryAfter = rateLimitResult.retry_after ? Math.ceil(rateLimitResult.retry_after / 60) : 60;
        setError(`注册尝试过于频繁，请 ${retryAfter} 分钟后再试`);
        setLoading(false);
        return;
      }

      // 后端邮箱域名验证（优先使用后端，回退到前端）
      const domainResult = await validateEmailDomainBackend(email);
      if (!domainResult.valid) {
        setError(domainResult.reason);
        setLoading(false);
        return;
      }

      // 注册用户
      // 使用环境变量配置的域名作为验证后跳转地址
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username || email.split('@')[0],
          },
          emailRedirectTo: appUrl,
        },
      });

      if (error) {
        // 检测重复注册错误
        if (error.message.toLowerCase().includes('already registered') ||
            error.message.toLowerCase().includes('user already registered') ||
            error.message.toLowerCase().includes('email already exists') ||
            error.status === 422) {
          setError('该邮箱已被注册');
          setShowDuplicateEmailPrompt(true);
          return;
        }
        throw error;
      }

      // 检查是否需要邮箱验证
      if (data.user && !data.session) {
        setMessage('注册成功！请查收邮箱验证链接后登录。');
        setPendingVerificationEmail(email); // 保存待验证邮箱，用于重发验证邮件
        // 设置初始60秒倒计时
        setResendCooldown(60);
        const timer = setInterval(() => {
          setResendCooldown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else if (data.user && data.session) {
        // 如果不需要验证，直接登录成功
        onAuthSuccess(data.user);
        onClose();
      }
    } catch (err) {
      // 处理其他错误
      let errorMessage = '注册失败，请重试';

      if (err.message.includes('Invalid email')) {
        errorMessage = '邮箱格式不正确';
      } else if (err.message.includes('Password should be at least')) {
        errorMessage = '密码长度不足，至少需要 6 位字符';
      } else if (err.message.includes('Unable to validate email')) {
        errorMessage = '无法验证邮箱地址，请检查邮箱是否正确';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setUsername('');
    setError('');
    setMessage('');
    setShowDuplicateEmailPrompt(false);
    setEmailDomainError('');
    setResendCooldown(0);
    setPendingVerificationEmail('');
  };

  const switchMode = (newMode) => {
    resetForm();
    setMode(newMode);
  };

  const switchToForgotPassword = () => {
    setPassword('');
    setConfirmPassword('');
    setUsername('');
    setError('');
    setMessage('');
    setShowDuplicateEmailPrompt(false);
    setMode('forgotPassword');
  };

  const switchToLoginWithEmail = () => {
    setPassword('');
    setConfirmPassword('');
    setUsername('');
    setError('');
    setMessage('');
    setShowDuplicateEmailPrompt(false);
    setEmailDomainError('');
    setMode('login');
  };

  // 判断邮箱输入是否有错误
  const hasEmailError = email && (!emailValid || (mode === 'register' && emailDomainError));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-zinc-200 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Endfield 风格 */}
        <div className="relative bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-950 dark:to-zinc-900 text-white p-6 border-b-4 border-endfield-yellow">
          {/* 装饰性网格背景 */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute inset-0" style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '20px 20px'
            }}></div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
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
                  {mode === 'login' ? 'SIGN IN' : mode === 'register' ? 'REGISTER' : 'RESET PASSWORD'}
                </h2>
                <p className="text-zinc-400 text-xs uppercase tracking-widest">
                  {mode === 'login' ? '登录账户' : mode === 'register' ? '创建新账户' : '重置密码'}
                </p>
              </div>
            </div>
            <p className="text-zinc-300 text-sm mt-3">
              {mode === 'login' ? '登录以同步你的抽卡数据到云端' : 
               mode === 'register' ? '注册后可多设备同步数据' :
               '输入邮箱地址，我们将发送重置链接'}
            </p>
          </div>
        </div>

        {/* Body */}
        <form
          onSubmit={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleForgotPassword}
          className="p-6 space-y-4 bg-slate-50 dark:bg-zinc-950"
        >
          {/* Success Message */}
          {message && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-none text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
              {/* 重发验证邮件按钮 */}
              {pendingVerificationEmail && (
                <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-600 dark:text-green-500 mb-2">
                    没有收到邮件？检查垃圾邮件箱，或点击下方按钮重新发送。
                  </p>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={loading || resendCooldown > 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 dark:disabled:bg-green-800 text-white text-sm font-medium rounded-none transition-colors disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        发送中...
                      </>
                    ) : resendCooldown > 0 ? (
                      <>
                        <RefreshCw size={16} />
                        {resendCooldown}秒后可重发
                      </>
                    ) : (
                      <>
                        <RefreshCw size={16} />
                        重新发送验证邮件
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && !showDuplicateEmailPrompt && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-none text-sm flex items-start gap-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Duplicate Email Prompt */}
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
                    onClick={switchToLoginWithEmail}
                    className="w-full bg-endfield-yellow hover:bg-yellow-400 text-black font-bold uppercase tracking-wider py-2 px-4 rounded-none transition-colors text-sm"
                  >
                    使用此邮箱登录
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Username (Register only) */}
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
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="显示名称"
                  className="w-full pl-10 pr-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:ring-2 focus:ring-endfield-yellow focus:border-endfield-yellow outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-2">
              邮箱地址
            </label>
            <div className="relative">
              <Mail size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                hasEmailError ? 'text-red-500' : 'text-slate-400 dark:text-zinc-500'
              }`} />
              <input
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="your@email.com"
                required
                className={`w-full pl-10 pr-4 py-3 border rounded-none bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 outline-none transition-all ${
                  hasEmailError
                    ? 'border-red-300 dark:border-red-700 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                    : 'border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-endfield-yellow focus:border-endfield-yellow'
                }`}
              />
            </div>
            {/* 邮箱格式错误提示 */}
            {email && !emailValid && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                请输入有效的邮箱地址
              </p>
            )}
            {/* 邮箱域名错误提示（仅注册模式） */}
            {mode === 'register' && emailValid && emailDomainError && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-start gap-1">
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                <span>{emailDomainError}</span>
              </p>
            )}
          </div>

          {/* Password - 仅登录和注册模式 */}
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
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? '至少 6 位字符' : '输入密码'}
                  required
                  minLength={mode === 'register' ? 6 : undefined}
                  className="w-full pl-10 pr-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:ring-2 focus:ring-endfield-yellow focus:border-endfield-yellow outline-none transition-all"
                />
              </div>
              {/* 忘记密码链接 - 仅登录模式 */}
              {mode === 'login' && (
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={switchToForgotPassword}
                    className="text-xs text-slate-500 dark:text-zinc-500 hover:text-endfield-yellow transition-colors"
                  >
                    忘记密码？
                  </button>
                </div>
              )}
              {/* 密码强度提示（仅注册时显示）*/}
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
                    <span className={`text-xs font-medium ${
                      password.length < 6
                        ? 'text-red-500'
                        : password.length < 10
                        ? 'text-amber-500'
                        : 'text-green-500'
                    }`}>
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

          {/* Confirm Password (Register only) */}
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
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:ring-2 focus:ring-endfield-yellow focus:border-endfield-yellow outline-none transition-all"
                />
              </div>
              {/* 密码一致性提示 */}
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || (mode === 'register' && (hasEmailError || !!emailDomainError)) || (mode === 'forgotPassword' && resendCooldown > 0)}
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
                {resendCooldown}秒后可重新发送
              </>
            ) : (
              <>
                <Mail size={20} />
                发送重置邮件
              </>
            )}
          </button>
        </form>

        {/* Footer - Switch Mode */}
        <div className="px-6 py-4 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 text-center">
          <p className="text-slate-500 dark:text-zinc-500 text-sm">
            {mode === 'login' ? (
              <>
                还没有账户？{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
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
                  onClick={() => switchMode('login')}
                  className="text-endfield-yellow hover:text-yellow-500 font-bold uppercase text-xs tracking-wider"
                >
                  登录
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-slate-500 dark:text-zinc-500 hover:text-endfield-yellow transition-colors text-sm flex items-center gap-1 mx-auto"
              >
                <ArrowLeft size={14} />
                返回登录
              </button>
            )}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-up {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
        .animate-scale-up {
          animation: scale-up 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
