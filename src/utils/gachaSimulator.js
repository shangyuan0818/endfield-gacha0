/**
 * 抽卡模拟器核心
 *
 * 管理模拟器状态和抽卡逻辑
 */

import {
  simulateSinglePull,
  simulateTenPull,
  checkGuaranteedLimitedTrigger,
  checkGiftAvailable,
  checkInfoBookAvailable,
  calculateExpectedPulls
} from './probabilityEngine.js';

import {
  LIMITED_POOL_RULES,
  WEAPON_POOL_RULES,
  STANDARD_POOL_RULES
} from '../constants/index.js';

import {
  getCurrentUpCharacter
} from '../constants/characterPools.js';

/**
 * 创建初始模拟器状态
 * @param {string} poolType - 卡池类型
 * @returns {Object} 初始状态
 */
export function createInitialState(poolType = 'limited_character') {
  return {
    // 卡池类型
    poolType,

    // 保底计数
    sixStarPity: 0,
    fiveStarPity: 0,

    // 保底状态
    isGuaranteedUp: false,              // 是否保底必出UP
    guaranteedLimitedPity: 0,           // 120抽硬保底计数（限定池）/80抽硬保底（武器池）
    hasReceivedGuaranteedLimited: false, // 是否已领取硬保底

    // 统计数据
    totalPulls: 0,
    sixStarCount: 0,
    fiveStarCount: 0,
    upSixStarCount: 0,                  // UP 6星数量

    // 赠送机制
    giftsReceived: 0,                   // 已领取的赠送次数（限定池：每240抽）
    freeTenPullsReceived: 0,            // 已领取的30抽赠送十连次数（限定池：每30抽）
    hasReceivedInfoBook: false,         // 是否已领取情报书（限定池：60抽，仅1次）
    hasReceivedSelectGift: false,       // 是否已领取自选赠送（常驻池：300抽，仅1次）

    // 资源
    syntheticJade: 0,                   // 合成玉
    pullTickets: 0,                     // 寻访凭证

    // 历史记录
    pullHistory: [],                    // 抽卡历史

    // UI状态
    isAnimating: false,
    lastPullResult: null
  };
}

/**
 * 根据卡池类型获取对应规则
 * @param {string} poolType - 卡池类型
 * @returns {Object} 卡池规则
 */
function getRulesByPoolType(poolType) {
  switch (poolType) {
    case 'limited':
    case 'limited_character':
      return LIMITED_POOL_RULES;
    case 'weapon':
    case 'limited_weapon':
      return WEAPON_POOL_RULES;
    case 'standard':
    case 'standard_pool':
      return STANDARD_POOL_RULES;
    default:
      return LIMITED_POOL_RULES;
  }
}

/**
 * 抽卡模拟器类
 */
export class GachaSimulator {
  constructor(poolType = 'limited_character', customRules = null, currentUpCharacter = null) {
    this.poolType = poolType;
    this.state = createInitialState(poolType);
    // 如果提供自定义规则则使用，否则根据 poolType 自动选择
    this.rules = customRules || getRulesByPoolType(poolType);
    this.listeners = [];
    // 当前UP角色（限定池专用）
    this.currentUpCharacter = currentUpCharacter;
  }

  /**
   * 设置当前UP角色
   * @param {string} characterName - UP角色名称
   */
  setCurrentUpCharacter(characterName) {
    this.currentUpCharacter = characterName;
  }

  /**
   * 获取当前UP角色
   * @returns {string} UP角色名称
   */
  getCurrentUpCharacter() {
    // 如果手动设置了UP角色，使用手动设置的
    if (this.currentUpCharacter) {
      return this.currentUpCharacter;
    }
    // 否则根据时间自动判断
    return getCurrentUpCharacter();
  }

  /**
   * 添加状态监听器
   * @param {Function} listener - 监听回调函数
   */
  addListener(listener) {
    this.listeners.push(listener);
  }

  /**
   * 移除监听器
   * @param {Function} listener - 监听回调函数
   */
  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * 通知所有监听器
   */
  notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * 更新状态
   * @param {Object} updates - 状态更新
   */
  updateState(updates) {
    this.state = {
      ...this.state,
      ...updates
    };
    this.notifyListeners();
  }

