import { describe, expect, it } from 'vitest';
import { getCombinedCharacterAverageDisplay } from '../summaryAverageDisplay.js';

describe('getCombinedCharacterAverageDisplay', () => {
  it('uses the aggregate character average when no excluding-free average exists', () => {
    const result = getCombinedCharacterAverageDisplay({
      characterStats: { six: 10, avgPity: '41.1' },
      extraStats: { six: 2, avgPity: '30.0' },
      limitedStats: { six: 6, avgPity: '45.0' },
      standardStats: { six: 2, avgPity: '60.0' },
    });

    expect(result).toEqual({
      value: '41.1',
      withFree: null,
    });
  });

  it('does not treat normal extra-pool averages as excluding-free averages', () => {
    const result = getCombinedCharacterAverageDisplay({
      extraStats: { six: 2, avgPity: '30.0' },
      limitedStats: { six: 6, avgPity: '45.0' },
      standardStats: { six: 2, avgPity: '60.0' },
    });

    expect(result).toEqual({
      value: '45.0',
      withFree: null,
    });
  });

  it('shows a with-free hint only when an explicit excluding-free average exists', () => {
    const result = getCombinedCharacterAverageDisplay({
      extraStats: { six: 2, avgPity: '30.0' },
      limitedStats: { six: 6, avgPity: '45.0', avgPityExcludingFree: '40.0' },
      standardStats: { six: 2, avgPity: '60.0' },
    });

    expect(result).toEqual({
      value: '42.0',
      withFree: '45.0',
    });
  });
});
