/**
 * 卡池时间工具函数
 * 用于从数据库中获取当前活跃的限定池信息
 */

import { LIMITED_POOL_SCHEDULE } from '../constants';

/**
 * 从 pools 数组中获取当前活跃的限定池
 * @param {Array} pools - 卡池数组（来自 usePoolStore）
 * @returns {Object|null} 当前活跃的限定池信息
 */
export const getCurrentLimitedPoolFromDB = (pools) => {
  if (!pools || pools.length === 0) return null;

  const now = new Date();

  // 筛选限定角色池，且有时间范围的
  const limitedPools = pools.filter(pool => {
    const isLimited = pool.type === 'limited' || pool.type === 'limited_character';
    return isLimited && pool.start_time && pool.end_time;
  });

  if (limitedPools.length === 0) return null;

  // 按 start_time 排序（最新的在前）
  const sortedPools = [...limitedPools].sort((a, b) => {
    return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
  });

  // 查找当前活跃的卡池
  for (const pool of sortedPools) {
    const start = new Date(pool.start_time);
    const end = new Date(pool.end_time);

    if (now >= start && now < end) {
      // 找到下一个卡池
      const currentIndex = sortedPools.indexOf(pool);
      const nextPool = sortedPools[currentIndex - 1]; // 因为是倒序，所以下一个在前面

      // 计算剩余时间
      const remainingMs = end - now;
      const remainingDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
      const remainingHours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      return {
        name: pool.up_character || pool.name,
        startDate: pool.start_time,
        endDate: pool.end_time,
        startDateObj: start,
        endDateObj: end,
        nextPool: nextPool ? (nextPool.up_character || nextPool.name) : '待公布',
        isActive: true,
        remainingDays,
        remainingHours,
        poolData: pool, // 保留完整的 pool 对象
      };
    }
  }

  // 如果当前时间在所有卡池之前，返回最早的未开始卡池
  const futurePools = sortedPools.filter(pool => now < new Date(pool.start_time));
  if (futurePools.length > 0) {
    // 按 start_time 正序排序，找到最早的
    const earliestPool = futurePools.sort((a, b) => {
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    })[0];

    const start = new Date(earliestPool.start_time);
    const end = new Date(earliestPool.end_time);
    const startsInMs = start - now;

    return {
      name: earliestPool.up_character || earliestPool.name,
      startDate: earliestPool.start_time,
      endDate: earliestPool.end_time,
      startDateObj: start,
      endDateObj: end,
      nextPool: '待公布',
      isActive: false,
      startsIn: Math.floor(startsInMs / (1000 * 60 * 60 * 24)),
      startsInHours: Math.floor((startsInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      poolData: earliestPool,
    };
  }

  // 所有卡池都已结束，返回最后一个
  if (sortedPools.length > 0) {
    const lastPool = sortedPools[0]; // 倒序排序，第一个就是最新的
    const start = new Date(lastPool.start_time);
    const end = new Date(lastPool.end_time);

    return {
      name: lastPool.up_character || lastPool.name,
      startDate: lastPool.start_time,
      endDate: lastPool.end_time,
      startDateObj: start,
      endDateObj: end,
      nextPool: '待公布',
      isActive: false,
      isExpired: true,
      poolData: lastPool,
    };
  }

  return null;
};

/**
 * 获取限定池轮换计划（按时间顺序）
 * @param {Array} pools - 卡池数组（来自 usePoolStore）
 * @returns {Array} 限定池轮换计划数组
 */
export const getLimitedPoolScheduleFromDB = (pools) => {
  if (!pools || pools.length === 0) return [];

  // 筛选限定角色池，且有时间范围的
  const limitedPools = pools.filter(pool => {
    const isLimited = pool.type === 'limited' || pool.type === 'limited_character';
    return isLimited && pool.start_time && pool.end_time;
  });

  if (limitedPools.length === 0) return [];

  // 按 start_time 正序排序（最早的在前）
  const sortedPools = [...limitedPools].sort((a, b) => {
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  });

  // 从硬编码中查找 removesAfter 的映射
  const removesAfterMap = {};
  for (const s of LIMITED_POOL_SCHEDULE) {
    if (s.removesAfter) removesAfterMap[s.name] = s.removesAfter;
  }

  // 转换为与 LIMITED_POOL_SCHEDULE 兼容的格式
  return sortedPools.map(pool => {
    const charName = pool.up_character || pool.name;
    return {
      name: charName,
      startDate: pool.start_time,
      endDate: pool.end_time,
      removesAfter: pool.removesAfter || removesAfterMap[charName] || null,
      poolData: pool,
    };
  });
};

/**
 * 获取当前 UP 池信息（优先使用数据库，fallback 到硬编码）
 * @param {Array} pools - 卡池数组（来自 usePoolStore）
 * @returns {Object} 当前 UP 池信息
 */
export const getCurrentUpPoolInfo = (pools) => {
  // 优先从数据库获取
  const dbPool = getCurrentLimitedPoolFromDB(pools);
  if (dbPool) return dbPool;

  // Fallback 到硬编码
  const now = new Date();
  for (const pool of LIMITED_POOL_SCHEDULE) {
    const start = new Date(pool.startDate);
    const end = new Date(pool.endDate);

    if (now >= start && now < end) {
      const index = LIMITED_POOL_SCHEDULE.indexOf(pool);
      const nextPool = LIMITED_POOL_SCHEDULE[index + 1];
      const remainingMs = end - now;
      const remainingDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
      const remainingHours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      return {
        ...pool,
        startDateObj: start,
        endDateObj: end,
        nextPool: nextPool?.name || '待公布',
        isActive: true,
        remainingDays,
        remainingHours,
      };
    }
  }

  // 如果当前时间在所有卡池之前
  const firstPool = LIMITED_POOL_SCHEDULE[0];
  const firstStart = new Date(firstPool.startDate);
  if (now < firstStart) {
    const firstEnd = new Date(firstPool.endDate);
    const startsInMs = firstStart - now;
    return {
      ...firstPool,
      startDateObj: firstStart,
      endDateObj: firstEnd,
      nextPool: LIMITED_POOL_SCHEDULE[1]?.name || '待公布',
      isActive: false,
      startsIn: Math.floor(startsInMs / (1000 * 60 * 60 * 24)),
      startsInHours: Math.floor((startsInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    };
  }

  // 所有卡池都已结束
  const lastPool = LIMITED_POOL_SCHEDULE[LIMITED_POOL_SCHEDULE.length - 1];
  const lastStart = new Date(lastPool.startDate);
  const lastEnd = new Date(lastPool.endDate);
  return {
    ...lastPool,
    startDateObj: lastStart,
    endDateObj: lastEnd,
    nextPool: '待公布',
    isActive: false,
    isExpired: true,
  };
};

/**
 * 获取限定池轮换计划（优先使用数据库，fallback 到硬编码）
 * @param {Array} pools - 卡池数组（来自 usePoolStore）
 * @returns {Array} 限定池轮换计划数组
 */
export const getLimitedPoolSchedule = (pools) => {
  // 优先从数据库获取
  const dbSchedule = getLimitedPoolScheduleFromDB(pools);
  if (dbSchedule.length > 0) return dbSchedule;

  // Fallback 到硬编码
  return LIMITED_POOL_SCHEDULE;
};
