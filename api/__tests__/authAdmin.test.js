// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { ensureProfileForAuthUser } from '../_lib/authAdmin.js';

describe('auth admin profile helpers', () => {
  it('preserves an existing profile when profile creation races an existing row', async () => {
    const existingProfile = {
      id: 'user-1',
      username: '站长',
      email: 'owner@example.com',
      role: 'super_admin',
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-02T00:00:00.000Z',
      last_seen_at: '2026-06-03T00:00:00.000Z',
    };

    const insertQuery = {
      insert: vi.fn(() => insertQuery),
      upsert: vi.fn(() => insertQuery),
      select: vi.fn(() => insertQuery),
      single: vi.fn(async () => ({
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint',
        },
      })),
    };
    const loadQuery = {
      select: vi.fn(() => loadQuery),
      eq: vi.fn(() => loadQuery),
      maybeSingle: vi.fn(async () => ({
        data: existingProfile,
        error: null,
      })),
    };
    const queries = [insertQuery, loadQuery];
    const adminClient = {
      from: vi.fn(() => queries.shift()),
    };

    const profile = await ensureProfileForAuthUser(adminClient, {
      id: 'user-1',
      email: 'owner@example.com',
      user_metadata: {
        username: '站长',
      },
    });

    expect(profile).toEqual(existingProfile);
    expect(insertQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'user-1',
      role: 'user',
    }));
    expect(insertQuery.upsert).not.toHaveBeenCalled();
    expect(loadQuery.eq).toHaveBeenCalledWith('id', 'user-1');
  });
});
