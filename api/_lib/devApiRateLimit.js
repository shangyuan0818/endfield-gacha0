export async function enforceRateLimit(adminClient, identifier, action) {
  const normalizedIdentifier = String(identifier || '').trim();
  const normalizedAction = String(action || '').trim();

  if (!normalizedIdentifier || !normalizedAction) {
    return { allowed: true };
  }

  const { data, error } = await adminClient.rpc('check_and_log_rate_limit', {
    p_identifier: normalizedIdentifier,
    p_action: normalizedAction,
  });

  if (error) {
    throw error;
  }

  return data || { allowed: true };
}

export default {
  enforceRateLimit,
};
