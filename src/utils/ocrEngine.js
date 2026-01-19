/**
 * OCR 识别引擎客户端
 *
 * 前端调用 Python OCR 服务的封装
 */

import {
  ImportStatus,
  createImportError,
  ImportErrorType
} from './importTypes';

/**
 * OCR 服务配置
 */
const OCR_SERVICE_CONFIG = {
  // OCR 服务地址
  baseUrl: import.meta.env.VITE_OCR_SERVICE_URL || 'http://localhost:5000',

  // 请求超时时间（毫秒）
  timeout: 30000,

  // 最大图片大小（字节）- 5MB
  maxImageSize: 5 * 1024 * 1024,

  // 支持的图片格式
  supportedFormats: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
};

/**
 * OCR 引擎类
 */
export class OcrEngine {
  constructor(config = {}) {
    this.config = { ...OCR_SERVICE_CONFIG, ...config };
    this.abortController = null;
  }

  /**
   * 检查 OCR 服务是否可用
   * @returns {Promise<{available: boolean, message?: string}>}
   */
  async checkServiceAvailability() {
    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        return { available: true };
      } else {
        return {
          available: false,
          message: 'OCR 服务响应异常'
        };
      }
    } catch (error) {
      return {
        available: false,
        message: `OCR 服务不可用: ${error.message}`
      };
    }
  }

  /**
   * 验证图片文件
   * @param {File} file - 图片文件
   * @returns {{valid: boolean, error?: string}}
   */
  validateImage(file) {
    // 检查文件类型
    if (!this.config.supportedFormats.includes(file.type)) {
      return {
        valid: false,
        error: `不支持的图片格式: ${file.type}。支持格式: ${this.config.supportedFormats.join(', ')}`
      };
    }

    // 检查文件大小
    if (file.size > this.config.maxImageSize) {
      const maxSizeMB = (this.config.maxImageSize / 1024 / 1024).toFixed(1);
      return {
        valid: false,
        error: `图片过大: ${(file.size / 1024 / 1024).toFixed(1)}MB，最大支持 ${maxSizeMB}MB`
      };
    }

    return { valid: true };
  }

  /**
   * 将图片文件转换为 Base64
   * @param {File} file - 图片文件
   * @returns {Promise<string>} Base64 编码的图片（不含前缀）
   */
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // 移除 data:image/xxx;base64, 前缀
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * 识别单张图片
   * @param {File} imageFile - 图片文件
   * @param {Object} options - 选项
   * @param {boolean} options.preprocess - 是否预处理
   * @param {Function} options.onProgress - 进度回调
   * @returns {Promise<Object>} 识别结果
   */
  async recognizeImage(imageFile, options = {}) {
    const { preprocess = true, onProgress } = options;

    try {
      // 验证图片
      const validation = this.validateImage(imageFile);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 报告进度
      if (onProgress) {
        onProgress({
          status: ImportStatus.FETCHING,
          percentage: 10,
          message: '正在读取图片...'
        });
      }

      // 转换为 Base64
      const base64Image = await this.fileToBase64(imageFile);

      if (onProgress) {
        onProgress({
          status: ImportStatus.FETCHING,
          percentage: 30,
          message: '正在上传图片...'
        });
      }

      // 创建取消控制器
      this.abortController = new AbortController();

      // 调用 OCR 服务
      const response = await fetch(`${this.config.baseUrl}/ocr/recognize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: base64Image,
          preprocess
        }),
        signal: this.abortController.signal
      });

      if (onProgress) {
        onProgress({
          status: ImportStatus.PARSING,
          percentage: 70,
          message: '正在识别文字...'
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'OCR 识别失败');
      }

      if (onProgress) {
        onProgress({
          status: ImportStatus.SUCCESS,
          percentage: 100,
          message: `识别完成！共识别 ${result.records.length} 条记录`
        });
      }

      return result;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw createImportError(
          ImportErrorType.CANCELLED,
          '识别已取消'
        );
      }

      throw createImportError(
        ImportErrorType.OCR_ERROR,
        `OCR 识别失败: ${error.message}`,
        error
      );
    } finally {
      this.abortController = null;
    }
  }

  /**
   * 批量识别多张图片
   * @param {File[]} imageFiles - 图片文件数组
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 识别结果
   */
  async recognizeBatch(imageFiles, options = {}) {
    const { preprocess = true, onProgress } = options;

    try {
      // 验证所有图片
      for (let i = 0; i < imageFiles.length; i++) {
        const validation = this.validateImage(imageFiles[i]);
        if (!validation.valid) {
          throw new Error(`图片 ${i + 1} ${validation.error}`);
        }
      }

      if (onProgress) {
        onProgress({
          status: ImportStatus.FETCHING,
          percentage: 10,
          message: '正在处理图片...'
        });
      }

      // 转换所有图片为 Base64
      const base64Images = await Promise.all(
        imageFiles.map(file => this.fileToBase64(file))
      );

      if (onProgress) {
        onProgress({
          status: ImportStatus.FETCHING,
          percentage: 30,
          message: `正在上传 ${imageFiles.length} 张图片...`
        });
      }

      // 创建取消控制器
      this.abortController = new AbortController();

      // 调用批量 OCR 服务
      const response = await fetch(`${this.config.baseUrl}/ocr/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          images: base64Images,
          preprocess
        }),
        signal: this.abortController.signal
      });

      if (onProgress) {
        onProgress({
          status: ImportStatus.PARSING,
          percentage: 70,
          message: '正在识别文字...'
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '批量 OCR 识别失败');
      }

      if (onProgress) {
        onProgress({
          status: ImportStatus.SUCCESS,
          percentage: 100,
          message: `识别完成！共识别 ${result.total_records} 条记录`
        });
      }

      return result;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw createImportError(
          ImportErrorType.CANCELLED,
          '识别已取消'
        );
      }

      throw createImportError(
        ImportErrorType.OCR_ERROR,
        `批量 OCR 识别失败: ${error.message}`,
        error
      );
    } finally {
      this.abortController = null;
    }
  }

  /**
   * 取消当前识别任务
   */
  cancel() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}

/**
 * 创建默认 OCR 引擎实例
 */
export function createOcrEngine(config) {
  return new OcrEngine(config);
}

export default OcrEngine;
