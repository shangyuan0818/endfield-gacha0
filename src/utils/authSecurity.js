export const ACCOUNT_PASSWORD_POLICY = Object.freeze({
  minLength: 8,
  maxLength: 100,
  minCharacterGroups: 2,
});

export function getPasswordCharacterGroups(password) {
  const value = typeof password === 'string' ? password : '';
  return [
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /[0-9]/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;
}

export function validateAccountPassword(password) {
  const value = typeof password === 'string' ? password : '';
  const errors = [];

  if (!value) {
    errors.push('required');
    return {
      isValid: false,
      strength: 'weak',
      characterGroups: 0,
      errors,
    };
  }

  if (value.length < ACCOUNT_PASSWORD_POLICY.minLength) {
    errors.push('too_short');
  }

  if (value.length > ACCOUNT_PASSWORD_POLICY.maxLength) {
    errors.push('too_long');
  }

  const characterGroups = getPasswordCharacterGroups(value);
  if (characterGroups < ACCOUNT_PASSWORD_POLICY.minCharacterGroups) {
    errors.push('too_simple');
  }

  let strength = 'weak';
  if (errors.length === 0) {
    strength = value.length >= 12 && characterGroups >= 3 ? 'strong' : 'medium';
  }

  return {
    isValid: errors.length === 0,
    strength,
    characterGroups,
    errors,
  };
}

export function getPrimaryAccountPasswordError(validation) {
  const errors = Array.isArray(validation?.errors) ? validation.errors : [];
  const priority = ['required', 'too_short', 'too_long', 'too_simple'];
  return priority.find((errorCode) => errors.includes(errorCode)) || null;
}

export function isInvalidCurrentPasswordError(error) {
  const message = `${error?.message || error || ''}`.toLowerCase();
  const code = `${error?.code || error?.status || ''}`.toLowerCase();

  return (
    code === 'invalid_credentials' ||
    message.includes('invalid login credentials') ||
    message.includes('invalid_credentials') ||
    message.includes('invalid current password')
  );
}
