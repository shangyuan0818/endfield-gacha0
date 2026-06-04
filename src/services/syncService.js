/**
 * 旧同步层已退役。
 *
 * 主同步路径统一为：
 * - `useCloudSync`
 * - `accountGachaDataService`
 *
 * 保留一个空壳导出，仅用于兼容历史导入路径，避免残留引用在编译阶段直接报错。
 */
const noop = () => {};

export const syncManager = {
  startAutoSync: noop,
  stopAutoSync: noop,
  enqueue: noop,
  flushQueue: async () => {},
  getQueueSize: () => 0,
  getStats: () => ({
    totalSyncs: 0,
    lastSyncTime: null,
    lastSyncDurationMs: null,
    failedSyncs: 0,
    successfulSyncs: 0,
    queueSize: 0,
    isRunning: false,
    isSyncing: false,
  }),
  resetStats: noop
};
