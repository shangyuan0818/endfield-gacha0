// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
  buildPoolsCatalog,
  fetchAnnouncements,
} from '../_lib/publicCatalog.js';

function makePoolRows(count) {
  return Array.from({ length: count }, (_, index) => {
    const createdAt = new Date(Date.UTC(2026, 0, index + 1)).toISOString();
    const startAt = new Date(Date.UTC(2026, 2, index + 1, 4)).toISOString();
    const endAt = new Date(Date.UTC(2026, 3, index + 1, 4)).toISOString();

    return {
      pool_id: `pool_${String(index).padStart(3, '0')}`,
      name: `公开卡池 ${index}`,
      name_en: `Public Pool ${index}`,
      type: index % 2 === 0 ? 'limited_character' : 'weapon',
      locked: false,
      is_limited_weapon: true,
      created_at: createdAt,
      updated_at: null,
      user_id: `private-user-${index}`,
      creator_username: `private-creator-${index}`,
      up_character: `公开角色 ${index}`,
      description: null,
      banner_url: null,
      start_time: startAt,
      end_time: endAt,
      featured_characters: [{ name: `公开角色 ${index}`, rarity: 6, type: 'character' }],
    };
  });
}

function makeAnnouncementRows(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `ann_${String(index).padStart(3, '0')}`,
    title: `公告 ${index}`,
    title_en: `Announcement ${index}`,
    content: `内容 ${index}`,
    content_en: `Content ${index}`,
    version: '1.0',
    announcement_type: 'update',
    severity: 'info',
    is_active: true,
    source_url: `https://example.com/ann/${index}`,
    published_at: `2026-04-${String((index % 20) + 1).padStart(2, '0')}T00:00:00.000Z`,
    summary: `摘要 ${index}`,
    created_at: `2026-04-${String((index % 20) + 1).padStart(2, '0')}T00:00:00.000Z`,
    updated_at: null,
  }));
}

function createPublicCatalogClient({
  pools = [],
  announcements = [],
  announcementRanges = [],
} = {}) {
  return {
    rpc: vi.fn(async (name) => {
      if (name !== 'get_app_visible_pools') {
        throw new Error(`Unexpected rpc: ${name}`);
      }

      return { data: pools, error: null };
    }),
    from: vi.fn((table) => {
      if (table !== 'announcements') {
        throw new Error(`Unexpected table: ${table}`);
      }

      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        order: vi.fn(() => chain),
        range: vi.fn(async (from, to) => {
          announcementRanges.push([from, to]);
          return {
            data: announcements.slice(from, to + 1),
            count: announcements.length,
            error: null,
          };
        }),
      };

      return chain;
    }),
  };
}

describe('public API pagination boundaries', () => {
  it('clamps public pool catalog limits and resumes from opaque cursors', async () => {
    const client = createPublicCatalogClient({ pools: makePoolRows(105) });

    const firstPage = await buildPoolsCatalog(client, { limit: '500' });

    expect(firstPage.pools).toHaveLength(100);
    expect(firstPage.page).toMatchObject({
      limit: 100,
      hasMore: true,
      total: 105,
    });
    expect(firstPage.page.nextCursor).toEqual(expect.any(String));
    expect(JSON.stringify(firstPage)).not.toContain('private-user');
    expect(JSON.stringify(firstPage)).not.toContain('private-creator');

    const secondPage = await buildPoolsCatalog(client, {
      limit: '2',
      cursor: firstPage.page.nextCursor,
    });

    expect(secondPage.pools.map((pool) => pool.id)).toEqual(['pool_004', 'pool_003']);
    expect(secondPage.page).toMatchObject({
      limit: 2,
      hasMore: true,
      total: 105,
    });

    const fallbackPage = await buildPoolsCatalog(client, {
      limit: '-1',
      cursor: 'not-a-valid-cursor',
    });

    expect(fallbackPage.pools).toHaveLength(50);
    expect(fallbackPage.page).toMatchObject({
      limit: 50,
      hasMore: true,
      total: 105,
    });
    expect(fallbackPage.pools[0].id).toBe('pool_104');
  });

  it('clamps announcement list ranges and keeps cursor metadata consistent', async () => {
    const announcementRanges = [];
    const client = createPublicCatalogClient({
      announcements: makeAnnouncementRows(103),
      announcementRanges,
    });

    const firstPage = await fetchAnnouncements(client, { limit: '500', locale: 'en-US' });

    expect(announcementRanges[0]).toEqual([0, 99]);
    expect(firstPage.announcements).toHaveLength(100);
    expect(firstPage.announcements[0]).toMatchObject({
      id: 'ann_000',
      title: 'Announcement 0',
    });
    expect(firstPage.page).toMatchObject({
      limit: 100,
      hasMore: true,
      total: 103,
    });
    expect(firstPage.page.nextCursor).toEqual(expect.any(String));

    const secondPage = await fetchAnnouncements(client, {
      limit: '3',
      cursor: firstPage.page.nextCursor,
    });

    expect(announcementRanges[1]).toEqual([100, 102]);
    expect(secondPage.announcements).toHaveLength(3);
    expect(secondPage.page).toMatchObject({
      limit: 3,
      nextCursor: null,
      hasMore: false,
      total: 103,
    });
  });
});
