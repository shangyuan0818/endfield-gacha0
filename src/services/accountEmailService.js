import { supabase } from '../supabaseClient';
import { fetchJsonWithTimeout } from './supabaseRequest.js';

export class AccountEmailActionError extends Error {
  constructor(message, {
    code = '',
    status = 0,
    retryAfter = 0,
    partial = false,
    sent = null,
  } = {}) {
    super(message || 'Account email action failed');
    this.name = 'AccountEmailActionError';
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
    this.partial = partial;
    this.sent = sent;
  }
}

async function getAccessToken() {
  if (!supabase) {
    return null;
  }

  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function postAccountEmailAction(body, {
  label = 'account-email-action',
  timeoutMs = 30000,
} = {}) {
  if (!supabase) {
    throw new AccountEmailActionError('Supabase is not configured', { code: 'supabase_not_configured' });
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new AccountEmailActionError('当前登录态已失效，请重新登录后再试', { code: 'session_expired', status: 401 });
  }

  const { response, data: payload } = await fetchJsonWithTimeout('/api/account-email-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  }, {
    label,
    timeoutMs,
    retries: 0,
  });

  if (!response.ok || payload?.success !== true) {
    throw new AccountEmailActionError(payload?.error || '邮箱操作失败，请稍后重试', {
      code: payload?.code || '',
      status: response.status,
      retryAfter: payload?.retry_after || 0,
      partial: Boolean(payload?.partial),
      sent: payload?.sent || null,
    });
  }

  return payload;
}

export function isUserEmailVerified(user, {
  emailVerificationRequired = false,
} = {}) {
  if (emailVerificationRequired) {
    return false;
  }

  return Boolean(
    user?.email_confirmed_at
    || user?.confirmed_at
    || user?.user_metadata?.email_verified
    || user?.identities?.some?.((identity) => identity?.identity_data?.email_verified === true)
  );
}

export async function requestCurrentEmailVerification({ locale } = {}) {
  return postAccountEmailAction({
    action: 'resend_verification',
    locale,
  }, {
    label: 'account-email-action:resend-verification',
  });
}

export async function requestEmailChange({
  newEmail,
  currentPassword,
  locale,
} = {}) {
  return postAccountEmailAction({
    action: 'change_email',
    newEmail,
    currentPassword,
    locale,
  }, {
    label: 'account-email-action:change-email',
    timeoutMs: 45000,
  });
}

export default {
  AccountEmailActionError,
  isUserEmailVerified,
  requestCurrentEmailVerification,
  requestEmailChange,
};