  /**
   * 单抽
   * @returns {Object} 抽卡结果
   */
  pullSingle() {
    // 获取当前UP角色（如果是限定池）
    const currentUpChar = (this.poolType === 'limited' || this.poolType === 'limited_character')
      ? this.getCurrentUpCharacter()
      : null;

    const result = simulateSinglePull(this.state, this.rules, this.poolType, currentUpChar);

    // 更新历史记录
    const pullRecord = {
      pullNumber: this.state.totalPulls + 1,
      rarity: result.rarity,
      isUp: result.isUp,
      isLimited: result.isLimited,
      characterName: result.characterName,
      timestamp: Date.now()
    };

    // 检查特殊机制
    const gifts = this.checkGifts(result.totalPulls);
    const infoBook = this.checkInfoBook(result);

    // 更新状态
    this.updateState({
      ...result,
      pullHistory: [...this.state.pullHistory, pullRecord],
      giftsReceived: gifts.count,
      hasReceivedInfoBook: infoBook || this.state.hasReceivedInfoBook,
      lastPullResult: pullRecord,
      upSixStarCount: result.rarity === 6 && result.isUp
        ? this.state.upSixStarCount + 1
        : this.state.upSixStarCount
    });

    return pullRecord;
  }

  /**
   * 十连
   * @returns {Array} 十连结果数组
   */
  pullTen() {
    // 获取当前UP角色（如果是限定池）
    const currentUpChar = (this.poolType === 'limited' || this.poolType === 'limited_character')
      ? this.getCurrentUpCharacter()
      : null;

    const results = simulateTenPull(this.state, this.rules, this.poolType, currentUpChar);
    const pullRecords = [];

    // 处理每一抽的结果
    results.forEach((result, index) => {
      const pullNumber = this.state.totalPulls + index + 1;

      const pullRecord = {
        pullNumber,
        rarity: result.rarity,
        isUp: result.isUp,
        isLimited: result.isLimited,
        characterName: result.characterName,
        timestamp: Date.now() + index, // 加上微小偏移区分
        batchIndex: index,
        isTenPull: true
      };

      pullRecords.push(pullRecord);
    });

    // 使用最后一抽的结果更新状态
    const finalResult = results[results.length - 1];

    // 检查特殊机制
    const gifts = this.checkGifts(finalResult.totalPulls);
    const infoBook = this.checkInfoBook(finalResult);

    // 统计UP 6星数量
    const upSixStars = results.filter(r => r.rarity === 6 && r.isUp).length;

    this.updateState({
      ...finalResult,
      pullHistory: [...this.state.pullHistory, ...pullRecords],
      giftsReceived: gifts.count,
      hasReceivedInfoBook: infoBook || this.state.hasReceivedInfoBook,
      lastPullResult: pullRecords,
      upSixStarCount: this.state.upSixStarCount + upSixStars
    });

    return pullRecords;
  }

  /**
   * 免费十连（不计入保底和总抽数）
   * @returns {Array} 免费十连结果数组
   */
  pullFreeTen() {
    // 获取当前UP角色（如果是限定池）
    const currentUpChar = (this.poolType === 'limited' || this.poolType === 'limited_character')
      ? this.getCurrentUpCharacter()
      : null;

    const results = simulateTenPull(this.state, this.rules, this.poolType, currentUpChar);
    const pullRecords = [];

    // 处理每一抽的结果
    results.forEach((result, index) => {
      const pullNumber = this.state.totalPulls + index + 1; // 显示的抽数（但不真正计入）

      const pullRecord = {
        pullNumber,
        rarity: result.rarity,
        isUp: result.isUp,
        isLimited: result.isLimited,
        characterName: result.characterName,
        timestamp: Date.now() + index,
        batchIndex: index,
        isTenPull: true,
        isFreePull: true  // 标记为免费
      };

      pullRecords.push(pullRecord);
    });

    // 免费十连：不更新保底计数、不增加总抽数，只增加已使用免费次数
    this.updateState({
      pullHistory: [...this.state.pullHistory, ...pullRecords],
      freeTenPullsReceived: this.state.freeTenPullsReceived + 1,
      lastPullResult: pullRecords
    });

    return pullRecords;
  }

