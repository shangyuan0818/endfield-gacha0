import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HOME_ROADMAP_ITEMS,
  DEFAULT_HOME_ROADMAP_SUMMARY,
  normalizeHomeRoadmapItems,
} from '../homeRoadmap.js';

describe('homeRoadmap', () => {
  it('replaces the old default roadmap when virtual scroll is present', () => {
    const legacyItems = [
      { id: 'sim-inherit', status: 'completed' },
      { id: 'virtual-scroll', status: 'planned' },
    ];

    const result = normalizeHomeRoadmapItems(legacyItems, DEFAULT_HOME_ROADMAP_SUMMARY);

    expect(result).toEqual(DEFAULT_HOME_ROADMAP_SUMMARY);
    expect(result.some((item) => item.id === 'virtual-scroll')).toBe(false);
    expect(result.some((item) => item.id === 'heirlooms-preview')).toBe(true);
  });

  it('keeps custom roadmap items that are not the legacy default set', () => {
    const customItems = [
      {
        id: 'custom-admin-review',
        icon: 'Shield',
        title: 'Custom admin review',
        status: 'planned',
      },
    ];

    expect(normalizeHomeRoadmapItems(customItems)).toBe(customItems);
  });

  it('falls back to the current full roadmap for invalid input', () => {
    expect(normalizeHomeRoadmapItems(null)).toBe(DEFAULT_HOME_ROADMAP_ITEMS);
    expect(normalizeHomeRoadmapItems([])).toBe(DEFAULT_HOME_ROADMAP_ITEMS);
  });
});
