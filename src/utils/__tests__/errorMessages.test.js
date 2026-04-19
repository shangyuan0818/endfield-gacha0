import { describe, expect, it } from 'vitest';

import {
  getFriendlyErrorMessage,
  getSimpleFriendlyError,
  isNetworkConnectivityError,
} from '../errorMessages.js';

describe('errorMessages', () => {
  it('classifies failed-to-fetch errors as connectivity failures', () => {
    const result = getFriendlyErrorMessage(new Error('TypeError: Failed to fetch'));

    expect(result).toMatchObject({
      message: '服务连接失败',
    });
    expect(result.solution).toContain('服务节点');
  });

  it('detects connection reset errors from browser/network layers', () => {
    expect(isNetworkConnectivityError('net::ERR_CONNECTION_RESET')).toBe(true);
    expect(getSimpleFriendlyError('net::ERR_CONNECTION_RESET')).toContain('服务连接失败');
  });
});
