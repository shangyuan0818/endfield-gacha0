import { getSupabaseAdminClient } from './authAdmin.js';

export async function detectNewCharacters(unresolvedNames) {
  const names = Array.isArray(unresolvedNames) ? unresolvedNames.filter(Boolean) : [];
  if (names.length === 0) {
    return { found: 0 };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { found: names.length, names, error: 'Database not configured' };
  }

  let existing = [];
  try {
    const { data } = await supabase
      .from('site_config')
      .select('value')
      .eq('key', 'unregistered_characters')
      .single();
    if (data?.value) {
      existing = JSON.parse(data.value);
    }
  } catch {
    // key doesn't exist yet or parse failed
  }

  const merged = [...new Set([...existing, ...names])];

  const { error } = await supabase
    .from('site_config')
    .upsert(
      {
        key: 'unregistered_characters',
        value: JSON.stringify(merged),
        label: '未收录角色/武器提醒',
        category: 'alert',
      },
      { onConflict: 'key' },
    );

  return {
    found: names.length,
    total: merged.length,
    names: merged,
    error: error?.message,
  };
}
