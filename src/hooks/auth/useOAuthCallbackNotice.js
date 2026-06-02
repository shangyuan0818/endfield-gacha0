import { useEffect } from 'react';
import { consumeOAuthResultParams } from '../../services/authOAuthService.js';
import { useI18n } from '../../i18n/index.js';

const PROVIDER_LABELS = {
  linuxdo: 'Linux.do',
  github: 'GitHub',
  qq: 'QQ',
};

function getProviderLabel(provider) {
  return PROVIDER_LABELS[String(provider || '').toLowerCase()] || '第三方账号';
}

function getOAuthErrorCopy(result, providerLabel, isEnglish) {
  const code = String(result?.code || '').trim().toLowerCase();
  const commonDiagnostic = {
    provider: result.provider,
    code: result.code,
  };

  if (code === 'redirect_uri_mismatch') {
    return {
      title: isEnglish ? `${providerLabel} callback address mismatch` : `${providerLabel} 回调地址不匹配`,
      message: isEnglish
        ? 'The provider rejected the callback address. The site administrator needs to verify the OAuth callback URL in the provider console. Use email sign-in for now.'
        : '第三方平台拒绝了当前回调地址。需要管理员核对平台后台的 OAuth 回调地址；你可以先使用邮箱登录。',
      diagnostic: {
        ...commonDiagnostic,
        expectedCallback: 'https://ef-gacha.mogujun.icu/api/auth/oauth/{provider}/callback',
      },
    };
  }

  if (
    code === 'invalid_client'
    || code === 'oauth_client_id_missing'
    || code === 'oauth_client_secret_missing'
    || code === 'oauth_provider_disabled'
  ) {
    return {
      title: isEnglish ? `${providerLabel} service configuration failed` : `${providerLabel} 服务配置异常`,
      message: isEnglish
        ? 'The provider credentials or server switch are not valid. This needs an administrator check; use email sign-in for now.'
        : '该登录方式的服务端凭据或开关配置不正确，需要管理员检查；你可以先使用邮箱登录。',
      diagnostic: commonDiagnostic,
    };
  }

  if (
    code === 'oauth_state_malformed'
    || code === 'oauth_state_invalid_signature'
    || code === 'oauth_state_invalid_payload'
    || code === 'oauth_state_provider_mismatch'
    || code === 'oauth_state_expired'
    || code === 'oauth_state_secret_missing'
  ) {
    return {
      title: isEnglish ? `${providerLabel} authorization expired` : `${providerLabel} 授权状态已失效`,
      message: isEnglish
        ? 'The authorization state is missing, expired, or no longer matches this browser session. Start sign-in again from the same browser tab.'
        : '本次授权状态缺失、过期或与当前浏览器会话不一致。请从当前浏览器标签页重新发起登录。',
      diagnostic: commonDiagnostic,
    };
  }

  if (code === 'oauth_code_missing') {
    return {
      title: isEnglish ? `${providerLabel} authorization code missing` : `${providerLabel} 缺少授权码`,
      message: isEnglish
        ? 'The provider did not return an authorization code. Start sign-in again; if it repeats, use email sign-in for now.'
        : '第三方平台没有返回授权码。请重新发起登录；如果重复出现，请先使用邮箱登录。',
      diagnostic: commonDiagnostic,
    };
  }

  if (code === 'oauth_identity_already_linked') {
    return {
      title: isEnglish ? `${providerLabel} already linked elsewhere` : `${providerLabel} 已绑定到其他账号`,
      message: isEnglish
        ? 'This provider account is already linked to another site account. Sign in with that account first or use a different sign-in method.'
        : '这个第三方账号已经绑定到另一个站内账号。请先登录对应账号，或使用其他登录方式。',
      diagnostic: commonDiagnostic,
      actions: [
        { label: isEnglish ? 'Open Settings' : '打开设置', href: '/settings', variant: 'primary' },
      ],
    };
  }

  if (code === 'site_session_required' || code === 'oauth_identity_link_failed') {
    return {
      title: isEnglish ? `${providerLabel} link failed` : `${providerLabel} 绑定失败`,
      message: isEnglish
        ? 'The site session was not available when linking this provider. Sign in first, then retry from Settings.'
        : '绑定时没有可用的站内登录状态。请先登录，再从设置页重新绑定。',
      diagnostic: commonDiagnostic,
      actions: [
        { label: isEnglish ? 'Open Settings' : '打开设置', href: '/settings', variant: 'primary' },
      ],
    };
  }

  return {
    title: isEnglish ? `${providerLabel} callback failed` : `${providerLabel} 回调失败`,
    message: isEnglish
      ? 'The provider callback could not be verified. Use email sign-in for now.'
      : '第三方回调未能完成校验。请先使用邮箱登录。',
    diagnostic: commonDiagnostic,
  };
}

