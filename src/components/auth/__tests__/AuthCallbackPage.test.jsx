import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/index.js';
import AuthCallbackPage from '../AuthCallbackPage.jsx';

const authMock = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
}));

const storeMocks = vi.hoisted(() => ({
  setUser: vi.fn(),
  openAuthModal: vi.fn(),
}));

vi.mock('../../../supabaseClient.js', () => ({
  supabase: {
    auth: authMock,
  },
}));

vi.mock('../../../stores/useAuthStore.js', () => ({
  default: (selector) => selector({
    setUser: storeMocks.setUser,
    openAuthModal: storeMocks.openAuthModal,
  }),
}));

function renderCallbackPage(path) {
  window.history.replaceState(null, '', path);
  return render(
    <I18nProvider initialLocale="zh-CN">
      <BrowserRouter>
        <AuthCallbackPage />
      </BrowserRouter>
    </I18nProvider>
  );
}

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.getUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  it('treats an already established OAuth session as success when the callback code was consumed by the SDK', async () => {
    const user = { id: 'user-1' };
    authMock.getSession.mockResolvedValue({ data: { session: { user } }, error: null });

    renderCallbackPage('/auth/callback?next=%2Fsettings');

    await waitFor(() => {
      expect(screen.getByText('登录成功')).toBeInTheDocument();
    });
    expect(authMock.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(storeMocks.setUser).toHaveBeenCalledWith(user);
    expect(window.location.pathname).toBe('/auth/callback');
    expect(window.location.search).toBe('?next=%2Fsettings');
  });

  it('exchanges a fresh PKCE callback code when it is still present in the URL', async () => {
    const user = { id: 'user-2' };
    authMock.exchangeCodeForSession.mockResolvedValue({
      data: { session: { user } },
      error: null,
    });

    renderCallbackPage('/auth/callback?code=auth-code&next=%2Fsettings');

    await waitFor(() => {
      expect(screen.getByText('登录成功')).toBeInTheDocument();
    });
    expect(authMock.exchangeCodeForSession).toHaveBeenCalledWith('auth-code');
    expect(storeMocks.setUser).toHaveBeenCalledWith(user);
    expect(window.location.search).toBe('?next=%2Fsettings');
  });

  it('keeps the missing-code error when no session exists', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: null });
    authMock.getUser.mockResolvedValue({ data: { user: null }, error: null });

    renderCallbackPage('/auth/callback?next=%2Fsettings');

    await waitFor(() => {
      expect(screen.getByText('登录未完成')).toBeInTheDocument();
    });
    expect(screen.getByText('回调地址缺少授权码，请重新登录。')).toBeInTheDocument();
  });
});
