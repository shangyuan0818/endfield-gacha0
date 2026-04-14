export function getAccountLastImportTimestamp(account) {
  if (!account) {
    return null;
  }

  return (
    account.lastImportedAt
    || account.lastImportedRecordAt
    || account.latestRecordAt
    || null
  );
}
