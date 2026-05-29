import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_PASSWORD_POLICY,
  getPasswordCharacterGroups,
  getPrimaryAccountPasswordError,
  isInvalidCurrentPasswordError,
  validateAccountPassword,
} from '../authSecurity.js';

describe('authSecurity', () => {
  it('requires the account password policy used by registration and password changes', () => {
    expect(ACCOUNT_PASSWORD_POLICY).toMatchObject({
      minLength: 8,
      maxLength: 100,
      minCharacterGroups: 2,
    });

    expect(validateAccountPassword('short1')).toMatchObject({
      isValid: false,
      errors: expect.arrayContaining(['too_short']),
    });

    expect(validateAccountPassword('onlyletters')).toMatchObject({
      isValid: false,
      errors: expect.arrayContaining(['too_simple']),
    });

    expect(validateAccountPassword('valid123')).toMatchObject({
      isValid: true,
      strength: 'medium',
    });

    expect(validateAccountPassword('ValidPassword123!')).toMatchObject({
      isValid: true,
      strength: 'strong',
    });
  });

  it('counts independent password character groups', () => {
    expect(getPasswordCharacterGroups('abc')).toBe(1);
    expect(getPasswordCharacterGroups('abc123')).toBe(2);
    expect(getPasswordCharacterGroups('Abc123!')).toBe(4);
  });

  it('returns a stable primary policy error for UI messages', () => {
    expect(getPrimaryAccountPasswordError(validateAccountPassword(''))).toBe('required');
    expect(getPrimaryAccountPasswordError(validateAccountPassword('abc'))).toBe('too_short');
    expect(getPrimaryAccountPasswordError(validateAccountPassword('a'.repeat(101)))).toBe('too_long');
    expect(getPrimaryAccountPasswordError(validateAccountPassword('onlyletters'))).toBe('too_simple');
    expect(getPrimaryAccountPasswordError(validateAccountPassword('valid123'))).toBeNull();
  });

  it('classifies current-password authentication failures', () => {
    expect(isInvalidCurrentPasswordError({ message: 'Invalid login credentials' })).toBe(true);
    expect(isInvalidCurrentPasswordError({ code: 'invalid_credentials' })).toBe(true);
    expect(isInvalidCurrentPasswordError({ message: 'network failed' })).toBe(false);
  });
});
