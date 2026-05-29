import { fetchJsonWithTimeout } from './supabaseRequest.js';
import { createLocalPowChallenge } from '../utils/powChallengeCore.js';

export async function createAuthPowChallenge(action, {
  timeoutMs = 12000,
  allowLocalFallback = import.meta.env?.DEV,
} = {}) {
  const { response, data } = await fetchJsonWithTimeout('/api/auth-pow-challenge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action }),
  }, {
    label: 'auth-pow-challenge',
    timeoutMs,
    retries: 1,
  }).catch((error) => {
    if (allowLocalFallback) {
      return {
        response: { ok: true },
        data: {
          success: true,
          challenge: createLocalPowChallenge({ action }),
        },
      };
    }
    throw error;
  });

  if (!response.ok || data?.success !== true || !data?.challenge) {
    if (allowLocalFallback) {
      return createLocalPowChallenge({ action });
    }
    throw new Error(data?.error || 'Failed to create PoW challenge');
  }

  return data.challenge;
}
