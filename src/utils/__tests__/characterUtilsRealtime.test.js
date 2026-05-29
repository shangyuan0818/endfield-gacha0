import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function createMockSupabase() {
  const channelApi = {
    on: vi.fn(() => channelApi),
    subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
  };

  return {
    channelApi,
    supabase: {
      channel: vi.fn(() => channelApi),
    },
  };
}

async function importCharacterUtils({ realtimeEnabled, supabase }) {
  vi.resetModules();

  vi.doMock('../../supabaseClient.js', () => ({
    supabase,
    isSupabaseRealtimeEnabled: () => realtimeEnabled,
  }));

  vi.doMock('../../services/publicResourceClient.js', () => ({
    fetchPublicApiJson: vi.fn(async () => ({
      success: true,
      data: {
        characters: [
          {
            id: 'char_test',
            name: 'Test',
            aliases: [],
            avatar_url: null,
            rarity: 6,
            type: 'character',
            is_limited: false,
          },
        ],
      },
    })),
    shouldAllowPublicSupabaseFallback: () => true,
  }));

  vi.doMock('../../services/supabaseRequest.js', () => ({
    executeSupabaseMutation: vi.fn(),
    executeSupabaseRead: vi.fn(),
  }));

  return import('../characterUtils.js');
}

describe('character realtime subscription gate', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('does not open a Supabase realtime channel by default', async () => {
    const { supabase } = createMockSupabase();
    const { characterCache } = await importCharacterUtils({ realtimeEnabled: false, supabase });

    await characterCache.load();

    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('opens the characters channel only when realtime is explicitly enabled', async () => {
    const { channelApi, supabase } = createMockSupabase();
    const { characterCache } = await importCharacterUtils({ realtimeEnabled: true, supabase });

    await characterCache.load();

    expect(supabase.channel).toHaveBeenCalledWith('characters_changes');
    expect(channelApi.subscribe).toHaveBeenCalledTimes(1);
  });
});
