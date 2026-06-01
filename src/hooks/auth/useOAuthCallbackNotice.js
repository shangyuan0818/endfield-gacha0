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

function buildOAuthNotice(result, isEnglish) {
  const providerLabel = getProviderLabel(result.provider);
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
    return {
      type: 'warning',
      category: 'account',
      priority: 'normal',
      title: isEnglish ? `${providerLabel} is not available` : `${providerLabel} 暂不可用`,
      message: isEnglish
        ? 'This provider has not been fully configured on the server yet.'
        : '该登录方式的服务端配置尚未完成。',
      dedupeKey: `oauth:${result.provider}:disabled`,
      diagnostic: {
        provider: result.provider,
        code: result.code,
      },
    };
  }

  return {
    type: 'error',
    category: 'account',
    priority: 'normal',
    title: isEnglish ? `${providerLabel} callback failed` : `${providerLabel} 回调失败`,
    message: isEnglish
      ? 'The provider callback could not be verified. Use email sign-in for now.'
      : '第三方回调未能完成校验。请先使用邮箱登录。',
    dedupeKey: `oauth:${result.provider || 'unknown'}:${result.code || 'error'}`,
    diagnostic: {
      provider: result.provider,
      code: result.code,
    },
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