  /**
   * 检查30抽赠送十连
   * @param {number} totalPulls - 总抽数（支付的抽数，不包括赠送）
   * @returns {Object} 赠送信息
   */
  checkFreeTenPulls(totalPulls) {
    // 仅限定池有30抽赠送机制
    if (this.poolType !== 'limited' && this.poolType !== 'limited_character') {
      return {
        count: 0,
        isNewGift: false,
        nextGiftAt: null,
        remainingPulls: 0
      };
    }

    const freeTenPullCount = Math.floor(totalPulls / this.rules.freeTenPullInterval);
    const isNewGift = freeTenPullCount > this.state.freeTenPullsReceived;

    return {
      count: freeTenPullCount,
      isNewGift,
      nextGiftAt: (freeTenPullCount + 1) * this.rules.freeTenPullInterval,
      remainingPulls: (freeTenPullCount + 1) * this.rules.freeTenPullInterval - totalPulls,
      giftType: 'free_ten_pull'
    };
  }

  /**
   * 检查赠送机制
   * @param {number} totalPulls - 总抽数
   * @returns {Object} 赠送信息
   */
  checkGifts(totalPulls) {
    // 限定池：每240抽送限定角色信物
    if (this.poolType === 'limited' || this.poolType === 'limited_character') {
      const giftCount = Math.floor(totalPulls / this.rules.giftInterval);
      const isNewGift = giftCount > this.state.giftsReceived;

      return {
        count: giftCount,
        isNewGift,
        nextGiftAt: (giftCount + 1) * this.rules.giftInterval,
        remainingPulls: (giftCount + 1) * this.rules.giftInterval - totalPulls,
        giftType: 'limited_character'
      };
    }

    // 武器池：100(常驻) -> 180(限定) -> 每80抽交替
    if (this.poolType === 'weapon' || this.poolType === 'limited_weapon') {
      let standardGifts = 0;
      let limitedGifts = 0;
      let nextGiftAt = 0;
      let nextGiftType = '';

      if (totalPulls >= 100) {
        standardGifts++; // 100抽送常驻武库箱

        if (totalPulls >= 180) {
          limitedGifts++; // 180抽送限定武器

          // 超过180后，每80抽交替
          const remaining = totalPulls - 180;
          const cycleGifts = Math.floor(remaining / 80);

          // 奇数次是常驻，偶数次是限定
          standardGifts += Math.ceil(cycleGifts / 2);
          limitedGifts += Math.floor(cycleGifts / 2);

          // 计算下一个赠送
          const nextCycleNumber = cycleGifts + 1;
          nextGiftAt = 180 + nextCycleNumber * 80;
          nextGiftType = (nextCycleNumber % 2 === 1) ? 'standard_weapon' : 'limited_weapon';
        } else {
          nextGiftAt = 180;
          nextGiftType = 'limited_weapon';
        }
      } else {
        nextGiftAt = 100;
        nextGiftType = 'standard_weapon';
      }

      return {
        standardCount: standardGifts,
        limitedCount: limitedGifts,
        isNewGift: standardGifts + limitedGifts > (this.state.giftsReceived || 0),
        nextGiftAt,
        nextGiftType,
        remainingPulls: nextGiftAt - totalPulls
      };
    }

    // 常驻池：300抽送自选6星（仅1次）
    if (this.poolType === 'standard' || this.poolType === 'standard_pool') {
      const hasSelectGift = totalPulls >= this.rules.selectGiftThreshold;

      return {
        count: hasSelectGift ? 1 : 0,
        isNewGift: hasSelectGift && !this.state.hasReceivedSelectGift,
        nextGiftAt: hasSelectGift ? null : this.rules.selectGiftThreshold,
        remainingPulls: hasSelectGift ? 0 : this.rules.selectGiftThreshold - totalPulls,
        giftType: 'select_six_star'
      };
    }

    // 默认返回（不应该到达这里）
    return {
      count: 0,
      isNewGift: false,
      nextGiftAt: 0,
      remainingPulls: 0
    };
  }

  /**
   * 检查情报书
   * @param {Object} state - 当前状态
   * @returns {boolean} 是否领取情报书
   */
  checkInfoBook(state) {
    return checkInfoBookAvailable(state, this.rules);
  }

  /**
   * 重置模拟器
   */
  reset() {
    this.state = createInitialState(this.state.poolType);
    this.notifyListeners();
  }

  /**
   * 导入状态（从保存的数据恢复）
   * @param {Object} savedState - 保存的状态
   */
  importState(savedState) {
    this.state = {
      ...createInitialState(this.state.poolType),
      ...savedState
    };
    this.notifyListeners();
  }

  /**
   * 导出状态（用于保存）
   * @returns {Object} 当前状态
   */
  exportState() {
    return {
      ...this.state,
      // 移除UI状态
      isAnimating: undefined,
      lastPullResult: undefined
    };
  }