export function buildOAuthNotice(result, isEnglish) {
  const providerLabel = getProviderLabel(result.provider);
  if (result.status === 'signed_in') {
    return {
      type: 'success',
      category: 'account',
      priority: 'normal',
      title: isEnglish ? `${providerLabel} sign-in complete` : `${providerLabel} 登录成功`,
      message: isEnglish
        ? 'The site session has been created. You can continue from the current page.'
        : '本站登录状态已建立，你可以继续在当前页面使用。',
      dedupeKey: `oauth:${result.provider}:signed_in`,
      actions: [
        { label: isEnglish ? 'Open Settings' : '打开设置', href: '/settings', variant: 'primary' },
      ],
    };
  }

  if (result.status === 'verified') {
    return {
      type: 'info',
      category: 'account',
      priority: 'normal',
      title: isEnglish ? `${providerLabel} verified` : `${providerLabel} 授权已完成`,
      message: isEnglish
        ? 'The provider callback has been verified. Sign in with your site account, then finish account linking in Settings when the binding flow is enabled.'
        : '第三方回调已完成校验。当前会先保留这次授权结果；请登录站内账号，后续在设置页完成绑定。',
      dedupeKey: `oauth:${result.provider}:verified`,
      actions: [
        { label: isEnglish ? 'Open Settings' : '打开设置', href: '/settings', variant: 'primary' },
      ],
    };
  }

  if (result.status === 'linked') {
    return {
      type: 'success',
      category: 'account',
      priority: 'normal',
      title: isEnglish ? `${providerLabel} linked` : `${providerLabel} 绑定成功`,
      message: isEnglish
        ? 'This sign-in method has been linked to your current account. You can manage it in Settings.'
        : '该登录方式已绑定到当前账号。你可以在设置页继续管理登录方式。',
      dedupeKey: `oauth:${result.provider}:linked`,
      actions: [
        { label: isEnglish ? 'Open Settings' : '打开设置', href: '/settings', variant: 'primary' },
      ],
    };
  }

  if (result.status === 'cancelled') {
    return {
      type: 'warning',
      category: 'account',
      priority: 'normal',
      title: isEnglish ? `${providerLabel} sign-in cancelled` : `${providerLabel} 授权已取消`,
      message: isEnglish
        ? 'The provider did not grant authorization. You can continue using email sign-in.'
        : '第三方没有完成授权。你仍可以继续使用邮箱登录。',
      dedupeKey: `oauth:${result.provider}:cancelled`,
    };
  }

  if (result.status === 'disabled') {
    const disabledCopy = getOAuthErrorCopy({
      ...result,
      code: result.code || 'oauth_provider_disabled',
    }, providerLabel, isEnglish);
    return {
      type: 'warning',
      category: 'account',
      priority: 'normal',
      title: disabledCopy.title,
      message: disabledCopy.message,
      dedupeKey: `oauth:${result.provider}:disabled`,
      diagnostic: disabledCopy.diagnostic,
    };
  }

  const errorCopy = getOAuthErrorCopy(result, providerLabel, isEnglish);
  return {
    type: 'error',
    category: 'account',
    priority: 'normal',
    title: errorCopy.title,
    message: errorCopy.message,
    dedupeKey: `oauth:${result.provider || 'unknown'}:${result.code || 'error'}`,
    diagnostic: errorCopy.diagnostic,
    actions: errorCopy.actions || [],
  };
}

export function useOAuthCallbackNotice({
  location,
  navigate,
  addDurableNotification,
}) {
  const { isEnglish } = useI18n();

  useEffect(() => {
    const result = consumeOAuthResultParams(location.search);
    if (!result) {
      return;
    }

    addDurableNotification?.(buildOAuthNotice(result, isEnglish));

    const nextSearch = result.nextSearch ? `?${result.nextSearch}` : '';
    navigate(`${location.pathname}${nextSearch}${location.hash || ''}`, { replace: true });
  }, [addDurableNotification, isEnglish, location.hash, location.pathname, location.search, navigate]);
}

export default useOAuthCallbackNotice;
