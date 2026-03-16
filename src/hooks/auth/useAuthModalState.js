import { useEffect, useState } from 'react';

const MAINSTREAM_EMAIL_DOMAINS = [
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
  'qq.com', 'foxmail.com',
  '163.com', '126.com', 'yeah.net', 'netease.com',
  'sina.com', 'sina.cn',
  'sohu.com',
  'aliyun.com', 'alibaba-inc.com',
  '189.cn', '21cn.com',
  'tom.com',
];

const COMMUNITY_EMAIL_DOMAINS = [
  'linux.do',
  'v2ex.com',
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'sourcehut.org',
];

const CORPORATE_EMAIL_PATTERNS = [
  'microsoft.com', 'apple.com', 'google.com', 'amazon.com', 'meta.com', 'facebook.com',
  'tencent.com', 'alibaba.com', 'bytedance.com', 'baidu.com', 'netease.com', 'bilibili.com',
  'mihoyo.com', 'hypergryph.com', 'grfrline.com',
];

const validateEmailDomain = (email) => {
  if (!email || !email.includes('@')) {
    return { valid: false, reason: '邮箱格式不正确' };
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    return { valid: false, reason: '邮箱格式不正确' };
  }

  if (MAINSTREAM_EMAIL_DOMAINS.includes(domain)) {
    return { valid: true };
  }

  if (COMMUNITY_EMAIL_DOMAINS.includes(domain)) {
    return { valid: true };
  }

  if (CORPORATE_EMAIL_PATTERNS.includes(domain)) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: '请使用主流邮箱服务商（如 Gmail、Outlook、QQ邮箱、163邮箱等）、知名论坛/社区邮箱或企业邮箱注册',
  };
};

const validateEmail = (email) => {
  if (!email) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export function useAuthModalState() {
  const [mode, setMode] = useState('login');
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
  const [resendCooldown, setResendCooldown] = useState(0);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;

    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleEmailChange = (event) => {
    const newEmail = event.target.value;
    setEmail(newEmail);
    setEmailValid(validateEmail(newEmail));
    setShowDuplicateEmailPrompt(false);

    if (mode === 'register' && newEmail && validateEmail(newEmail)) {
      const domainResult = validateEmailDomain(newEmail);
      setEmailDomainError(domainResult.valid ? '' : domainResult.reason);
      return;
    }

    setEmailDomainError('');
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
    setEmailDomainError('');
    setResendCooldown(0);
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

  const switchToRegisterWithEmail = () => {
    const nextEmail = email;
    resetForm();
    setMode('register');
    setEmail(nextEmail);
    setEmailValid(validateEmail(nextEmail));

    if (nextEmail && validateEmail(nextEmail)) {
      const domainResult = validateEmailDomain(nextEmail);
      setEmailDomainError(domainResult.valid ? '' : domainResult.reason);
    }
  };

  return {
    agreedToTerms,
    confirmPassword,
    email,
    emailDomainError,
    emailValid,
    error,
    hasEmailError: Boolean(email && (!emailValid || (mode === 'register' && emailDomainError))),
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
    resetForm,
    switchMode,
    switchToForgotPassword,
    switchToLoginWithEmail,
    switchToRegisterWithEmail,
  };
}
