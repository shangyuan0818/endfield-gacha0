// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const oauthSessionMocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
  createOrLinkOAuthUserAndSession: vi.fn(),
  linkOAuthIdentityToSiteSession: vi.fn(),
}));

vi.mock('../_lib/authAdmin.js', () => ({
  getSupabaseAdminClient: oauthSessionMocks.getSupabaseAdminClient,
}));

vi.mock('../_lib/siteSession.js', async () => {
  const actual = await vi.importActual('../_lib/siteSession.js');
  return {
    ...actual,
    createOrLinkOAuthUserAndSession: oauthSessionMocks.createOrLinkOAuthUserAndSession,
    linkOAuthIdentityToSiteSession: oauthSessionMocks.linkOAuthIdentityToSiteSession,
  };
});

import {
  githubOAuthCallbackHandler,
  githubOAuthStartHandler,
  linuxdoOAuthCallbackHandler,
  linuxdoOAuthStartHandler,
  linuxdoSupabaseAuthorizeHandler,
  qqOAuthStartHandler,
} from '../_routes/root/auth-oauth.js';
import { createOAuthState, verifyOAuthState } from '../_lib/oauthState.js';

const ENV_KEYS = [
  'APP_URL',
  'OAUTH_STATE_SECRET',
  'AUTH_OAUTH_LINUXDO_ENABLED',
  'AUTH_OAUTH_LINUXDO_CLIENT_ID',
  'AUTH_OAUTH_LINUXDO_CLIENT_SECRET',
  'AUTH_OAUTH_LINUXDO_REDIRECT_URI',
  'AUTH_OAUTH_LINUXDO_SCOPE',
  'AUTH_OAUTH_LINUXDO_SEND_REDIRECT_URI',
  'AUTH_OAUTH_LINUXDO_TOKEN_AUTH_METHOD',
  'AUTH_OAUTH_QQ_ENABLED',
  'AUTH_OAUTH_QQ_CLIENT_ID',
  'AUTH_OAUTH_QQ_CLIENT_SECRET',
  'AUTH_OAUTH_GITHUB_ENABLED',
  'AUTH_OAUTH_GITHUB_CLIENT_ID',
  'AUTH_OAUTH_GITHUB_CLIENT_SECRET',
  'AUTH_OAUTH_GITHUB_REDIRECT_URI',
  'AUTH_OAUTH_GITHUB_SCOPE',
  'AUTH_OAUTH_GITHUB_SEND_REDIRECT_URI',
];

function createResponseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    getHeader(name) {
      return this.headers[name];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

function createRequest({
  method = 'GET',
  query = {},
  headers = {},
} = {}) {
  return {
    method,
    query,
    headers: {
      host: 'ef-gacha.mogujun.icu',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': '203.0.113.20',
      'user-agent': 'Vitest',
      ...headers,
    },
    socket: {
      remoteAddress: '127.0.0.1',
    },
  };
}

function setLinuxDoEnv() {
  process.env.APP_URL = 'https://ef-gacha.mogujun.icu';
  process.env.OAUTH_STATE_SECRET = 'test-oauth-state-secret';
  process.env.AUTH_OAUTH_LINUXDO_ENABLED = 'true';
  process.env.AUTH_OAUTH_LINUXDO_CLIENT_ID = 'linuxdo-client-id';
  process.env.AUTH_OAUTH_LINUXDO_CLIENT_SECRET = 'linuxdo-client-secret';
  process.env.AUTH_OAUTH_LINUXDO_REDIRECT_URI = 'https://ef-gacha.mogujun.icu/api/auth/oauth/linuxdo/callback';
}

function setGithubEnv() {
  process.env.APP_URL = 'https://ef-gacha.mogujun.icu';
  process.env.OAUTH_STATE_SECRET = 'test-oauth-state-secret';
  process.env.AUTH_OAUTH_GITHUB_ENABLED = 'true';
  process.env.AUTH_OAUTH_GITHUB_CLIENT_ID = 'github-client-id';
  process.env.AUTH_OAUTH_GITHUB_CLIENT_SECRET = 'github-client-secret';
  process.env.AUTH_OAUTH_GITHUB_REDIRECT_URI = 'https://ef-gacha.mogujun.icu/api/auth/oauth/github/callback';
}

beforeEach(() => {
  ENV_KEYS.forEach((key) => {
    delete process.env[key];
  });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  oauthSessionMocks.getSupabaseAdminClient.mockReset();
  oauthSessionMocks.createOrLinkOAuthUserAndSession.mockReset();
  oauthSessionMocks.linkOAuthIdentityToSiteSession.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth OAuth bridge', () => {
  it('redirects Linux.do start requests to the provider with signed state', async () => {
    setLinuxDoEnv();
    const req = createRequest({
      query: {
        returnTo: '/settings?tab=account',
      },
    });
    const res = createResponseRecorder();

    await linuxdoOAuthStartHandler(req, res);

    expect(res.statusCode).toBe(302);
    expect(res.headers['Cache-Control']).toBe('no-store');
    const location = new URL(res.headers.Location);
    expect(location.origin).toBe('https://connect.linux.do');
    expect(location.pathname).toBe('/oauth2/authorize');
    expect(location.searchParams.get('client_id')).toBe('linuxdo-client-id');
    expect(location.searchParams.has('redirect_uri')).toBe(false);
    expect(location.searchParams.get('scope')).toBe('openid profile email');
    const stateResult = verifyOAuthState(location.searchParams.get('state'), {
      expectedProvider: 'linuxdo',
      secret: 'test-oauth-state-secret',
    });
    expect(stateResult.ok).toBe(true);
    expect(stateResult.payload.returnTo).toBe('/settings?tab=account');
  });

  it('strips Supabase redirect_to when proxying Linux.do custom provider authorization', async () => {
    const req = createRequest({
      query: {
        response_type: 'code',
        client_id: 'linuxdo-client-id',
        redirect_uri: 'https://db.15963574.xyz/callback',
        scope: 'read',
        state: 'supabase-state',
        redirect_to: 'https://ef-gacha.mogujun.icu/auth/callback',
      },
    });
    const res = createResponseRecorder();

    await linuxdoSupabaseAuthorizeHandler(req, res);

    expect(res.statusCode).toBe(302);
    const location = new URL(res.headers.Location);
    expect(location.origin).toBe('https://connect.linux.do');
    expect(location.pathname).toBe('/oauth2/authorize');
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('client_id')).toBe('linuxdo-client-id');
    expect(location.searchParams.get('redirect_uri')).toBe('https://db.15963574.xyz/callback');
    expect(location.searchParams.get('scope')).toBe('read');
    expect(location.searchParams.get('state')).toBe('supabase-state');
    expect(location.searchParams.has('redirect_to')).toBe(false);
  });

  it('upgrades the legacy Linux.do read scope to currently supported OIDC scopes', async () => {
    setLinuxDoEnv();
    process.env.AUTH_OAUTH_LINUXDO_SCOPE = 'read';
    const req = createRequest();
    const res = createResponseRecorder();

    await linuxdoOAuthStartHandler(req, res);

    expect(res.statusCode).toBe(302);
    const location = new URL(res.headers.Location);
    expect(location.searchParams.get('scope')).toBe('openid profile email');
  });

  it('can force an explicit Linux.do redirect_uri for provider consoles that require it', async () => {
    setLinuxDoEnv();
    process.env.AUTH_OAUTH_LINUXDO_SEND_REDIRECT_URI = 'true';
    const req = createRequest();
    const res = createResponseRecorder();

    await linuxdoOAuthStartHandler(req, res);

    expect(res.statusCode).toBe(302);
    const location = new URL(res.headers.Location);
    expect(location.searchParams.get('redirect_uri')).toBe('https://ef-gacha.mogujun.icu/api/auth/oauth/linuxdo/callback');
  });

  it('starts GitHub OAuth with the site bridge callback as redirect_uri', async () => {
    setGithubEnv();
    const req = createRequest({
      query: {
        returnTo: '/settings?tab=account',
      },
    });
    const res = createResponseRecorder();

    await githubOAuthStartHandler(req, res);

    expect(res.statusCode).toBe(302);
    const location = new URL(res.headers.Location);
    expect(location.origin).toBe('https://github.com');
    expect(location.pathname).toBe('/login/oauth/authorize');
    expect(location.searchParams.get('client_id')).toBe('github-client-id');
    expect(location.searchParams.get('redirect_uri')).toBe('https://ef-gacha.mogujun.icu/api/auth/oauth/github/callback');
    expect(location.searchParams.get('scope')).toBe('read:user user:email');
    const stateResult = verifyOAuthState(location.searchParams.get('state'), {
      expectedProvider: 'github',
      secret: 'test-oauth-state-secret',
    });
    expect(stateResult.ok).toBe(true);
    expect(stateResult.payload.returnTo).toBe('/settings?tab=account');
  });

  it('redirects provider-disabled starts back to the safe return path', async () => {
    process.env.APP_URL = 'https://ef-gacha.mogujun.icu';
    process.env.OAUTH_STATE_SECRET = 'test-oauth-state-secret';
    const req = createRequest({
      query: {
        returnTo: 'https://evil.example/path',
      },
    });
    const res = createResponseRecorder();

    await qqOAuthStartHandler(req, res);

    expect(res.statusCode).toBe(302);
    const location = new URL(res.headers.Location);
    expect(location.origin).toBe('https://ef-gacha.mogujun.icu');
    expect(location.pathname).toBe('/');
    expect(location.searchParams.get('oauth_status')).toBe('disabled');
    expect(location.searchParams.get('oauth_provider')).toBe('qq');
  });

  it('rejects callback requests with invalid state', async () => {
    setLinuxDoEnv();
    const req = createRequest({
      query: {
        code: 'auth-code',
        state: 'invalid-state',
      },
    });
    const res = createResponseRecorder();

    await linuxdoOAuthCallbackHandler(req, res);

    expect(res.statusCode).toBe(302);
    const location = new URL(res.headers.Location);
    expect(location.searchParams.get('oauth_status')).toBe('error');
    expect(location.searchParams.get('oauth_code')).toBe('oauth_state_malformed');
  });

  it('exchanges Linux.do callback code and creates a site session', async () => {
    setLinuxDoEnv();
    const adminClient = { from: vi.fn() };
    oauthSessionMocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    oauthSessionMocks.createOrLinkOAuthUserAndSession.mockResolvedValue({
      ok: true,
      created: false,
    });
    const state = createOAuthState({
      provider: 'linuxdo',
      returnTo: '/settings',
    }, {
      secret: 'test-oauth-state-secret',
    });
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (String(url).includes('/oauth2/token')) {
        expect(options.headers.Authorization).toBe(`Basic ${Buffer.from('linuxdo-client-id:linuxdo-client-secret').toString('base64')}`);
        expect(String(options.body)).not.toContain('client_id=linuxdo-client-id');
        expect(String(options.body)).not.toContain('client_secret=linuxdo-client-secret');
        expect(String(options.body)).not.toContain('redirect_uri=');
        return new Response(JSON.stringify({ access_token: 'provider-access-token', token_type: 'Bearer' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (String(url).includes('/api/user')) {
        return new Response(JSON.stringify({
          id: 12345,
          username: 'linuxdo-user',
          avatar_template: 'https://linux.do/user_avatar/linux.do/linuxdo-user/{size}/1.png',
          active: true,
          trust_level: 2,
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const req = createRequest({
      query: {
        code: 'auth-code',
        state,
      },
    });
    const res = createResponseRecorder();

    await linuxdoOAuthCallbackHandler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(oauthSessionMocks.createOrLinkOAuthUserAndSession).toHaveBeenCalledWith(adminClient, expect.objectContaining({
      profile: expect.objectContaining({
        provider: 'linuxdo',
        subject: '12345',
        username: 'linuxdo-user',
      }),
      subjectHash: expect.any(String),
      profileHash: expect.any(String),
      req,
      res,
      secret: 'test-oauth-state-secret',
    }));
    expect(res.statusCode).toBe(302);
    expect(String(res.headers['Set-Cookie'] || '')).not.toContain('ef_oauth_pending=');
    const location = new URL(res.headers.Location);
    expect(location.pathname).toBe('/settings');
    expect(location.searchParams.get('oauth_status')).toBe('signed_in');
    expect(location.searchParams.get('oauth_provider')).toBe('linuxdo');
    expect(location.searchParams.get('oauth_code')).toBe('oauth_signed_in');
  });

  it('exchanges GitHub callback codes with redirect_uri without trusting provider email', async () => {
    setGithubEnv();
    const adminClient = { from: vi.fn() };
    oauthSessionMocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    oauthSessionMocks.createOrLinkOAuthUserAndSession.mockResolvedValue({
      ok: true,
      created: true,
    });
    const state = createOAuthState({
      provider: 'github',
      returnTo: '/settings',
    }, {
      secret: 'test-oauth-state-secret',
    });
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (String(url).includes('/login/oauth/access_token')) {
        expect(String(options.body)).toContain('client_id=github-client-id');
        expect(String(options.body)).toContain('client_secret=github-client-secret');
        expect(String(options.body)).toContain('redirect_uri=https%3A%2F%2Fef-gacha.mogujun.icu%2Fapi%2Fauth%2Foauth%2Fgithub%2Fcallback');
        return new Response(JSON.stringify({ access_token: 'github-access-token', token_type: 'Bearer' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (String(url).endsWith('/user')) {
        expect(options.headers.Authorization).toBe('Bearer github-access-token');
        return new Response(JSON.stringify({
          id: 67890,
          login: 'github-user',
          name: 'GitHub User',
          avatar_url: 'https://avatars.githubusercontent.com/u/67890',
          email: null,
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      expect(String(url)).not.toContain('/user/emails');
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const req = createRequest({
      query: {
        code: 'auth-code',
        state,
      },
    });
    const res = createResponseRecorder();

    await githubOAuthCallbackHandler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(oauthSessionMocks.createOrLinkOAuthUserAndSession).toHaveBeenCalledWith(adminClient, expect.objectContaining({
      profile: expect.objectContaining({
        provider: 'github',
        subject: '67890',
        username: 'github-user',
        email: '',
        emailVerified: false,
      }),
      subjectHash: expect.any(String),
      profileHash: expect.any(String),
      req,
      res,
      secret: 'test-oauth-state-secret',
    }));
    expect(res.statusCode).toBe(302);
    expect(String(res.headers['Set-Cookie'] || '')).not.toContain('ef_oauth_pending=');
    const location = new URL(res.headers.Location);
    expect(location.pathname).toBe('/settings');
    expect(location.searchParams.get('oauth_status')).toBe('signed_in');
    expect(location.searchParams.get('oauth_provider')).toBe('github');
    expect(location.searchParams.get('oauth_code')).toBe('oauth_account_created');
  });

  it('returns an explicit OAuth error when the site session layer is unavailable', async () => {
    setGithubEnv();
    oauthSessionMocks.getSupabaseAdminClient.mockReturnValue(null);
    const state = createOAuthState({
      provider: 'github',
      returnTo: '/settings',
    }, {
      secret: 'test-oauth-state-secret',
    });
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('/login/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'github-access-token', token_type: 'Bearer' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (String(url).endsWith('/user')) {
        return new Response(JSON.stringify({
          id: 67890,
          login: 'github-user',
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }));
    const req = createRequest({
      query: {
        code: 'auth-code',
        state,
      },
    });
    const res = createResponseRecorder();

    await githubOAuthCallbackHandler(req, res);

    const location = new URL(res.headers.Location);
    expect(location.pathname).toBe('/settings');
    expect(location.searchParams.get('oauth_status')).toBe('error');
    expect(location.searchParams.get('oauth_provider')).toBe('github');
    expect(location.searchParams.get('oauth_code')).toBe('oauth_session_unavailable');
    expect(oauthSessionMocks.createOrLinkOAuthUserAndSession).not.toHaveBeenCalled();
  });
});
