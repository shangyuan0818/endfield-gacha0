// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSyntheticOAuthEmail,
  createSiteSession,
  createSupabaseCompatAccessToken,
  linkOAuthIdentityToSiteSession,
  loadSiteAuthIdentities,
  loadSiteSession,
  parseCookieHeader,
  serializeCookie,
  unlinkSiteAuthIdentity,
} from '../_lib/siteSession.js';

function createResponseRecorder() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    getHeader(name) {
      return this.headers[name];
    },
  };
}

function createRequest() {
  return {
    headers: {
      host: 'ef-gacha.mogujun.icu',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': '203.0.113.24',
      'user-agent': 'Vitest',
    },
    socket: {
      remoteAddress: '127.0.0.1',
    },
  };
}

function createInsertOnlyAdminClient(calls) {
  return {
    from(table) {
      return {
        insert(payload) {
          calls.push({ table, operation: 'insert', payload });
          return {
            select() {
              return {
                single: async () => ({
                  data: {
                    id: 'session-id',
                    ...payload,
                  },
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
  };
}

function createIdentityAdminClient(rows) {
  return {
    from(table) {
      return {
        select(fields) {
          return {
            eq(column, value) {
              const state = { table, fields, eq: [column, value], includeDisabled: true };
              const query = {
                order(orderColumn, options) {
                  state.order = [orderColumn, options];
                  return Promise.resolve({ data: rows, error: null });
                },
                is(isColumn, isValue) {
                  state.is = [isColumn, isValue];
                  return {
                    order(orderColumn, options) {
                      state.order = [orderColumn, options];
                      return Promise.resolve({
                        data: rows.filter((row) => row.disabled_at === null),
                        error: null,
                      });
                    },
                  };
                },
              };
              return query;
            },
          };
        },
      };
    },
  };
}

function createRefreshableSessionAdminClient({ sessionRow = null, refreshRow = null, profileRow = null, identityRows = [] } = {}) {
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({
      is: vi.fn(async () => ({ error: null })),
    })),
  }));
  return {
    __mocks: {
      update,
    },
    from(table) {
      if (table === 'app_sessions') {
        const buildRowResult = (row) => ({
          is() {
            return {
              gt() {
                return {
                  gt() {
                    return {
                      maybeSingle: async () => ({ data: row, error: null }),
                    };
                  },
                  maybeSingle: async () => ({ data: row, error: null }),
                };
              },
            };
          },
        });
        return {
          select() {
            return {
              eq(column, _value) {
                if (column === 'session_token_hash') {
                  return buildRowResult(sessionRow);
                }

                if (column === 'refresh_token_hash') {
                  return buildRowResult(refreshRow);
                }

                return {
                  maybeSingle: async () => ({ data: null, error: null }),
                };
              },
            };
          },
          update,
        };
      }

      if (table === 'profiles') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: profileRow, error: null }),
                };
              },
            };
          },
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        };
      }

      if (table === 'app_auth_identities') {
        return {
          select() {
            return {
              eq() {
                return {
                  is() {
                    return {
                      order: async () => ({ data: identityRows, error: null }),
                    };
                  },
                  order: async () => ({ data: identityRows, error: null }),
                };
              },
            };
          },
        };
      }

      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: null, error: null }),
              };
            },
          };
        },
      };
    },
  };
}

