import { describe, expect, it } from 'vitest';

import {
  applyHomeVersionDurationToEndAt,
  buildHomeVersionTimelinePoolPreview,
  buildHomeVersionTimelineEditorPreview,
  createHomeVersionTimelineRows,
  inferHomeVersionTimeRangeFromPools,
  parseHomeVersionPoolIdsText,
  serializeHomeVersionTimelineRows,
  validateHomeVersionTimelineRows,
} from '../homeVersionTimelineEditor.js';

describe('homeVersionTimelineEditor', () => {
  it('loads object-wrapped timeline config into editable rows', () => {
    const { parseError, rows } = createHomeVersionTimelineRows(JSON.stringify({
      versions: [
        {
          id: 'lost-heirlooms',
          name: '寻遗散记',
          name_en: 'Lost Heirlooms',
          starts_at: '2026-06-05T12:00:00+08:00',
          ends_at: '2026-06-26T03:59:59+08:00',
          enabled: true,
          order: 10,
          pool_ids: ['special_001', 'special_001', 'weaponbox_001'],
        },
      ],
    }));

    expect(parseError).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'lost-heirlooms',
      name: '寻遗散记',
      nameEn: 'Lost Heirlooms',
      startsAt: '2026-06-05T12:00:00+08:00',
      endsAt: '2026-06-26T03:59:59+08:00',
      durationDays: '20.67',
      enabled: true,
      order: '10',
      poolIdsText: 'special_001\nweaponbox_001',
    });
  });

  it('deduplicates pool ids from comma, whitespace, and newline separated text', () => {
    expect(parseHomeVersionPoolIdsText('special_001, special_001\nweaponbox_001；extra_001')).toEqual([
      'special_001',
      'weaponbox_001',
      'extra_001',
    ]);
  });

  it('infers a version time range from selected pool ids', () => {
    const result = inferHomeVersionTimeRangeFromPools(
      {
        startsAt: '2026-06-01T12:00:00+08:00',
        endsAt: '',
        poolIdsText: 'pool_late\npool_early\nmissing_pool',
      },
      [
        {
          pool_id: 'pool_late',
          start_time: '2026-06-20T12:00:00+08:00',
          end_time: '2026-07-01T03:59:59+08:00',
        },
        {
          pool_id: 'pool_early',
          start_time: '2026-06-05T12:00:00+08:00',
          end_time: '2026-06-26T03:59:59+08:00',
        },
      ]
    );

    expect(result).toEqual({
      startsAt: '2026-06-05T12:00:00+08:00',
      endsAt: '2026-07-01T03:59:59+08:00',
      durationDays: '25.67',
      matchedCount: 2,
    });
  });

  it('fills end time from start time and duration days', () => {
    expect(applyHomeVersionDurationToEndAt({
      startsAt: '2026-06-05T12:00:00+08:00',
      durationDays: '21',
      endsAt: '',
    })).toBe('2026-06-26T12:00:00+08:00');

    expect(applyHomeVersionDurationToEndAt({
      startsAt: 'invalid',
      durationDays: '21',
      endsAt: '2026-06-30T12:00:00+08:00',
    })).toBe('2026-06-30T12:00:00+08:00');
  });

  it('returns null when selected pools have no usable time range', () => {
    expect(inferHomeVersionTimeRangeFromPools(
      { startsAt: '', endsAt: '', poolIdsText: 'pool_1' },
      [{ pool_id: 'pool_1', start_time: 'invalid', end_time: '' }]
    )).toBeNull();
  });

  it('validates required fields, duplicate ids, date order, and numeric order', () => {
    const rows = [
      {
        id: 'dup',
        name: '',
        nameEn: '',
        startsAt: 'invalid',
        endsAt: '',
        enabled: true,
        order: 'first',
        durationDays: 'zero',
        poolIdsText: '',
      },
      {
        id: 'dup',
        name: '第二版本',
        nameEn: '',
        startsAt: '2026-07-01T12:00:00+08:00',
        endsAt: '2026-06-01T12:00:00+08:00',
        enabled: true,
        order: '20',
        poolIdsText: '',
      },
    ];

    const result = validateHomeVersionTimelineRows(rows);

    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('版本 ID 重复');
    expect(result.errors.join('\n')).toContain('中文版本名不能为空');
    expect(result.errors.join('\n')).toContain('开始时间必须是有效时间');
    expect(result.errors.join('\n')).toContain('排序必须是数字');
    expect(result.errors.join('\n')).toContain('持续天数必须是大于 0 的数字');
    expect(result.errors.join('\n')).toContain('结束时间必须晚于开始时间');
  });

  it('serializes edited rows into the homepage timeline config shape', () => {
    const serialized = serializeHomeVersionTimelineRows([
      {
        id: 'lost-heirlooms',
        name: '寻遗散记',
        nameEn: 'Lost Heirlooms',
        startsAt: '2026-06-05T12:00:00+08:00',
        endsAt: '',
        enabled: false,
        order: '10',
        durationDays: '21',
        poolIdsText: 'special_001\nweaponbox_001',
      },
    ]);

    expect(JSON.parse(serialized)).toEqual({
      versions: [
        {
          id: 'lost-heirlooms',
          name: '寻遗散记',
          name_en: 'Lost Heirlooms',
          starts_at: '2026-06-05T12:00:00+08:00',
          ends_at: '2026-06-26T12:00:00+08:00',
          duration_days: 21,
          enabled: false,
          order: 10,
          pool_ids: ['special_001', 'weaponbox_001'],
        },
      ],
    });
  });

  it('builds a preview compatible with the homepage resolver', () => {
    const rows = [
      {
        id: 'current',
        name: '当前版本',
        nameEn: 'Current',
        startsAt: '2026-06-01T12:00:00+08:00',
        endsAt: '2026-06-30T12:00:00+08:00',
        enabled: true,
        order: '10',
        poolIdsText: '',
      },
      {
        id: 'next',
        name: '后续版本',
        nameEn: 'Next',
        startsAt: '2026-07-01T12:00:00+08:00',
        endsAt: '',
        enabled: true,
        order: '20',
        poolIdsText: '',
      },
    ];

    const preview = buildHomeVersionTimelineEditorPreview(rows, {
      now: new Date('2026-06-15T12:00:00+08:00'),
    });

    expect(preview.currentVersion.id).toBe('current');
    expect(preview.nextVersion.id).toBe('next');
    expect(preview.countdownVersion.id).toBe('next');
    expect(preview.targetAt).toBe('2026-07-01T12:00:00+08:00');
  });

  it('previews homepage version sections and folded expired extra pools from selected pools', () => {
    const rows = [
      {
        id: 'lost-heirlooms',
        name: '寻遗散记',
        nameEn: 'Lost Heirlooms',
        startsAt: '2026-06-05T12:00:00+08:00',
        endsAt: '2026-06-26T12:00:00+08:00',
        enabled: true,
        order: '10',
        poolIdsText: 'extra_festival\nlimited_zhuang',
      },
    ];

    const sections = buildHomeVersionTimelinePoolPreview(rows, [
      {
        pool_id: 'extra_festival',
        name: '辉光庆典',
        type: 'extra',
        start_time: '2026-06-05T12:00:00+08:00',
        end_time: '2026-06-12T12:00:00+08:00',
      },
      {
        pool_id: 'limited_zhuang',
        name: '庄方宜',
        type: 'limited',
        start_time: '2026-06-13T12:00:00+08:00',
        end_time: '2026-06-26T12:00:00+08:00',
      },
      {
        pool_id: 'not_selected',
        name: '未选择卡池',
        type: 'limited',
        start_time: '2026-06-13T12:00:00+08:00',
        end_time: '2026-06-26T12:00:00+08:00',
      },
    ], {
      now: new Date('2026-06-20T12:00:00+08:00'),
    });

    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe('lost-heirlooms');
    expect(sections[0].hiddenExtraCount).toBe(1);
    expect(sections[0].pools.map((pool) => pool.id)).toEqual(['limited_zhuang']);
    expect(sections[0].pools[0].foldedExtraPools.map((pool) => pool.id)).toEqual(['extra_festival']);
  });
});
