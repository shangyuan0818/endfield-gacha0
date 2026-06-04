import {
  serializeHistoryForUpsert,
  serializePoolForUpsert,
} from '../utils/cloudDataWriteRows.js';
import { saveAccountGachaData } from './accountGachaDataService.js';

export async function upsertPools(supabaseClient, pools, currentUserId) {
  if (!Array.isArray(pools) || pools.length === 0) {
    return;
  }

  await saveAccountGachaData({
    pools: pools.map(pool => ({
      ...pool,
      user_id: pool?.user_id || currentUserId || undefined,
    })),
  });
}

export async function upsertHistory(supabaseClient, records, currentUserId) {
  if (!Array.isArray(records) || records.length === 0) {
    return;
  }

  await saveAccountGachaData({
    history: records.map(record => ({
      ...record,
      user_id: record?.user_id || currentUserId || undefined,
    })),
  });
}

export {
  serializeHistoryForUpsert,
  serializePoolForUpsert,
};
