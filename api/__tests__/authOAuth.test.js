// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
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
  'AUTH_OAUTH_QQ_ENABLED',
  'AUTH_OAUTH_QQ_CLIENT_ID',
  'AUTH_OAUTH_QQ_CLIENT_SECRET',
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

beforeEach(() => {
  ENV_KEYS.forEach((key) => {
    delete process.env[key];
  });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
    expect(location.searchParams.get('redirect_uri')).toBe('https://ef-gacha.mogujun.icu/api/auth/oauth/linuxdo/callback');
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

  it('exchanges Linux.do callback code and stores a short-lived pending cookie', async () => {
    setLinuxDoEnv();
    const state = createOAuthState({
      provider: 'linuxdo',
      returnTo: '/settings',
    }, {
      secret: 'test-oauth-state-secret',
    });
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (String(url).includes('/oauth2/token')) {
        expect(options.headers.Authorization).toBe(`Basic ${Buffer.from('linuxdo-client-id:linuxdo-client-secret').toString('base64')}`);
        expect(String(options.body)).not.toContain('client_secret=linuxdo-client-secret');
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
    expect(res.statusCode).toBe(302);
    expect(String(res.headers['Set-Cookie'] || '')).toContain('ef_oauth_pending=');
    expect(String(res.headers['Set-Cookie'] || '')).toContain('HttpOnly');
    const location = new URL(res.headers.Location);
    expect(location.pathname).toBe('/settings');
    expect(location.searchParams.get('oauth_status')).toBe('verified');
    expect(location.searchParams.get('oauth_provider')).toBe('linuxdo');
  });
});
