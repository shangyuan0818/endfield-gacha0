const CHALLENGE_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

function normalizeCommandName(rawValue) {
  return String(rawValue || '')
    .trim()
    .replace(/^\//, '')
    .replace(/@.+$/, '')
    .toLowerCase();
}

export function isBindingChallengeCode(rawValue) {
  return CHALLENGE_CODE_PATTERN.test(String(rawValue || '').trim().toUpperCase());
}

export function parseBotCommand(rawText) {
  const text = String(rawText || '').trim();
  if (!text) {
    return {
      name: 'help',
      args: [],
      raw: text,
    };
  }

  if (isBindingChallengeCode(text)) {
    return {
      name: 'verify',
      args: [text.toUpperCase()],
      raw: text,
    };
  }

  const tokens = text.split(/\s+/).filter(Boolean);
  const firstToken = tokens[0] || '';
  if (!firstToken.startsWith('/')) {
    return {
      name: 'unknown',
      args: tokens.slice(1),
      raw: text,
    };
  }

  const commandName = normalizeCommandName(firstToken);
  return {
    name: commandName || 'help',
    args: tokens.slice(1),
    raw: text,
  };
}

export default {
  parseBotCommand,
  isBindingChallengeCode,
};
