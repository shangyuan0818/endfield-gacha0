// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  resolveSupabasePublishableKey,
  resolveSupabaseUrl,
} from '../_lib/supabaseEnv.js';

describe('supabaseEnv', () => {
  it('accepts Supabase Dashboard public env aliases for contributor dev', () => {
    expect(resolveSupabaseUrl({
      SUPABASE_URL: 'https://db.example.test',
    })).toBe('https://db.example.test');

    expect(resolveSupabasePublishableKey({
      PUBLISHABLE_KEY: ' sb_publishable_dashboard ',
    })).toBe('sb_publishable_dashboard');
  });

  it('keeps VITE/SUPABASE publishable key aliases ahead of the short fallback', () => {
    expect(resolveSupabasePublishableKey({
      PUBLISHABLE_KEY: 'short-key',
      SUPABASE_PUBLISHABLE_KEY: 'server-public-key',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'vite-public-key',
    })).toBe('server-public-key');
  });
});
