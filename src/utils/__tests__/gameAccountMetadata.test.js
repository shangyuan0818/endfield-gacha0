import { describe, expect, it } from 'vitest';

import { localizeGameAccountServerTag } from '../gameAccountMetadata.js';

describe('gameAccountMetadata', () => {
  it('keeps chinese server tags unchanged under zh locales', () => {
    expect(localizeGameAccountServerTag('国际服·亚服', 'zh-CN')).toBe('国际服·亚服');
  });

  it('localizes common server tags into compact english labels', () => {
    expect(localizeGameAccountServerTag('官服', 'en-US')).toBe('Official');
    expect(localizeGameAccountServerTag('B服', 'en-US')).toBe('Bilibili');
    expect(localizeGameAccountServerTag('国际服·亚服', 'en-US')).toBe('Intl Asia');
    expect(localizeGameAccountServerTag('国际服·欧/美服', 'en-US')).toBe('Intl EU/NA');
  });

  it('passes through unknown tags', () => {
    expect(localizeGameAccountServerTag('Test Region', 'en-US')).toBe('Test Region');
  });
});
