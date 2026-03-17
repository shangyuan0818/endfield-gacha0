import { supabase } from '../supabaseClient';

export async function finalizeDeletedAccountSession({
  loadPublicPools,
  setPools,
  setHistory,
  switchPool,
  switchGameAccount,
  logout,
}) {
  let publicPools = null;

  try {
    publicPools = await loadPublicPools?.();
  } catch {
    publicPools = null;
  }

  setHistory([]);

  if (Array.isArray(publicPools)) {
    setPools(publicPools);
    switchPool(publicPools[0]?.id || null);
  } else {
    setPools([]);
    switchPool(null);
  }

  switchGameAccount?.(null);

  try {
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch {
    // Deleting auth.users may invalidate the current session before signOut finishes.
  }

  logout?.();
}

export default finalizeDeletedAccountSession;
