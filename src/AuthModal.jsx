import React from 'react';
import { supabase } from './supabaseClient';
import { getSimpleFriendlyError } from './utils/errorMessages';
import AuthModalView from './components/auth/AuthModalView';
import { useAuthModalState } from './hooks/auth/useAuthModalState';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const {
    agreedToTerms,
    confirmPassword,
    email,
    emailDomainError,
    emailValid,
    error,
    hasEmailError,
    loading,
    message,
    mode,
    password,
    resendCooldown,
    showDuplicateEmailPrompt,
    username,
    setAgreedToTerms,
    setConfirmPassword,
    setError,
    setLoading,
    setMessage,
    setPassword,
    setResendCooldown,
    setShowDuplicateEmailPrompt,
    setUsername,
    handleEmailChange,
    switchMode,
    switchToForgotPassword,
    switchToLoginWithEmail,
  } = useAuthModalState();

  if (!isOpen) return null;
  
  // 检查频率限制（生产环境走服务端边界，本地开发允许回退）
  const checkRateLimit = async (action) => {
    try {
      const response = await fetch('/api/auth-rate-limit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        const fallbackPayload = await response.json().catch(() => null);
        if (fallbackPayload?.allowed === false) {
          return fallbackPayload;
        }

        if (import.meta.env.DEV) {
          return { allowed: true };
        }

        return { allowed: false, retry_after: 60 };
      }

      const payload = await response.json();
      return payload || { allowed: true };
    } catch {
      if (import.meta.env.DEV) {
        return { allowed: true };
      }

      return { allowed: false, retry_after: 60 };
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const rateLimitResult = await checkRateLimit('login');
      if (!rateLimitResult.allowed) {
        const retryAfter = rateLimitResult.retry_after ? Math.ceil(rateLimitResult.retry_after / 60) : 30;
        setError(`登录尝试过于频繁，请 ${retryAfter} 分钟后再试`);
        setLoading(false);
        return;
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setError(getSimpleFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('请输入有效的邮箱地址');
      setLoading(false);
      return;
    }

    try {
      const rateLimitResult = await checkRateLimit('password_reset');
      if (!rateLimitResult.allowed) {
        const retryAfter = rateLimitResult.retry_after ? Math.ceil(rateLimitResult.retry_after / 60) : 60;
        setError(`请求过于频繁，请 ${retryAfter} 分钟后再试`);
        setLoading(false);
        return;
      }

      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/reset-password`,
      });

      if (authError) throw authError;

      setMessage('密码重置邮件已发送！请查收邮箱并点击链接重置密码。');
      setResendCooldown(60);
    } catch (err) {
      setError(getSimpleFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('请输入有效的邮箱地址');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('密码至少需要 6 位字符');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      setLoading(false);
      return;
    }

    if (!agreedToTerms) {
      setError('请阅读并同意隐私政策和用户协议');
      setLoading(false);
      return;
    }

    try {
      const rateLimitResult = await checkRateLimit('register');
      if (!rateLimitResult.allowed) {
        const retryAfter = rateLimitResult.retry_after ? Math.ceil(rateLimitResult.retry_after / 60) : 60;
        setError(`注册尝试过于频繁，请 ${retryAfter} 分钟后再试`);
        setLoading(false);
        return;
      }

      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username || email.split('@')[0],
          },
          emailRedirectTo: appUrl,
        },
      });

      if (authError) {
        if (
          authError.message.toLowerCase().includes('already registered') ||
          authError.message.toLowerCase().includes('user already registered') ||
          authError.message.toLowerCase().includes('email already exists') ||
          authError.status === 422
        ) {
          setError('该邮箱已被注册');
          setShowDuplicateEmailPrompt(true);
          return;
        }
        throw authError;
      }

      if (data.user) {
        if (data.session) {
          onAuthSuccess(data.user);
          onClose();
        } else {
          setMessage('注册成功！请直接登录。');
        }
      }
    } catch (err) {
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

  const handleSubmit =
    mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleForgotPassword;

  const submitDisabled =
    loading ||
    (mode === 'register' && (hasEmailError || Boolean(emailDomainError) || !agreedToTerms)) ||
    (mode === 'forgotPassword' && resendCooldown > 0);

  return (
    <AuthModalView
      agreedToTerms={agreedToTerms}
      confirmPassword={confirmPassword}
      email={email}
      emailDomainError={emailDomainError}
      emailValid={emailValid}
      error={error}
      hasEmailError={hasEmailError}
      loading={loading}
      message={message}
      mode={mode}
      onAgreedToTermsChange={(event) => setAgreedToTerms(event.target.checked)}
      onClose={onClose}
      onConfirmPasswordChange={(event) => setConfirmPassword(event.target.value)}
      onEmailChange={handleEmailChange}
      onPasswordChange={(event) => setPassword(event.target.value)}
      onSubmit={handleSubmit}
      onSwitchMode={switchMode}
      onSwitchToForgotPassword={switchToForgotPassword}
      onSwitchToLoginWithEmail={switchToLoginWithEmail}
      onUsernameChange={(event) => setUsername(event.target.value)}
      password={password}
      resendCooldown={resendCooldown}
      showDuplicateEmailPrompt={showDuplicateEmailPrompt}
      submitDisabled={submitDisabled}
      username={username}
    />
  );
}
