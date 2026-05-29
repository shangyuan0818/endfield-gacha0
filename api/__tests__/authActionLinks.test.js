// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { normalizeGeneratedAuthActionLink } from '../_lib/authActionLinks.js';

describe('auth action link normalization', () => {
  it('keeps valid non-local auth links unchanged', () => {
    expect(normalizeGeneratedAuthActionLink(
      'https://db.example.test/auth/v1/verify?token=abc&type=signup',
      { SUPABASE_URL: 'https://db.example.test' },
    )).toBe('https://db.example.test/auth/v1/verify?token=abc&type=signup');
  });

  it('rewrites localhost auth links to the configured Supabase public URL', () => {
    expect(normalizeGeneratedAuthActionLink(
      'http://localhost:8000/auth/v1/verify?token=abc&type=signup',
      { SUPABASE_URL: 'https://db.example.test' },
    )).toBe('https://db.example.test/auth/v1/verify?token=abc&type=signup');
  });

  it('recovers malformed self-hosted auth links that contain an auth path', () => {
    expect(normalizeGeneratedAuthActionLink(
      'http://localhost:8000,https:/auth/v1/verify?token=abc&type=signup&redirect_to=https%3A%2F%2Fef-gacha.mogujun.icu',
      { SUPABASE_URL: 'https://db.example.test' },
    )).toBe('https://db.example.test/auth/v1/verify?token=abc&type=signup&redirect_to=https%3A%2F%2Fef-gacha.mogujun.icu');
  });

  it('does not invent a replacement when no Supabase public URL is configured', () => {
    const malformed = 'http://localhost:8000,https:/auth/v1/verify?token=abc&type=signup';
    expect(normalizeGeneratedAuthActionLink(malformed, {})).toBe(malformed);
  });
});
