import { describe, expect, it } from 'vitest';

import {
  buildUsernameHandle,
  getPreferredUsername,
  getUsernameValidationCode,
} from '../usernameValidation.js';

describe('usernameValidation', () => {
  it('accepts multilingual usernames with common email-local-part symbols', () => {
    expect(getUsernameValidationCode('终末地.Test_ユーザー+01')).toBeNull();
  });

  it('rejects special punctuation outside the allowlist', () => {
    expect(getUsernameValidationCode('终末地！')).toBe('invalid_characters');
  });

  it('builds a stable display handle with a four-digit discriminator', () => {
    const user = {
      id: '2b884ad6-bd6a-4770-b0f0-dc5854bfe001',
      email: 'test@example.com',
      user_metadata: {
        username: 'Talos',
      },
    };

    expect(getPreferredUsername(user)).toBe('Talos');
    expect(buildUsernameHandle(user)).toMatch(/^Talos#\d{4}$/);
  });

  it('uses direct username fields from public profile records', () => {
    const publicProfile = {
      id: '6d1fded4-0efe-4701-95ef-71361cadfd2b',
      username: '终末地用户',
      role: 'user',
    };

    expect(getPreferredUsername(publicProfile)).toBe('终末地用户');
    expect(buildUsernameHandle(publicProfile)).toMatch(/^终末地用户#\d{4}$/);
  });
});
