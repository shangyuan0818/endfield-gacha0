import { getPreferredPoolId } from './poolSelectionUtils';

export function applyCloudDataToStores(
  cloudData,
  {
    setPools,
    switchPool,
    setHistory,
    preferredPoolId = null,
  }
) {
  if (!cloudData || !Array.isArray(cloudData.pools) || cloudData.pools.length === 0) {
    return;
  }

  setPools(cloudData.pools);

  const fallbackId = getPreferredPoolId(cloudData.pools, {
    preferredPoolId
  });

  if (fallbackId) {
    switchPool(fallbackId);
    localStorage.setItem('gacha_current_pool_id', fallbackId);
  }

  if (Array.isArray(cloudData.history)) {
    setHistory(cloudData.history);
  }
}
