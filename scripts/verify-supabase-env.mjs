import assert from 'node:assert/strict';

import {
  resolveSupabasePublishableKey,
  resolveSupabaseSecretKey,
  resolveSupabaseServerKey,
  resolveSupabaseUrl,
} from './lib/supabaseEnv.mjs';

assert.equal(
  resolveSupabaseUrl({
    VITE_SUPABASE_URL: 'your-project-ref',
    SUPABASE_URL: 'https://db.example.test',
  }),
  'https://db.example.test',
  'SUPABASE_URL should win when VITE_SUPABASE_URL is a placeholder'
);

assert.equal(
  resolveSupabaseUrl({
    SUPABASE_URL: 'not-a-url',
    VITE_SUPABASE_URL: '"https://vite.example.test"',
  }),
  'https://vite.example.test',
  'resolver should strip quotes and fall back to the first valid URL'
);

assert.equal(
  resolveSupabaseUrl({
    SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_URL: 'your-project-ref.supabase.co',
  }),
  '',
  'resolver should reject documented placeholder Supabase URLs'
);

assert.equal(
  resolveSupabaseSecretKey({
    SUPABASE_SERVICE_ROLE_KEY: ' service-key ',
  }),
  'service-key'
);

assert.equal(
  resolveSupabasePublishableKey({
    VITE_SUPABASE_ANON_KEY: "'anon-key'",
  }),
  'anon-key'
);

assert.equal(
  resolveSupabaseServerKey({
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  }),
  'anon-key'
);

console.log('Supabase env resolver verification passed');
