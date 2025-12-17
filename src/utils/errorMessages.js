/**
 * 错误代码到用户友好消息的映射表
 * 提供清晰的错误说明和解决方案
 */

// Supabase 错误代码映射
const SUPABASE_ERROR_MAP = {
  // 认证相关错误
  'invalid_credentials': {
    message: '邮箱或密码错误',
    solution: '请检查您的邮箱和密码是否正确',
  },
  'email_not_confirmed': {
    message: '邮箱尚未验证',
    solution: '请查收验证邮件并点击链接完成验证',
  },
  'user_already_exists': {
    message: '该邮箱已被注册',
    solution: '请尝试登录或使用其他邮箱注册',
  },
  'weak_password': {
    message: '密码强度不足',
    solution: '密码至少需要8位字符，包含字母和数字',
  },
  'invalid_email': {
    message: '邮箱格式不正确',
    solution: '请输入有效的邮箱地址',
  },
  'email_provider_disabled': {
    message: '邮箱域名不支持',
    solution: '该邮箱域名暂不支持注册，请使用其他邮箱',
  },
  'signup_disabled': {
    message: '注册功能暂时关闭',
    solution: '请稍后再试或联系管理员',
  },
  'over_request_rate_limit': {
    message: '操作过于频繁',
    solution: '请稍后再试',
  },
  'email_rate_limit_exceeded': {
    message: '邮件发送次数超限',
    solution: '请稍后再尝试重新发送',
  },

  // 数据库相关错误
  '23505': {  // unique_violation
    message: '数据重复',
    solution: '该记录已存在，请勿重复添加',
  },
  '23503': {  // foreign_key_violation
    message: '关联数据不存在',
    solution: '请先创建关联的数据',
  },
  '23502': {  // not_null_violation
    message: '必填字段缺失',
    solution: '请填写所有必填字段',
  },
  '23514': {  // check_violation
    message: '数据不符合规则',
    solution: '请检查输入的数据是否符合要求',
  },
  '42501': {  // insufficient_privilege
    message: '权限不足',
    solution: '您没有执行此操作的权限',
  },
  'PGRST116': {  // row_level_security
    message: '权限验证失败',
    solution: '此操作需要相应的权限，请联系管理员',
  },

  // 网络相关错误
  'Failed to fetch': {
    message: '网络连接失败',
    solution: '请检查您的网络连接',
  },
  'Network request failed': {
    message: '网络请求失败',
    solution: '请检查您的网络连接并重试',
  },
  'TypeError: NetworkError': {
    message: '网络错误',
    solution: '网络连接中断，请重试',
  },
};

// 通用错误类型映射
const GENERIC_ERROR_MAP = {
  timeout: {
    message: '操作超时',
    solution: '服务器响应时间过长，请稍后重试',
  },
  unknown: {
    message: '操作失败',
    solution: '发生了未知错误，请稍后重试',
  },
};

/**
 * 将技术错误转换为用户友好的错误消息
 * @param {Error|string} error - 错误对象或错误消息
 * @returns {{message: string, solution: string, technical: string}} 友好错误信息
 */
export function getFriendlyErrorMessage(error) {
  // 提取错误消息
  let errorMsg = '';
  let errorCode = '';

  if (typeof error === 'string') {
    errorMsg = error;
  } else if (error?.message) {
    errorMsg = error.message;
    errorCode = error.code || error.status || '';
  }

  // 优先匹配错误代码
  if (errorCode && SUPABASE_ERROR_MAP[errorCode]) {
    return {
      ...SUPABASE_ERROR_MAP[errorCode],
      technical: errorMsg,
    };
  }

  // 匹配错误消息
  for (const [key, value] of Object.entries(SUPABASE_ERROR_MAP)) {
    if (errorMsg.toLowerCase().includes(key.toLowerCase())) {
      return {
        ...value,
        technical: errorMsg,
      };
    }
  }

  // 匹配通用错误
  if (errorMsg.toLowerCase().includes('timeout')) {
    return {
      ...GENERIC_ERROR_MAP.timeout,
      technical: errorMsg,
    };
  }

  // 默认错误
  return {
    ...GENERIC_ERROR_MAP.unknown,
    technical: errorMsg || '未知错误',
  };
}

/**
 * 获取简洁的用户友好错误消息（单行）
 * @param {Error|string} error - 错误对象或错误消息
 * @returns {string} 用户友好的错误消息
 */
export function getSimpleFriendlyError(error) {
  const friendly = getFriendlyErrorMessage(error);
  return `${friendly.message}。${friendly.solution}`;
}

/**
 * 显示友好的错误提示（配合 showToast 使用）
 * @param {Function} showToast - Toast 显示函数
 * @param {Error|string} error - 错误对象或错误消息
 * @param {string} action - 操作名称（如"登录"、"保存"）
 * @param {boolean} showTechnical - 是否在控制台显示技术错误（开发环境）
 */
export function showFriendlyError(showToast, error, action = '操作', showTechnical = false) {
  const friendlyError = getFriendlyErrorMessage(error);

  // 显示用户友好的错误消息
  showToast(`${action}失败：${friendlyError.message}。${friendlyError.solution}`, 'error');

  // 开发环境下在控制台显示技术错误
  if (showTechnical && import.meta.env.DEV) {
    console.error(`[${action}失败] 技术错误:`, friendlyError.technical);
  }
}
