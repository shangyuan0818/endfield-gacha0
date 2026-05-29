export const POW_ALGORITHM = 'sha256-chain-v1';

export function toHex(buffer) {
  return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, '0')).join('');
}

export function isLikelyMainlandChinaLocale({
  language = typeof navigator !== 'undefined' ? navigator.language : '',
  languages = typeof navigator !== 'undefined' ? navigator.languages : [],
  timezone = '',
} = {}) {
  const localeValues = [
    language,
    ...(Array.isArray(languages) ? languages : []),
  ].map((value) => String(value || '').toLowerCase());

  if (localeValues.some((value) => value === 'zh-cn' || value.startsWith('zh-hans'))) {
    return true;
  }

  const resolvedTimezone = timezone || (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
      return '';
    }
  })();

  return [
    'Asia/Shanghai',
    'Asia/Chongqing',
    'Asia/Harbin',
    'Asia/Urumqi',
  ].includes(resolvedTimezone);
}

export function shouldPreferPowCaptcha(env = import.meta.env, runtime = {}) {
  const explicit = String(env?.VITE_AUTH_CAPTCHA_REGION_STRATEGY || env?.VITE_CAPTCHA_REGION_STRATEGY || '').trim().toLowerCase();
  if (explicit === 'pow' || explicit === 'cn-pow' || explicit === 'china-pow') {
    return true;
  }
  if (explicit === 'turnstile' || explicit === 'provider') {
    return false;
  }

  return isLikelyMainlandChinaLocale(runtime);
}

export function createLocalPowChallenge({
  action = 'site_gate',
  difficulty = 3,
  totalSteps = 9600,
  expiresInMs = 10 * 60 * 1000,
} = {}) {
  const seed = createRandomSeed();
  const issuedAt = Date.now();

  return {
    algorithm: POW_ALGORITHM,
    action,
    challengeId: `local-${seed.slice(0, 12)}`,
    difficulty,
    expiresAt: issuedAt + expiresInMs,
    issuedAt,
    seed,
    signature: '',
    totalSteps,
  };
}

function createRandomSeed() {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return toHex(bytes);
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 18)}`;
}

export function getPowWorkConfig({
  isMobile = false,
  difficulty = 3,
  totalSteps,
} = {}) {
  const normalizedDifficulty = Math.max(1, Math.min(5, Number.parseInt(difficulty, 10) || 3));
  const baseSteps = isMobile ? 5200 : 7200;
  const steps = Number.isFinite(Number(totalSteps)) && Number(totalSteps) > 0
    ? Number(totalSteps)
    : baseSteps + normalizedDifficulty * (isMobile ? 900 : 1200);

  return {
    difficulty: normalizedDifficulty,
    progressInterval: Math.max(120, Math.floor(steps / 10)),
    rounds: normalizedDifficulty,
    totalSteps: steps,
  };
}

export async function hashPowStep({
  seed,
  step,
  previousHash,
  rounds,
  subtle = typeof crypto !== 'undefined' ? crypto.subtle : null,
}) {
  if (!subtle?.digest) {
    throw new Error('WebCrypto subtle digest is unavailable');
  }

  const encoder = new TextEncoder();
  let payload = encoder.encode(`${seed}:${step}:${previousHash}`);
  let hex = '';

  for (let round = 0; round < rounds; round += 1) {
    // eslint-disable-next-line no-await-in-loop -- proof-of-work rounds are intentionally sequential.
    const digest = await subtle.digest('SHA-256', payload);
    hex = toHex(digest);

    if (round + 1 < rounds) {
      payload = encoder.encode(`${seed}:${step}:${hex}:${round + 1}`);
    }
  }

  return hex;
}

export async function solvePowChallenge(challenge, {
  onProgress,
  isMobile = false,
  subtle = typeof crypto !== 'undefined' ? crypto.subtle : null,
} = {}) {
  const workConfig = getPowWorkConfig({
    isMobile,
    difficulty: challenge?.difficulty,
    totalSteps: challenge?.totalSteps,
  });
  let step = 0;
  let hash = challenge.seed;

  while (step < workConfig.totalSteps) {
    // eslint-disable-next-line no-await-in-loop -- proof-of-work is intentionally sequential.
    hash = await hashPowStep({
      seed: challenge.seed,
      step,
      previousHash: hash,
      rounds: workConfig.rounds,
      subtle,
    });
    step += 1;

    if (step % workConfig.progressInterval === 0 || step === workConfig.totalSteps) {
      onProgress?.({
        hash,
        percent: Math.min(100, Math.round((step / workConfig.totalSteps) * 100)),
        step,
        totalSteps: workConfig.totalSteps,
      });
    }
  }

  return {
    action: challenge.action || '',
    algorithm: challenge.algorithm || POW_ALGORITHM,
    challengeId: challenge.challengeId || '',
    difficulty: workConfig.difficulty,
    expiresAt: challenge.expiresAt || 0,
    hash,
    issuedAt: challenge.issuedAt || 0,
    seed: challenge.seed,
    signature: challenge.signature || '',
    step,
    totalSteps: workConfig.totalSteps,
  };
}
