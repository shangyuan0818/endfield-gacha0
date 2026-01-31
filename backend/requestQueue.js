/**
 * 请求队列管理器（后端版本）
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
    this.concurrentLimit = 1; // 并发限制（默认串行）
    this.activeRequests = 0;
  }

  /**
   * 添加请求到队列
   * @param {Function} requestFn - 返回 Promise 的请求函数
   * @param {Object} options - 选项
   * @returns {Promise} 请求结果
   */
  async enqueue(requestFn, options = {}) {
    const {
      priority = 10,
      maxRetries = this.maxRetries,
      timeout = this.timeout,
      label = 'Request'
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
        addedAt: Date.now(),
        label
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
    // 如果已达到并发限制或队列为空，则不处理
    if (this.activeRequests >= this.concurrentLimit || this.queue.length === 0) {
      return;
    }

    // 标记正在处理
    this.isProcessing = true;

    while (this.queue.length > 0 && this.activeRequests < this.concurrentLimit) {
      const task = this.queue.shift();
      this.activeRequests++;

      // 异步执行任务，不阻塞队列处理
      this.executeTask(task).finally(() => {
        this.activeRequests--;
        // 任务完成后继续处理队列
        this.processQueue();
      });
    }

    // 如果队列为空且没有活动请求，标记为未处理
    if (this.queue.length === 0 && this.activeRequests === 0) {
      this.isProcessing = false;
    }
  }

  /**
   * 执行单个任务（带重试）
   * @param {Object} task - 任务对象
   */
  async executeTask(task) {
    const { requestFn, resolve, reject, maxRetries, timeout, retryCount, label } = task;

    try {
      // 添加超时控制
      const result = await this.withTimeout(requestFn(), timeout);
      console.log(`[RequestQueue] ${label} 成功 (尝试 ${retryCount + 1} 次)`);
      resolve(result);
    } catch (error) {
      // 判断是否需要重试
      if (this.shouldRetry(error, retryCount, maxRetries)) {
        // 计算退避延迟（指数退避）
        const delay = this.calculateBackoffDelay(retryCount);

        console.warn(`[RequestQueue] ${label} 失败，${delay}ms 后重试 (${retryCount + 1}/${maxRetries}):`, error.message);

        // 等待后重试
        await this.sleep(delay);

        // 增加重试计数并重新入队
        task.retryCount = retryCount + 1;
        this.queue.unshift(task); // 插入队列头部，优先重试

        // 减少活动请求计数（因为要重新入队）
        this.activeRequests--;

        // 继续处理队列
        this.processQueue();
      } else {
        // 不再重试，返回错误
        console.error(`[RequestQueue] ${label} 最终失败 (重试 ${retryCount} 次):`, error.message);
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
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNRESET',
      'EPIPE',
      'timeout',
      'network',
      'socket hang up'
    ];

    const errorMessage = (error.message || error.toString()).toLowerCase();
    const isNetworkError = networkErrors.some(keyword =>
      errorMessage.includes(keyword.toLowerCase())
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
          const error = new Error(`Request timeout after ${timeoutMs}ms`);
          error.code = 'ETIMEDOUT';
          reject(error);
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
      activeRequests: this.activeRequests,
      isProcessing: this.isProcessing,
      oldestTaskAge: this.queue.length > 0
        ? Date.now() - this.queue[0].addedAt
        : 0
    };
  }
}

// 创建全局单例
const globalRequestQueue = new RequestQueue();

export {
  RequestQueue,
  globalRequestQueue
};
