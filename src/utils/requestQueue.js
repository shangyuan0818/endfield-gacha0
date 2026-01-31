/**
 * 请求队列管理器
 *
 * 解决并发请求冲突和网络不稳定问题
 * - 请求队列：确保同一时间只有一个请求在执行
 * - 指数退避重试：网络错误时自动重试（最多3次）
 * - 超时处理：防止请求无限等待
 *
 * @version 1.0.0
 * @date 2026-02-01
 */

/**
 * 请求队列类
 */
class RequestQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.maxRetries = 3; // 最大重试次数
    this.baseDelay = 1000; // 基础延迟（毫秒）
    this.maxDelay = 10000; // 最大延迟（毫秒）
    this.timeout = 30000; // 请求超时时间（30秒）
    this.listeners = []; // 🆕 事件监听器
  }

  /**
   * 🆕 添加事件监听器
   * @param {Function} listener - 监听回调函数
   */
  addListener(listener) {
    this.listeners.push(listener);
  }

  /**
   * 🆕 移除事件监听器
   * @param {Function} listener - 监听回调函数
   */
  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * 🆕 触发事件
   * @param {string} event - 事件类型
   * @param {Object} data - 事件数据
   */
  emit(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('[RequestQueue] Listener error:', error);
      }
    });
  }

  /**
   * 添加请求到队列
   * @param {Function} requestFn - 返回 Promise 的请求函数
   * @param {Object} options - 选项
   * @param {number} options.priority - 优先级（数字越小优先级越高）
   * @param {number} options.maxRetries - 最大重试次数（覆盖默认值）
   * @param {number} options.timeout - 超时时间（覆盖默认值）
   * @returns {Promise} 请求结果
   */
  async enqueue(requestFn, options = {}) {
    const {
      priority = 10,
      maxRetries = this.maxRetries,
      timeout = this.timeout
    } = options;

    return new Promise((resolve, reject) => {
      const task = {
        requestFn,
        resolve,
        reject,
        priority,
        maxRetries,
        timeout,
        retryCount: 0,
        addedAt: Date.now()
      };

      // 按优先级插入队列
      const insertIndex = this.queue.findIndex(t => t.priority > priority);
      if (insertIndex === -1) {
        this.queue.push(task);
      } else {
        this.queue.splice(insertIndex, 0, task);
      }

      // 开始处理队列
      this.processQueue();
    });
  }

  /**
   * 处理队列
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      await this.executeTask(task);
    }

    this.isProcessing = false;
  }

  /**
   * 执行单个任务（带重试）
   * @param {Object} task - 任务对象
   */
  async executeTask(task) {
    const { requestFn, resolve, reject, maxRetries, timeout, retryCount } = task;

    try {
      // 🆕 触发请求开始事件
      this.emit('request:start', {
        label: task.label,
        retryCount,
        maxRetries
      });

      // 添加超时控制
      const result = await this.withTimeout(requestFn(), timeout);

      // 🆕 触发请求成功事件
      this.emit('request:success', {
        label: task.label,
        retryCount
      });

      resolve(result);
    } catch (error) {
      // 判断是否需要重试
      if (this.shouldRetry(error, retryCount, maxRetries)) {
        // 计算退避延迟（指数退避）
        const delay = this.calculateBackoffDelay(retryCount);

        console.warn(`[RequestQueue] 请求失败，${delay}ms 后重试 (${retryCount + 1}/${maxRetries}):`, error.message);

        // 🆕 触发重试事件
        this.emit('request:retry', {
          label: task.label,
          currentRetry: retryCount + 1,
          maxRetries,
          nextRetryIn: delay,
          reason: error.message
        });

        // 等待后重试
        await this.sleep(delay);

        // 增加重试计数并重新入队
        task.retryCount = retryCount + 1;
        this.queue.unshift(task); // 插入队列头部，优先重试
      } else {
        // 不再重试，返回错误
        console.error(`[RequestQueue] 请求最终失败 (重试 ${retryCount} 次):`, error);

        // 🆕 触发请求失败事件
        this.emit('request:error', {
          label: task.label,
          retryCount,
          error: error.message
        });

        reject(error);
      }
    }
  }

  /**
   * 判断是否应该重试
   * @param {Error} error - 错误对象
   * @param {number} retryCount - 当前重试次数
   * @param {number} maxRetries - 最大重试次数
   * @returns {boolean}
   */
  shouldRetry(error, retryCount, maxRetries) {
    // 已达到最大重试次数
    if (retryCount >= maxRetries) {
      return false;
    }

    // 网络错误应该重试
    const networkErrors = [
      'NetworkError',
      'Failed to fetch',
      'fetch failed',
      'Network request failed',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'timeout'
    ];

    const errorMessage = error.message || error.toString();
    const isNetworkError = networkErrors.some(keyword =>
      errorMessage.toLowerCase().includes(keyword.toLowerCase())
    );

    if (isNetworkError) {
      return true;
    }

    // 5xx 服务器错误应该重试
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    // 429 Too Many Requests 应该重试
    if (error.status === 429) {
      return true;
    }

    // 其他错误不重试（如 4xx 客户端错误）
    return false;
  }

  /**
   * 计算指数退避延迟
   * @param {number} retryCount - 重试次数
   * @returns {number} 延迟时间（毫秒）
   */
  calculateBackoffDelay(retryCount) {
    // 指数退避：baseDelay * 2^retryCount + 随机抖动
    const exponentialDelay = this.baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 1000; // 0-1000ms 随机抖动
    const delay = Math.min(exponentialDelay + jitter, this.maxDelay);
    return delay;
  }

  /**
   * 为 Promise 添加超时控制
   * @param {Promise} promise - 原始 Promise
   * @param {number} timeoutMs - 超时时间（毫秒）
   * @returns {Promise}
   */
  withTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟时间（毫秒）
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清空队列
   */
  clear() {
    this.queue.forEach(task => {
      task.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }

  /**
   * 获取队列状态
   * @returns {Object}
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      oldestTaskAge: this.queue.length > 0
        ? Date.now() - this.queue[0].addedAt
        : 0
    };
  }
}

// 创建全局单例
const globalRequestQueue = new RequestQueue();

/**
 * 将 fetch 请求加入队列
 * @param {string} url - 请求 URL
 * @param {Object} options - fetch 选项
 * @param {Object} queueOptions - 队列选项
 * @returns {Promise<Response>}
 */
export async function queuedFetch(url, options = {}, queueOptions = {}) {
  return globalRequestQueue.enqueue(
    () => fetch(url, options),
    queueOptions
  );
}

/**
 * 将任意异步函数加入队列
 * @param {Function} fn - 异步函数
 * @param {Object} queueOptions - 队列选项
 * @returns {Promise}
 */
export async function queuedRequest(fn, queueOptions = {}) {
  return globalRequestQueue.enqueue(fn, queueOptions);
}

/**
 * 获取全局队列实例（用于高级操作）
 * @returns {RequestQueue}
 */
export function getGlobalQueue() {
  return globalRequestQueue;
}

export default {
  queuedFetch,
  queuedRequest,
  getGlobalQueue,
  RequestQueue
};
