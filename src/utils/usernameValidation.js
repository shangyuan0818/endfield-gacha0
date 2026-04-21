export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 50;

const USERNAME_ALLOWED_PATTERN = /^[\p{L}\p{N}\p{M}._+-]+$/u;

export function normalizeUsername(value) {
  return String(value ?? '').trim();
}

export function getPreferredUsername(user, fallback = '') {
  const candidates = [
    user?.username,
    user?.user_metadata?.username,
    user?.user_metadata?.full_name,
    fallback,
    user?.email ? String(user.email).split('@')[0] : '',
  ];

  return candidates
    .map((value) => normalizeUsername(value))
    .find(Boolean) || '';
}

export function buildUserDiscriminator(value) {
  const seed = normalizeUsername(value);
  if (!seed) {
    return null;
  }

  let hash = 0;
  for (const char of seed) {
    hash = (hash * 131 + char.codePointAt(0)) % 10000;
  }

  return String(hash).padStart(4, '0');
}

export function buildUsernameHandle(subject, fallback = '') {
  const username = typeof subject === 'string'
    ? normalizeUsername(subject)
    : getPreferredUsername(subject, fallback);
  if (!username) {
    return '';
  }

  const discriminator = buildUserDiscriminator(
    typeof subject === 'string'
      ? subject
      : subject?.id || subject?.user_id || username
  );

  return discriminator ? `${username}#${discriminator}` : username;
}

export function getUsernameValidationCode(value, { required = false } = {}) {
  const username = normalizeUsername(value);

  if (!username) {
    return required ? 'required' : null;
  }

  if (username.length < USERNAME_MIN_LENGTH) {
    return 'too_short';
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return 'too_long';
  }

  if (!USERNAME_ALLOWED_PATTERN.test(username)) {
    return 'invalid_characters';
  }

  return null;
}

export function isValidUsername(value, options = {}) {
  return getUsernameValidationCode(value, options) === null;
}

export default {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  normalizeUsername,
  getPreferredUsername,
  buildUserDiscriminator,
  buildUsernameHandle,
  getUsernameValidationCode,
  isValidUsername,
};