function createSiteIdentityMutationAdminClient({
  sessionRow,
  profileRow,
  identityRows = [],
} = {}) {
  const identities = [...identityRows];
  const updates = [];
  const upserts = [];
  const auditEvents = [];
  const nowIso = new Date(Date.now() + 3600000).toISOString();

  function activeIdentitiesForUser(userId) {
    return identities.filter((row) => row.user_id === userId && row.disabled_at === null);
  }

  return {
    __mocks: {
      identities,
      updates,
      upserts,
      auditEvents,
    },
    from(table) {
      if (table === 'app_sessions') {
        return {
          select() {
            return {
              eq(column) {
                if (column === 'session_token_hash') {
                  return {
                    is() {
                      return {
                        gt() {
                          return {
                            gt() {
                              return {
                                maybeSingle: async () => ({ data: sessionRow, error: null }),
                              };
                            },
                          };
                        },
                      };
                    },
                  };
                }
                return {
                  maybeSingle: async () => ({ data: null, error: null }),
                };
              },
            };
          },
          update(payload) {
            updates.push({ table, payload });
            return {
              eq: vi.fn(async () => ({ error: null })),
            };
          },
        };
      }

      if (table === 'profiles') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: profileRow, error: null }),
                };
              },
            };
          },
          update(payload) {
            updates.push({ table, payload });
            return {
              eq: vi.fn(async () => ({ error: null })),
            };
          },
        };
      }

      if (table === 'app_auth_audit_events') {
        return {
          insert(payload) {
            auditEvents.push(payload);
            return Promise.resolve({ data: payload, error: null });
          },
        };
      }

      if (table === 'app_auth_identities') {
        return {
          select() {
            return {
              eq(column, value) {
                if (column === 'provider') {
                  const provider = value;
                  return {
                    eq(subjectColumn, subjectValue) {
                      const row = identities.find((identity) => (
                        identity.provider === provider
                        && identity.provider_subject_hash === subjectValue
                      )) || null;
                      return {
                        maybeSingle: async () => ({ data: row, error: null }),
                      };
                    },
                  };
                }
                if (column === 'id') {
                  const row = identities.find((identity) => identity.id === value) || null;
                  return {
                    maybeSingle: async () => ({ data: row, error: null }),
                  };
                }
                if (column === 'user_id') {
                  return {
                    is() {
                      return {
                        order: async () => ({ data: activeIdentitiesForUser(value), error: null }),
                      };
                    },
                    order: async () => ({ data: activeIdentitiesForUser(value), error: null }),
                  };
                }
                return {
                  maybeSingle: async () => ({ data: null, error: null }),
                };
              },
            };
          },
          upsert(payload) {
            upserts.push(payload);
            const existingIndex = identities.findIndex((identity) => (
              identity.provider === payload.provider
              && identity.provider_subject_hash === payload.provider_subject_hash
            ));
            const row = {
              id: existingIndex >= 0 ? identities[existingIndex].id : `identity-${identities.length + 1}`,
              linked_at: nowIso,
              ...identities[existingIndex],
              ...payload,
            };
            if (existingIndex >= 0) {
              identities[existingIndex] = row;
            } else {
              identities.push(row);
            }
            return {
              select() {
                return {
                  single: async () => ({ data: row, error: null }),
                };
              },
            };
          },
          update(payload) {
            return {
              eq(column, value) {
                const state = { [column]: value };
                return {
                  eq(nextColumn, nextValue) {
                    state[nextColumn] = nextValue;
                    return {
                      is(isColumn, isValue) {
                        state[isColumn] = isValue;
                        const index = identities.findIndex((identity) => (
                          identity.id === state.id
                          && identity.user_id === state.user_id
                          && identity.disabled_at === null
                        ));
                        if (index >= 0) {
                          identities[index] = { ...identities[index], ...payload };
                        }
                        updates.push({ table, payload, state });
                        return {
                          select() {
                            return {
                              single: async () => ({ data: index >= 0 ? identities[index] : null, error: index >= 0 ? null : { code: 'not_found', message: 'not found' } }),
                            };
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: null, error: null }),
              };
            },
          };
        },
      };
    },
  };
}

function decodeJwtPayload(token) {
  const [, payload] = String(token || '').split('.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

beforeEach(() => {
  delete process.env.APP_SESSION_SECRET;
  delete process.env.APP_SESSION_COMPAT_JWT_ENABLED;
  delete process.env.SUPABASE_JWT_SECRET;
  delete process.env.SUPABASE_URL;
});

describe('siteSession utilities', () => {
  it('serializes and parses HttpOnly cookies', () => {
    const cookie = serializeCookie('__Host-eg_session', 'token value', {
      maxAgeSeconds: 60,
      secure: true,
    });

    expect(cookie).toContain('__Host-eg_session=token%20value');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(parseCookieHeader(cookie)['__Host-eg_session']).toBe('token value');
  });

  it('builds deterministic synthetic OAuth emails under the internal invalid domain', () => {
    expect(buildSyntheticOAuthEmail('Linux.do', 'abcdef1234567890abcdef1234567890')).toBe(
      'linuxdo.abcdef1234567890abcdef1234567890@oauth.local.invalid'
    );
  });

  it('creates a site session and stores only token hashes in the database payload', async () => {
    process.env.APP_SESSION_SECRET = 'site-session-test-secret';
    const calls = [];
    const res = createResponseRecorder();

    const result = await createSiteSession(createInsertOnlyAdminClient(calls), {
      userId: '00000000-0000-4000-8000-000000000001',
      req: createRequest(),
      res,
      provider: 'linuxdo',
    });

    expect(result.ok).toBe(true);
    expect(calls[0].table).toBe('app_sessions');
    expect(calls[0].payload.session_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(calls[0].payload.refresh_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(String(calls[0].payload.session_token_hash)).not.toContain('eg_session');
    expect(res.headers['Set-Cookie']).toHaveLength(2);
    expect(res.headers['Set-Cookie'][0]).toContain('__Host-eg_session=');
    expect(res.headers['Set-Cookie'][1]).toContain('__Host-eg_refresh=');
  });

  it('creates a Supabase-compatible access token when the JWT secret is available', () => {
    process.env.SUPABASE_JWT_SECRET = 'supabase-jwt-secret';
    process.env.SUPABASE_URL = 'https://db.example.test';

    const token = createSupabaseCompatAccessToken({
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: null,
      },
      profile: {
        username: 'linuxdo_user',
      },
      sessionId: 'session-id',
      ttlSeconds: 300,
    });

    expect(token.accessToken.split('.')).toHaveLength(3);
    expect(token.expiresIn).toBe(300);
    const payload = decodeJwtPayload(token.accessToken);
    expect(payload.sub).toBe('00000000-0000-4000-8000-000000000001');
    expect(payload.role).toBe('authenticated');
    expect(payload.user_metadata.username).toBe('linuxdo_user');
    expect(payload.session_id).toBe('session-id');
  });

  it('loads redacted site-managed OAuth identities for the settings page', async () => {
    const identities = await loadSiteAuthIdentities(createIdentityAdminClient([
      {
        id: 'identity-1',
        provider: 'github',
        display_name: 'Octo User',
        avatar_url: 'https://avatars.example.test/u/1',
        email_verified: true,
        linked_at: '2026-05-30T00:00:00.000Z',
        last_used_at: '2026-05-30T01:00:00.000Z',
        disabled_at: null,
      },
    ]), {
      userId: '00000000-0000-4000-8000-000000000001',
    });

    expect(identities).toEqual([
      expect.objectContaining({
        id: 'identity-1',
        provider: 'github',
        source: 'site_session',
        created_at: '2026-05-30T00:00:00.000Z',
        identity_data: expect.objectContaining({
          username: 'Octo User',
          email_verified: true,
          site_session: true,
        }),
      }),
    ]);
    expect(JSON.stringify(identities)).not.toContain('provider_subject');
    expect(JSON.stringify(identities)).not.toContain('access_token');
  });

  it('allows the Supabase-compatible token bridge to be disabled', () => {
    process.env.SUPABASE_JWT_SECRET = 'supabase-jwt-secret';
    process.env.APP_SESSION_COMPAT_JWT_ENABLED = 'false';

    expect(createSupabaseCompatAccessToken({
      user: {
        id: '00000000-0000-4000-8000-000000000001',
      },
    })).toBeNull();
  });

  it('restores a site session from the refresh cookie when the session cookie is stale', async () => {
    process.env.APP_SESSION_SECRET = 'site-session-test-secret';
    process.env.SUPABASE_JWT_SECRET = 'supabase-jwt-secret';
    process.env.SUPABASE_URL = 'https://db.example.test';

    const adminClient = createRefreshableSessionAdminClient({
      sessionRow: null,
      refreshRow: {
        id: 'session-id',
        user_id: '00000000-0000-4000-8000-000000000001',
        session_token_hash: 'old-session-hash',
        refresh_token_hash: 'old-refresh-hash',
        absolute_expires_at: new Date(Date.now() + 3600000).toISOString(),
        expires_at: new Date(Date.now() - 1000).toISOString(),
        last_seen_at: new Date(Date.now() - 1000).toISOString(),
      },
      profileRow: {
        id: '00000000-0000-4000-8000-000000000001',
        username: 'site_user',
        email: 'user@example.com',
        role: 'user',
        created_at: '2026-05-30T00:00:00.000Z',
        updated_at: '2026-05-30T01:00:00.000Z',
        last_seen_at: '2026-05-30T01:00:00.000Z',
      },
      identityRows: [
        {
          id: 'identity-1',
          provider: 'github',
          display_name: 'site_user',
          avatar_url: null,
          email_verified: true,
          linked_at: '2026-05-30T00:00:00.000Z',
          last_used_at: '2026-05-30T01:00:00.000Z',
          disabled_at: null,
        },
      ],
    });
    const req = {
      headers: {
        cookie: '__Host-eg_session=stale-session-token; __Host-eg_refresh=refresh-token-value',
        host: 'ef-gacha.mogujun.icu',
        'x-forwarded-proto': 'https',
        'user-agent': 'Vitest',
      },
      socket: {
        remoteAddress: '127.0.0.1',
      },
    };
    const res = createResponseRecorder();

    const result = await loadSiteSession(adminClient, {
      req,
      res,
    });

    expect(result.ok).toBe(true);
    expect(result.authenticated).toBe(true);
    expect(result.session.id).toBe('session-id');
    expect(result.user.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(result.identities).toHaveLength(1);
    expect(adminClient.__mocks.update).toHaveBeenCalled();
    expect(res.headers['Set-Cookie']).toHaveLength(2);
  });

  it('links an OAuth identity to the current site session user', async () => {
    process.env.APP_SESSION_SECRET = 'site-session-test-secret';
    const sessionRow = {
      id: 'session-id',
      user_id: '00000000-0000-4000-8000-000000000001',
      absolute_expires_at: new Date(Date.now() + 3600000).toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      last_seen_at: new Date().toISOString(),
    };
    const profileRow = {
      id: sessionRow.user_id,
      username: 'site_user',
      email: 'user@example.com',
      role: 'user',
      created_at: '2026-05-30T00:00:00.000Z',
      updated_at: '2026-05-30T01:00:00.000Z',
      last_seen_at: '2026-05-30T01:00:00.000Z',
    };
    const adminClient = createSiteIdentityMutationAdminClient({
      sessionRow,
      profileRow,
      identityRows: [],
    });

    const result = await linkOAuthIdentityToSiteSession(adminClient, {
      profile: {
        provider: 'github',
        subject: '123',
        username: 'octo-user',
        displayName: 'Octo User',
        emailVerified: false,
      },
      subjectHash: 'subject-hash',
      profileHash: 'profile-hash',
      req: {
        ...createRequest(),
        headers: {
          ...createRequest().headers,
          cookie: '__Host-eg_session=session-token',
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.identity).toMatchObject({
      provider: 'github',
      source: 'site_session',
    });
    expect(adminClient.__mocks.upserts[0]).toMatchObject({
      user_id: sessionRow.user_id,
      provider: 'github',
      provider_subject_hash: 'subject-hash',
      disabled_at: null,
    });
  });

  it('rejects linking an OAuth identity that belongs to another user', async () => {
    process.env.APP_SESSION_SECRET = 'site-session-test-secret';
    const adminClient = createSiteIdentityMutationAdminClient({
      sessionRow: {
        id: 'session-id',
        user_id: '00000000-0000-4000-8000-000000000001',
        absolute_expires_at: new Date(Date.now() + 3600000).toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
      profileRow: {
        id: '00000000-0000-4000-8000-000000000001',
        username: 'site_user',
        email: 'user@example.com',
      },
      identityRows: [
        {
          id: 'identity-other',
          user_id: '00000000-0000-4000-8000-000000000002',
          provider: 'github',
          provider_subject_hash: 'subject-hash',
          display_name: 'Other',
          disabled_at: null,
        },
      ],
    });

    const result = await linkOAuthIdentityToSiteSession(adminClient, {
      profile: {
        provider: 'github',
        subject: '123',
        username: 'octo-user',
      },
      subjectHash: 'subject-hash',
      profileHash: 'profile-hash',
      req: {
        ...createRequest(),
        headers: {
          ...createRequest().headers,
          cookie: '__Host-eg_session=session-token',
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('oauth_identity_already_linked');
    expect(adminClient.__mocks.upserts).toHaveLength(0);
  });

  it('prevents unlinking the final usable sign-in method', async () => {
    process.env.APP_SESSION_SECRET = 'site-session-test-secret';
    const userId = '00000000-0000-4000-8000-000000000001';
    const adminClient = createSiteIdentityMutationAdminClient({
      sessionRow: {
        id: 'session-id',
        user_id: userId,
        absolute_expires_at: new Date(Date.now() + 3600000).toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
      profileRow: {
        id: userId,
        username: 'site_user',
        email: null,
      },
      identityRows: [
        {
          id: 'identity-1',
          user_id: userId,
          provider: 'github',
          provider_subject_hash: 'subject-hash',
          display_name: 'Octo User',
          disabled_at: null,
        },
      ],
    });

    const result = await unlinkSiteAuthIdentity(adminClient, {
      identityId: 'identity-1',
      req: {
        ...createRequest(),
        headers: {
          ...createRequest().headers,
          cookie: '__Host-eg_session=session-token',
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('oauth_last_login_method');
    expect(adminClient.__mocks.identities[0].disabled_at).toBeNull();
  });

  it('unlinks a site OAuth identity when a usable email remains', async () => {
    process.env.APP_SESSION_SECRET = 'site-session-test-secret';
    const userId = '00000000-0000-4000-8000-000000000001';
    const adminClient = createSiteIdentityMutationAdminClient({
      sessionRow: {
        id: 'session-id',
        user_id: userId,
        absolute_expires_at: new Date(Date.now() + 3600000).toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
      profileRow: {
        id: userId,
        username: 'site_user',
        email: 'user@example.com',
      },
      identityRows: [
        {
          id: 'identity-1',
          user_id: userId,
          provider: 'github',
          provider_subject_hash: 'subject-hash',
          display_name: 'Octo User',
          disabled_at: null,
        },
      ],
    });

    const result = await unlinkSiteAuthIdentity(adminClient, {
      identityId: 'identity-1',
      req: {
        ...createRequest(),
        headers: {
          ...createRequest().headers,
          cookie: '__Host-eg_session=session-token',
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.identity.disabled_at).toBeTruthy();
    expect(adminClient.__mocks.identities[0].disabled_at).toBeTruthy();
  });
});
