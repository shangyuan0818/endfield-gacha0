import React from 'react';
import { supabase } from './supabaseClient';
import { getSimpleFriendlyError } from './utils/errorMessages';
import AuthModalView from './components/auth/AuthModalView';
import { useAuthModalState } from './hooks/auth/useAuthModalState';
import { useI18n } from './i18n/index.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createEmptyRecoveryForm(requestType = '') {
  return {
    requestType,
    claimedAccountCount: '1',
    verificationClaims: [{ gameUid: '', nickName: '' }],
    note: ''
  };
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const { isEnglish } = useI18n();
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
    switchToRegisterWithEmail,
  } = useAuthModalState();
  const tt = React.useCallback((zh, en) => (isEnglish ? en : zh), [isEnglish]);
  const [forgotPasswordStatus, setForgotPasswordStatus] = React.useState(null);
  const [recoveryRequestForm, setRecoveryRequestForm] = React.useState(() => createEmptyRecoveryForm());
  const [recoveryRequestLoading, setRecoveryRequestLoading] = React.useState(false);
  const [recoveryRequestError, setRecoveryRequestError] = React.useState('');
  const [recoveryRequestSuccess, setRecoveryRequestSuccess] = React.useState(null);

  const resetRecoveryRequestState = React.useCallback(() => {
    setRecoveryRequestForm(createEmptyRecoveryForm());
    setRecoveryRequestLoading(false);
    setRecoveryRequestError('');
    setRecoveryRequestSuccess(null);
  }, []);

  React.useEffect(() => {
    if (mode !== 'forgotPassword') {
      setForgotPasswordStatus(null);
      resetRecoveryRequestState();
    }
  }, [mode, resetRecoveryRequestState]);

  const getLocalizedAuthError = React.useCallback((err) => {
    const rawMessage = String(err?.message || err || '').trim();
    const lowerMessage = rawMessage.toLowerCase();

    if (!rawMessage) {
      return tt('操作失败，请稍后重试', 'Request failed. Please try again later.');
    }

    if (lowerMessage.includes('invalid login credentials') || lowerMessage.includes('invalid_credentials')) {
      return tt('邮箱或密码错误，请检查后重试。', 'Incorrect email or password. Check your credentials and try again.');
    }

    if (lowerMessage.includes('email not confirmed')) {
      return tt('邮箱尚未验证，请先完成邮箱验证。', 'Your email is not confirmed yet. Finish email verification first.');
    }

    if (lowerMessage.includes('already registered') || lowerMessage.includes('user already exists')) {
      return tt('该邮箱已被注册。', 'This email is already registered.');
    }

    if (lowerMessage.includes('sending confirmation') || lowerMessage.includes('confirmation email')) {
      return tt('邮件服务暂时不可用，请稍后再试。', 'Email delivery is unavailable right now. Please try again later.');
    }

    if (lowerMessage.includes('unable to validate email')) {
      return tt('无法验证邮箱地址，请检查后重试。', 'Unable to validate this email address. Check it and try again.');
    }

    if (lowerMessage.includes('failed to fetch') || lowerMessage.includes('network request failed')) {
      return tt('网络连接失败，请检查网络后重试。', 'Network request failed. Check your connection and try again.');
    }

    if (lowerMessage.includes('auth admin not configured')) {
      return tt(
        '当前环境未启用安全的账号恢复流程，请联系管理员协助处理。',
        'Secure account recovery is not enabled in this environment. Contact an administrator.'
      );
    }

    return isEnglish ? rawMessage : getSimpleFriendlyError(err);
  }, [isEnglish, tt]);

  if (!isOpen) return null;

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

  const lookupAccountStatus = async (lookupEmail) => {
    const response = await fetch('/api/auth-account-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: lookupEmail
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true) {
      if (response.status === 429 && payload?.retry_after) {
        throw new Error(tt(
          `查询过于频繁，请 ${Math.ceil(payload.retry_after / 60)} 分钟后再试`,
          `Too many checks. Try again in ${Math.ceil(payload.retry_after / 60)} minute(s).`
        ));
      }

      if (payload?.error === 'Auth admin not configured') {
        throw new Error(tt(
          '当前环境未启用安全的账号恢复流程，请联系管理员协助处理。',
          'Secure account recovery is not enabled in this environment. Contact an administrator.'
        ));
      }

      throw new Error(payload?.error || tt('无法检查账号状态，请稍后重试', 'Unable to check account status right now. Try again later.'));
    }

    return payload;
  };

  const createRecoveryRequest = async (payload) => {
    const response = await fetch('/api/account-recovery-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || result?.success !== true) {
      if (response.status === 409) {
        throw new Error(tt('该邮箱已有待处理的恢复申请，请勿重复提交。', 'A pending recovery request already exists for this email.'));
      }

      if (response.status === 404) {
        throw new Error(tt('该邮箱尚未注册，请先注册。', 'This email is not registered yet. Please sign up first.'));
      }

      if (response.status === 429 && result?.retry_after) {
        throw new Error(tt(
          `提交过于频繁，请 ${Math.ceil(result.retry_after / 60)} 分钟后再试`,
          `Too many submissions. Try again in ${Math.ceil(result.retry_after / 60)} minute(s).`
        ));
      }

      throw new Error(result?.error || tt('提交账号恢复申请失败，请稍后重试', 'Failed to submit the recovery request. Try again later.'));
    }

    return result.data;
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const rateLimitResult = await checkRateLimit('login');
      if (!rateLimitResult.allowed) {
        const retryAfter = rateLimitResult.retry_after ? Math.ceil(rateLimitResult.retry_after / 60) : 30;
        setError(tt(
          `登录尝试过于频繁，请 ${retryAfter} 分钟后再试`,
          `Too many sign-in attempts. Try again in ${retryAfter} minute(s).`
        ));
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
      setError(getLocalizedAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    setForgotPasswordStatus(null);
    resetRecoveryRequestState();

    if (!EMAIL_REGEX.test(email)) {
      setError(tt('请输入有效的邮箱地址', 'Enter a valid email address.'));
      setLoading(false);
      return;
    }

    try {
      const rateLimitResult = await checkRateLimit('password_reset');
      if (!rateLimitResult.allowed) {
        const retryAfter = rateLimitResult.retry_after ? Math.ceil(rateLimitResult.retry_after / 60) : 60;
        setError(tt(
          `请求过于频繁，请 ${retryAfter} 分钟后再试`,
          `Too many requests. Try again in ${retryAfter} minute(s).`
        ));
        setLoading(false);
        return;
      }

      const accountStatus = await lookupAccountStatus(email);
      setForgotPasswordStatus(accountStatus.registered ? 'registered' : 'unregistered');
      setResendCooldown(30);
    } catch (err) {
      setError(getLocalizedAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (!EMAIL_REGEX.test(email)) {
      setError(tt('请输入有效的邮箱地址', 'Enter a valid email address.'));
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError(tt('密码至少需要 6 位字符', 'Password must be at least 6 characters.'));
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError(tt('两次输入的密码不一致', 'The passwords do not match.'));
      setLoading(false);
      return;
    }

    if (!agreedToTerms) {
      setError(tt('请阅读并同意隐私政策和用户协议', 'Read and accept the Privacy Policy and Terms first.'));
      setLoading(false);
      return;
    }

    try {
      const rateLimitResult = await checkRateLimit('register');
      if (!rateLimitResult.allowed) {
        const retryAfter = rateLimitResult.retry_after ? Math.ceil(rateLimitResult.retry_after / 60) : 60;
        setError(tt(
          `注册尝试过于频繁，请 ${retryAfter} 分钟后再试`,
          `Too many sign-up attempts. Try again in ${retryAfter} minute(s).`
        ));
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
          setError(tt('该邮箱已被注册', 'This email is already registered.'));
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
          setMessage(tt('注册成功！请直接登录。', 'Registration complete. You can sign in now.'));
        }
      }
    } catch (err) {
      let errorMessage = tt('注册失败，请重试', 'Sign-up failed. Please try again.');

      if (err.message.includes('Invalid email')) {
        errorMessage = tt('邮箱格式不正确', 'The email format is invalid.');
      } else if (err.message.includes('Password should be at least')) {
        errorMessage = tt('密码长度不足，至少需要 6 位字符', 'Password is too short. Use at least 6 characters.');
      } else if (err.message.includes('Unable to validate email')) {
        errorMessage = tt('无法验证邮箱地址，请检查邮箱是否正确', 'Unable to validate this email address. Check it and try again.');
      } else if (
        err.message.toLowerCase().includes('sending confirmation') ||
        err.message.toLowerCase().includes('confirmation email')
      ) {
        errorMessage = tt('邮件服务暂时不可用，请稍后再试或联系管理员', 'Email delivery is unavailable. Try again later or contact an administrator.');
      } else if (err.message) {
        errorMessage = isEnglish ? err.message : err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const openRecoveryRequestForm = (requestType) => {
    setRecoveryRequestForm((prev) => ({
      ...createEmptyRecoveryForm(requestType),
      claimedAccountCount: prev.claimedAccountCount || '1',
      verificationClaims: prev.verificationClaims?.length
        ? prev.verificationClaims
        : [{ gameUid: '', nickName: '' }],
      note: prev.note || ''
    }));
    setRecoveryRequestError('');
    setRecoveryRequestSuccess(null);
  };

  const closeRecoveryRequestForm = () => {
    resetRecoveryRequestState();
  };

  const handleRecoveryClaimChange = (index, field, value) => {
    setRecoveryRequestForm((prev) => ({
      ...prev,
      verificationClaims: prev.verificationClaims.map((claim, claimIndex) => (
        claimIndex === index
          ? { ...claim, [field]: value }
          : claim
      ))
    }));
  };

  const handleAddRecoveryClaim = () => {
    setRecoveryRequestForm((prev) => ({
      ...prev,
      verificationClaims: prev.verificationClaims.length >= 5
        ? prev.verificationClaims
        : [...prev.verificationClaims, { gameUid: '', nickName: '' }]
    }));
  };

  const handleRemoveRecoveryClaim = (index) => {
    setRecoveryRequestForm((prev) => ({
      ...prev,
      verificationClaims: prev.verificationClaims.length <= 1
        ? prev.verificationClaims
        : prev.verificationClaims.filter((_, claimIndex) => claimIndex !== index)
    }));
  };

  const handleSubmitRecoveryRequest = async () => {
    setRecoveryRequestLoading(true);
    setRecoveryRequestError('');
    setRecoveryRequestSuccess(null);

    if (!EMAIL_REGEX.test(email)) {
      setRecoveryRequestError(tt('请输入有效的邮箱地址', 'Enter a valid email address.'));
      setRecoveryRequestLoading(false);
      return;
    }

    if (!recoveryRequestForm.requestType) {
      setRecoveryRequestError(tt('请选择恢复申请类型', 'Select a recovery request type.'));
      setRecoveryRequestLoading(false);
      return;
    }

    const normalizedClaims = recoveryRequestForm.verificationClaims
      .map((claim) => ({
        gameUid: String(claim.gameUid || '').trim(),
        nickName: String(claim.nickName || '').trim()
      }))
      .filter((claim) => claim.gameUid || claim.nickName);

    if (normalizedClaims.length === 0) {
      setRecoveryRequestError(tt('请至少填写一组 UID 和昵称作为身份核验信息', 'Add at least one UID and nickname pair for verification.'));
      setRecoveryRequestLoading(false);
      return;
    }

    const hasIncompleteClaim = normalizedClaims.some((claim) => !claim.gameUid || !claim.nickName);
    if (hasIncompleteClaim) {
      setRecoveryRequestError(tt('每组核验信息都需要同时填写 UID 和昵称', 'Each verification clue needs both UID and nickname.'));
      setRecoveryRequestLoading(false);
      return;
    }

    try {
      const result = await createRecoveryRequest({
        email,
        requestType: recoveryRequestForm.requestType,
        claimedAccountCount: recoveryRequestForm.claimedAccountCount,
        verificationClaims: normalizedClaims,
        note: recoveryRequestForm.note
      });

      setRecoveryRequestSuccess({
        id: result?.id || null,
        requestType: recoveryRequestForm.requestType
      });
      setRecoveryRequestError('');
    } catch (err) {
      setRecoveryRequestError(getLocalizedAuthError(err));
    } finally {
      setRecoveryRequestLoading(false);
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
      forgotPasswordStatus={forgotPasswordStatus}
      hasEmailError={hasEmailError}
      loading={loading}
      message={message}
      mode={mode}
      onAgreedToTermsChange={(event) => setAgreedToTerms(event.target.checked)}
      onClose={onClose}
      onConfirmPasswordChange={(event) => setConfirmPassword(event.target.value)}
      onPasswordChange={(event) => setPassword(event.target.value)}
      onSubmit={handleSubmit}
      onSwitchMode={switchMode}
      onSwitchToForgotPassword={switchToForgotPassword}
      onSwitchToLoginWithEmail={switchToLoginWithEmail}
      onSwitchToRegisterWithEmail={switchToRegisterWithEmail}
      onUsernameChange={(event) => setUsername(event.target.value)}
      password={password}
      resendCooldown={resendCooldown}
      recoveryRequestError={recoveryRequestError}
      recoveryRequestForm={recoveryRequestForm}
      recoveryRequestLoading={recoveryRequestLoading}
      recoveryRequestSuccess={recoveryRequestSuccess}
      showDuplicateEmailPrompt={showDuplicateEmailPrompt}
      submitDisabled={submitDisabled}
      username={username}
      onAddRecoveryClaim={handleAddRecoveryClaim}
      onCloseRecoveryRequest={closeRecoveryRequestForm}
      onEmailChange={(event) => {
        if (mode === 'forgotPassword') {
          setForgotPasswordStatus(null);
          setMessage('');
          setError('');
          resetRecoveryRequestState();
        }
        handleEmailChange(event);
      }}
      onOpenRecoveryRequest={openRecoveryRequestForm}
      onRecoveryClaimChange={handleRecoveryClaimChange}
      onRecoveryClaimedAccountCountChange={(event) => {
        setRecoveryRequestForm((prev) => ({
          ...prev,
          claimedAccountCount: event.target.value
        }));
      }}
      onRecoveryNoteChange={(event) => {
        setRecoveryRequestForm((prev) => ({
          ...prev,
          note: event.target.value
        }));
      }}
      onRemoveRecoveryClaim={handleRemoveRecoveryClaim}
      onSubmitRecoveryRequest={handleSubmitRecoveryRequest}
    />
  );
}
