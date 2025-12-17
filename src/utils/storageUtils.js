/**
 * localStorage 工具函数
 * 用于管理用户偏好设置和状态记忆
 */

// 存储键前缀
const STORAGE_PREFIX = 'gacha_';

// 存储键枚举
export const STORAGE_KEYS = {
  // 首页折叠状态
  HOME_ANNOUNCEMENT_COLLAPSED: 'home_announcement_collapsed',
  HOME_GUIDE_COLLAPSED: 'home_guide_collapsed',
  HOME_POOL_MECHANICS_COLLAPSED: 'home_pool_mechanics_collapsed',
  HOME_ROADMAP_COLLAPSED: 'home_roadmap_collapsed',
  // 公告最后查看时间
  ANNOUNCEMENT_LAST_VIEWED: 'announcement_last_viewed',
  // 管理面板最后查看时间
  ADMIN_LAST_VIEWED: 'admin_last_viewed',
  // 工单最后查看时间
  TICKETS_LAST_VIEWED: 'tickets_last_viewed',
};

/**
 * 获取存储的值
 * @param {string} key - 存储键（不含前缀）
 * @param {*} defaultValue - 默认值
 * @returns {*} 存储的值或默认值
 */
export const getStorageItem = (key, defaultValue = null) => {
  try {
    const fullKey = STORAGE_PREFIX + key;
    const item = localStorage.getItem(fullKey);
    if (item === null) return defaultValue;
    return JSON.parse(item);
  } catch (error) {
    return defaultValue;
  }
};

/**
 * 设置存储的值
 * @param {string} key - 存储键（不含前缀）
 * @param {*} value - 要存储的值
 */
export const setStorageItem = (key, value) => {
  try {
    const fullKey = STORAGE_PREFIX + key;
    localStorage.setItem(fullKey, JSON.stringify(value));
  } catch (error) {
    // 静默失败
  }
};

/**
 * 删除存储的值
 * @param {string} key - 存储键（不含前缀）
 */
export const removeStorageItem = (key) => {
  try {
    const fullKey = STORAGE_PREFIX + key;
    localStorage.removeItem(fullKey);
  } catch (error) {
    // 静默失败
  }
};

/**
 * 检查是否有新内容（基于时间戳比较）
 * @param {string} lastViewedKey - 上次查看时间的存储键
 * @param {string|Date} contentUpdatedAt - 内容更新时间
 * @returns {boolean} 是否有新内容
 */
export const hasNewContent = (lastViewedKey, contentUpdatedAt) => {
  if (!contentUpdatedAt) return false;

  const lastViewed = getStorageItem(lastViewedKey, 0);
  const updatedTime = new Date(contentUpdatedAt).getTime();

  return updatedTime > lastViewed;
};

/**
 * 标记内容为已查看
 * @param {string} lastViewedKey - 上次查看时间的存储键
 */
export const markAsViewed = (lastViewedKey) => {
  setStorageItem(lastViewedKey, Date.now());
};

/**
 * 获取首页折叠状态
 * @returns {{ announcement: boolean, guide: boolean, poolMechanics: boolean, roadmap: boolean }}
 */
export const getHomeCollapseState = () => {
  return {
    announcement: getStorageItem(STORAGE_KEYS.HOME_ANNOUNCEMENT_COLLAPSED, false),
    guide: getStorageItem(STORAGE_KEYS.HOME_GUIDE_COLLAPSED, false),
    poolMechanics: getStorageItem(STORAGE_KEYS.HOME_POOL_MECHANICS_COLLAPSED, false),
    roadmap: getStorageItem(STORAGE_KEYS.HOME_ROADMAP_COLLAPSED, false),
  };
};

/**
 * 保存首页折叠状态
 * @param {'announcement'|'guide'|'poolMechanics'|'roadmap'} section - 区域名称
 * @param {boolean} collapsed - 是否折叠
 */
export const setHomeCollapseState = (section, collapsed) => {
  const keyMap = {
    announcement: STORAGE_KEYS.HOME_ANNOUNCEMENT_COLLAPSED,
    guide: STORAGE_KEYS.HOME_GUIDE_COLLAPSED,
    poolMechanics: STORAGE_KEYS.HOME_POOL_MECHANICS_COLLAPSED,
    roadmap: STORAGE_KEYS.HOME_ROADMAP_COLLAPSED,
  };
  if (keyMap[section]) {
    setStorageItem(keyMap[section], collapsed);
  }
};
