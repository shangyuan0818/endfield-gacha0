import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HOME_NEXT_VERSION_TARGET_DATE,
  HOME_NEXT_VERSION_TARGET_CONFIG_KEY,
  HOME_VERSION_TIMELINE_CONFIG_KEY,
  buildHomeRotationVersionSections,
  buildHomeVersionCountdownTitle,
  normalizeHomeVersionTimeline,
  resolveHomeVersionPlan,
} from '../homeVersionTimeline.js';

describe('homeVersionTimeline', () => {
  it('keeps the legacy next-version target as a fallback', () => {
    const plan = resolveHomeVersionPlan({
      legacyTargetAt: '2026-06-10T12:00:00+08:00',
      now: new Date('2026-06-01T00:00:00+08:00'),
    });

    expect(plan.source).toBe(HOME_NEXT_VERSION_TARGET_CONFIG_KEY);
    expect(plan.targetAt).toBe('2026-06-10T12:00:00+08:00');
    expect(plan.countdownVersion.name).toBe('寻遗散记');
  });

  it('normalizes JSON timeline config and sorts by start time', () => {
    const versions = normalizeHomeVersionTimeline(JSON.stringify([
      {
        id: 'second',
        name: '第二版本',
        name_en: 'Second',
        starts_at: '2026-07-01T12:00:00+08:00',
        pool_ids: ['pool_b', 'pool_b', 'pool_c'],
        order: 2,
      },
      {
        id: 'first',
        name: '第一版本',
        name_en: 'First',
        starts_at: '2026-06-01T12:00:00+08:00',
        order: 1,
      },
    ]));

    expect(versions.map(version => version.id)).toEqual(['first', 'second']);
    expect(versions[1].poolIds).toEqual(['pool_b', 'pool_c']);
  });

  it('uses the next future version for countdown after the current version starts', () => {
    const plan = resolveHomeVersionPlan({
      timelineConfig: [
        {
          id: 'current',
          name: '当前版本',
          name_en: 'Current',
          starts_at: '2026-06-01T12:00:00+08:00',
          ends_at: '2026-06-30T12:00:00+08:00',
        },
        {
          id: 'next',
          name: '下个版本',
          name_en: 'Next',
          starts_at: '2026-07-01T12:00:00+08:00',
        },
      ],
      locale: 'en-US',
      now: new Date('2026-06-15T00:00:00+08:00'),
    });

    expect(plan.source).toBe(HOME_VERSION_TIMELINE_CONFIG_KEY);
    expect(plan.currentVersion.id).toBe('current');
    expect(plan.nextVersion.id).toBe('next');
    expect(plan.countdownVersion.id).toBe('next');
    expect(plan.targetAt).toBe('2026-07-01T12:00:00+08:00');
    expect(plan.countdownVersion.displayName).toBe('Next');
    expect(buildHomeVersionCountdownTitle(plan, { baseTitle: 'Countdown' })).toBe('Next · Countdown');
  });

  it('falls back to the default target when given invalid config', () => {
    const plan = resolveHomeVersionPlan({
      timelineConfig: 'not-json',
      legacyTargetAt: 'invalid-date',
      now: new Date('2026-05-01T00:00:00+08:00'),
    });

    expect(plan.targetAt).toBe(DEFAULT_HOME_NEXT_VERSION_TARGET_DATE);
    expect(plan.countdownVersion.name).toBe('寻遗散记');
  });

  it('groups homepage rotation pools by version and folds expired extra pools into later pools', () => {
    const versionPlan = resolveHomeVersionPlan({
      timelineConfig: [
        {
          id: 'lost-heirlooms',
          name: '寻遗散记',
          starts_at: '2026-06-05T12:00:00+08:00',
          ends_at: '2026-06-26T12:00:00+08:00',
          pool_ids: ['extra_festival', 'limited_zhuang'],
        },
        {
          id: 'next',
          name: '逐罪者',
          starts_at: '2026-06-26T12:00:00+08:00',
          pool_ids: ['limited_camille'],
        },
      ],
      now: new Date('2026-06-20T12:00:00+08:00'),
    });
    const sections = buildHomeRotationVersionSections({
      versionPlan,
      now: new Date('2026-06-20T12:00:00+08:00'),
      poolSchedule: [
        {
          id: 'extra_festival',
          name: '辉光庆典',
          poolType: 'extra',
          startDate: '2026-06-05T12:00:00+08:00',
          endDate: '2026-06-12T12:00:00+08:00',
        },
        {
          id: 'limited_zhuang',
          name: '庄方宜',
          poolType: 'limited',
          startDate: '2026-06-13T12:00:00+08:00',
          endDate: '2026-06-26T12:00:00+08:00',
        },
        {
          id: 'limited_camille',
          name: '卡缪',
          poolType: 'limited',
          startDate: '2026-06-26T12:00:00+08:00',
          endDate: '2026-07-17T12:00:00+08:00',
        },
      ],
    });

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({
      id: 'lost-heirlooms',
      name: '寻遗散记',
      hiddenExtraCount: 1,
    });
    expect(sections[0].pools.map((pool) => pool.id)).toEqual(['limited_zhuang']);
    expect(sections[0].pools[0].foldedExtraPools.map((pool) => pool.id)).toEqual(['extra_festival']);
    expect(sections[1].pools.map((pool) => pool.id)).toEqual(['limited_camille']);
  });

  it('folds an expired extra pool into the overlapping limited pool of the same version', () => {
    const versionPlan = resolveHomeVersionPlan({
      timelineConfig: [
        {
          id: 'spring-dawn',
          name: '春晓时',
          starts_at: '2026-04-17T12:00:00+08:00',
          ends_at: '2026-06-05T12:00:00+08:00',
          pool_ids: ['limited_zhuang', 'extra_festival'],
        },
        {
          id: 'lost-heirlooms',
          name: '寻遗散记',
          starts_at: '2026-06-05T12:00:00+08:00',
          pool_ids: ['limited_mifu'],
        },
      ],
      now: new Date('2026-06-10T12:00:00+08:00'),
    });
    const sections = buildHomeRotationVersionSections({
      versionPlan,
      now: new Date('2026-06-10T12:00:00+08:00'),
      poolSchedule: [
        {
          id: 'limited_zhuang',
          name: '庄方宜',
          poolType: 'limited',
          startDate: '2026-04-17T12:00:00+08:00',
          endDate: '2026-05-22T12:00:00+08:00',
        },
        {
          id: 'extra_festival',
          name: '辉光庆典',
          poolType: 'extra',
          startDate: '2026-05-14T12:00:00+08:00',
          endDate: '2026-06-05T12:00:00+08:00',
        },
        {
          id: 'limited_mifu',
          name: '弭弗',
          poolType: 'limited',
          startDate: '2026-06-05T12:00:00+08:00',
          endDate: '2026-06-26T12:00:00+08:00',
        },
      ],
    });

    const springSection = sections.find((section) => section.id === 'spring-dawn');
    expect(springSection.pools.map((pool) => pool.id)).toEqual(['limited_zhuang']);
    expect(springSection.pools[0].foldedExtraPools.map((pool) => pool.id)).toEqual(['extra_festival']);
    expect(springSection.hiddenExtraCount).toBe(1);
    const heirloomsSection = sections.find((section) => section.id === 'lost-heirlooms');
    expect(heirloomsSection.pools.map((pool) => pool.id)).toEqual(['limited_mifu']);
  });
});