  /**
   * 获取统计摘要
   * @returns {Object} 统计信息
   */
  getStatistics() {
    const {
      totalPulls,
      sixStarCount,
      fiveStarCount,
      upSixStarCount,
      pullHistory,
      sixStarPity,
      giftsReceived,
      freeTenPullsReceived,
      hasReceivedInfoBook,
      hasReceivedSelectGift
    } = this.state;

    // 计算出货率
    const sixStarRate = totalPulls > 0
      ? ((sixStarCount / totalPulls) * 100).toFixed(2)
      : '0.00';

    const fiveStarRate = totalPulls > 0
      ? ((fiveStarCount / totalPulls) * 100).toFixed(2)
      : '0.00';

    // 计算不歪率（UP 6星 / 总6星）
    const upRate = sixStarCount > 0
      ? ((upSixStarCount / sixStarCount) * 100).toFixed(2)
      : '0.00';

    // 计算平均出货抽数
    const avgPullsPerSixStar = sixStarCount > 0
      ? (totalPulls / sixStarCount).toFixed(1)
      : '-';

    // 期望抽数
    const expectedPulls = calculateExpectedPulls(sixStarPity, this.rules);

    // 六星历史
    const sixStarHistory = pullHistory
      .filter(p => p.rarity === 6)
      .map((p, index, arr) => {
        const prevSixStar = arr[index - 1];
        const pityWhenPulled = prevSixStar
          ? p.pullNumber - prevSixStar.pullNumber
          : p.pullNumber;

        return {
          ...p,
          pityWhenPulled
        };
      });

    // 获取赠送信息（根据卡池类型）
    const giftInfo = this.checkGifts(totalPulls);
    const freeTenPullInfo = this.checkFreeTenPulls(totalPulls);

    return {
      totalPulls,
      sixStarCount,
      fiveStarCount,
      upSixStarCount,
      sixStarRate,
      fiveStarRate,
      upRate,
      avgPullsPerSixStar,
      currentPity: sixStarPity,
      expectedPulls,

      // 赠送机制统计（根据卡池类型返回不同信息）
      gifts: giftInfo,
      freeTenPulls: freeTenPullInfo,  // 新增：30抽赠送十连信息
      hasReceivedInfoBook,
      hasReceivedSelectGift,

      sixStarHistory,
      poolType: this.poolType
    };
  }

  /**
   * 获取保底进度信息
   * @returns {Object} 保底信息
   */
  getPityInfo() {
    const {
      sixStarPity,
      fiveStarPity,
      isGuaranteedUp,
      guaranteedLimitedPity,
      hasReceivedGuaranteedLimited
    } = this.state;

    const {
      sixStarPity: maxSixStarPity,
      fiveStarPity: maxFiveStarPity,
      guaranteedLimitedPity: maxGuaranteedPity
    } = this.rules;

    return {
      sixStar: {
        current: sixStarPity,
        max: maxSixStarPity,
        percentage: (sixStarPity / maxSixStarPity * 100).toFixed(1),
        remaining: maxSixStarPity - sixStarPity
      },
      fiveStar: {
        current: fiveStarPity,
        max: maxFiveStarPity,
        percentage: (fiveStarPity / maxFiveStarPity * 100).toFixed(1),
        remaining: maxFiveStarPity - fiveStarPity
      },
      guaranteedUp: {
        isActive: isGuaranteedUp,
        current: guaranteedLimitedPity,
        max: maxGuaranteedPity,
        percentage: (guaranteedLimitedPity / maxGuaranteedPity * 100).toFixed(1),
        remaining: maxGuaranteedPity - guaranteedLimitedPity,
        hasReceived: hasReceivedGuaranteedLimited
      }
    };
  }

  /**
   * 获取当前状态快照
   * @returns {Object} 状态快照
   */
  getState() {
    return { ...this.state };
  }
}

/**
 * 创建模拟器实例
 * @param {string} poolType - 卡池类型 ('limited', 'weapon', 'standard')
 * @param {Object} customRules - 自定义规则（可选）
 * @param {string} currentUpCharacter - 当前UP角色（可选）
 * @returns {GachaSimulator} 模拟器实例
 */
export function createSimulator(poolType, customRules = null, currentUpCharacter = null) {
  return new GachaSimulator(poolType, customRules, currentUpCharacter);
}

export default {
  GachaSimulator,
  createSimulator,
  createInitialState
};

