// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const linkOAuthIdentityToSiteSession = vi.fn();

vi.mock('../_lib/authAdmin.js', () => ({
  getSupabaseAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock('../_lib/siteSession.js', async () => {
  const actual = await vi.importActual('../_lib/siteSession.js');
  return {
    ...actual,
    createOrLinkOAuthUserAndSession: vi.fn(),
    linkOAuthIdentityToSiteSession,
  };
});

const {
  linuxdoOAuthCallbackHandler,
} = await import('../_routes/root/auth-oauth.js');
const {
  createOAuthState,
} = await import('../_lib/oauthState.js');

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
  query = {},
  headers = {},
} = {}) {
  return {
    method: 'GET',
    query,
    headers: {
      host: 'ef-gacha.mogujun.icu',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': '203.0.113.20',
      'user-agent': 'Vitest',
      cookie: '__Host-eg_session=session-token',
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
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  [
    'APP_URL',
    'OAUTH_STATE_SECRET',
    'AUTH_OAUTH_LINUXDO_ENABLED',
    'AUTH_OAUTH_LINUXDO_CLIENT_ID',
    'AUTH_OAUTH_LINUXDO_CLIENT_SECRET',
    'AUTH_OAUTH_LINUXDO_REDIRECT_URI',
  ].forEach((key) => {
    delete process.env[key];
  });
});

describe('auth OAuth bridge link intent', () => {
  it('links the provider identity to the current site session instead of signing in', async () => {
    setLinuxDoEnv();
    linkOAuthIdentityToSiteSession.mockResolvedValue({
      ok: true,
      identity: {
        id: 'identity-1',
        provider: 'linuxdo',
        source: 'site_session',
      },
    });

    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (String(url).includes('/oauth2/token')) {
        expect(options.headers.Authorization).toBe(`Basic ${Buffer.from('linuxdo-client-id:linuxdo-client-secret').toString('base64')}`);
        return new Response(JSON.stringify({ access_token: 'provider-access-token', token_type: 'Bearer' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (String(url).includes('/api/user')) {
        return new Response(JSON.stringify({
          id: 12345,
          username: 'linuxdo-user',
          active: true,
          trust_level: 2,
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }));

    const state = createOAuthState({
      provider: 'linuxdo',
      returnTo: '/settings',
      intent: 'link',
    }, {
      secret: 'test-oauth-state-secret',
    });
    const req = createRequest({
      query: {
        code: 'auth-code',
        state,
      },
    });
    const res = createResponseRecorder();

    await linuxdoOAuthCallbackHandler(req, res);

    expect(linkOAuthIdentityToSiteSession).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      profile: expect.objectContaining({
        provider: 'linuxdo',
        username: 'linuxdo-user',
      }),
      subjectHash: expect.any(String),
      profileHash: expect.any(String),
      req,
      secret: 'test-oauth-state-secret',
    }));
    expect(res.statusCode).toBe(302);
    const location = new URL(res.headers.Location);
    expect(location.pathname).toBe('/settings');
    expect(location.searchParams.get('oauth_status')).toBe('linked');
    expect(location.searchParams.get('oauth_code')).toBe('oauth_identity_linked');
    expect(String(res.headers['Set-Cookie'] || '')).not.toContain('ef_oauth_pending=');
  });
});
