import { describe, expect, it } from 'vitest';

import {
  isOAuthAccountCompletionRequired,
  isOAuthEmailSetupRequired,
  isOAuthPasswordSetupRequired,
} from '../accountSecurityService.js';

describe('accountSecurityService OAuth setup guards', () => {
  it('detects third-party email setup requirements', () => {
    expect(isOAuthEmailSetupRequired({
      emailVerificationRequired: true,
      emailVerificationReason: 'oauth_email_setup_required:github',
    })).toBe(true);
  });

  it('detects third-party password setup requirements', () => {
    expect(isOAuthPasswordSetupRequired({
      passwordChangeRequired: true,
      reason: 'oauth_password_setup_required:github',
    })).toBe(true);
  });

  it('does not treat ordinary unverified email as third-party account completion', () => {
    expect(isOAuthAccountCompletionRequired({
      emailVerificationRequired: true,
      emailVerificationReason: 'signup_email_verification_required',
      passwordChangeRequired: false,
      reason: null,
    })).toBe(false);
  });

  it('requires completion when either third-party email or password setup is pending', () => {
    expect(isOAuthAccountCompletionRequired({
      emailVerificationRequired: false,
      emailVerificationReason: null,
      passwordChangeRequired: true,
      reason: 'oauth_password_setup_required:github',
    })).toBe(true);

    expect(isOAuthAccountCompletionRequired({
      emailVerificationRequired: true,
      emailVerificationReason: 'oauth_email_setup_required:github',
      passwordChangeRequired: false,
      reason: null,
    })).toBe(true);
  });
});
