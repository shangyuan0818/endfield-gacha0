/**
 * 头像存储工具
 * 将远程头像图片下载并保存到 Supabase Storage
 * 避免占用第三方服务器资源
 */

import { supabase } from '../supabaseClient';

// Storage bucket 名称
const BUCKET_NAME = 'avatars';

// 远程图片 URL 模板（warfarin.wiki 静态资源）
const REMOTE_IMAGE_URLS = {
  character: (charId) => `https://static.warfarin.wiki/v3/charicon/icon_${charId}.webp`,
  weapon: (iconId) => `https://static.warfarin.wiki/v3/itemicon/${iconId}.webp`,
};

function getProxyImageUrl(remoteUrl, type, itemId) {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return remoteUrl;
  }

  const proxyUrl = new URL('/api/wiki-asset-proxy', window.location.origin);
  proxyUrl.searchParams.set('type', type);
  proxyUrl.searchParams.set('id', itemId);
  return proxyUrl.toString();
}

/**
 * 确保 Storage bucket 存在
 * @returns {Promise<boolean>} 是否成功
 */
export async function ensureBucketExists() {
  if (!supabase) return false;

  try {
    // 尝试直接访问 bucket（listBuckets 需要管理员权限，普通用户无法使用）
    // 改为尝试列出 bucket 中的文件来验证是否可访问
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', { limit: 1 });

    if (error) {
      // 如果错误信息包含 "not found" 或 "does not exist"，说明 bucket 不存在
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('not found') || errorMsg.includes('does not exist') || errorMsg.includes('bucket not found')) {
        console.warn(`[AvatarStorage] Bucket "${BUCKET_NAME}" 不存在，请在 Supabase 控制台手动创建：`);
        console.warn('  1. 进入 Supabase Dashboard -> Storage');
        console.warn('  2. 点击 "New bucket"');
        console.warn(`  3. 名称填写 "${BUCKET_NAME}"，勾选 "Public bucket"`);
        return false;
      }

      // 其他错误（如权限问题）
      console.error('[AvatarStorage] 访问 bucket 失败:', error.message);
      console.warn('可能的原因：');
      console.warn('  1. Bucket 的 RLS 策略未正确配置');
      console.warn('  2. 需要在 Supabase Dashboard -> Storage -> Policies 添加策略');
      console.warn('  3. 或将 bucket 设置为 Public');
      return false;
    }

    console.log(`[AvatarStorage] Bucket "${BUCKET_NAME}" 已就绪`);
    return true;
  } catch (error) {
    console.error('[AvatarStorage] 检查 bucket 失败:', error);
    return false;
  }
}

/**
 * 从远程 URL 下载图片并上传到 Supabase Storage
 * @param {string} remoteUrl - 远程图片 URL
 * @param {string} storagePath - Storage 中的路径（如 characters/chr_001.png）
 * @returns {Promise<string|null>} 成功返回公开 URL，失败返回 null
 */
export async function uploadImageFromUrl(remoteUrl, storagePath) {
  if (!supabase) return null;

  try {
    // 1. 下载远程图片
    const response = await fetch(remoteUrl);
    if (!response.ok) {
      console.warn(`[AvatarStorage] 下载失败: ${remoteUrl} (${response.status})`);
      return null;
    }

    const blob = await response.blob();

    // 检查是否为有效图片
    if (!blob.type.startsWith('image/')) {
      console.warn(`[AvatarStorage] 非图片类型: ${blob.type}`);
      return null;
    }

    // 2. 上传到 Supabase Storage
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, blob, {
        contentType: blob.type,
        upsert: true, // 如果已存在则覆盖
      });

    if (error) {
      console.warn(`[AvatarStorage] 上传失败: ${storagePath}`, error.message);
      return null;
    }

    // 3. 获取公开 URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    return publicUrlData?.publicUrl || null;
  } catch (error) {
    console.warn(`[AvatarStorage] 处理失败: ${remoteUrl}`, error.message);
    return null;
  }
}

/**
 * 同步单个角色/武器的头像到 Storage
 * @param {Object} item - 角色或武器对象
 * @param {string} item.id - ID
 * @param {string} item.type - 类型（'character' | 'weapon'）
 * @returns {Promise<string|null>} 成功返回新的 avatar_url，失败返回 null
 */
export async function syncItemAvatar(item) {
  if (!supabase || !item.id) return null;

  const type = item.type || 'character';
  const remoteId = type === 'weapon' ? (item._iconId || item.id) : item.id;
  const remoteUrl = type === 'weapon'
    ? REMOTE_IMAGE_URLS.weapon(remoteId)
    : REMOTE_IMAGE_URLS.character(remoteId);
  const fetchUrl = getProxyImageUrl(remoteUrl, type, remoteId);

  const storagePath = `${type}s/${item.id}.webp`;

  return await uploadImageFromUrl(fetchUrl, storagePath);
}

/**
 * 批量同步头像到 Storage
 * @param {Array} items - 角色/武器数组
 * @param {Function} onProgress - 进度回调 (current, total, name)
 * @param {Object} options - 选项
 * @param {boolean} options.assumeBucketReady - 调用方已确认 bucket 可用时跳过重复检查
 * @returns {Promise<Object>} { success: number, failed: number, results: Map }
 */
export async function batchSyncAvatars(items, onProgress = null, options = {}) {
  if (!supabase) {
    return { success: 0, failed: items.length, results: new Map() };
  }

  // 检查 bucket
  const bucketReady = options.assumeBucketReady ? true : await ensureBucketExists();
  if (!bucketReady) {
    console.error('[AvatarStorage] Bucket 未就绪，请先在 Supabase 控制台创建');
    return { success: 0, failed: items.length, results: new Map() };
  }

  let success = 0;
  let failed = 0;
  const results = new Map(); // id -> new avatar_url

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (onProgress) {
      onProgress(i + 1, items.length, item.name || item.id);
    }

    const newUrl = await syncItemAvatar(item);

    if (newUrl) {
      results.set(item.id, newUrl);
      success++;
    } else {
      failed++;
    }

    // 避免请求过快
    if (i < items.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`[AvatarStorage] 同步完成: 成功 ${success}, 失败 ${failed}`);
  return { success, failed, results };
}

/**
 * 检查头像是否已存在于 Storage
 * @param {string} itemId - 角色/武器 ID
 * @param {string} type - 类型（'character' | 'weapon'）
 * @returns {Promise<string|null>} 存在返回公开 URL，不存在返回 null
 */
export async function getStoredAvatarUrl(itemId, type = 'character') {
  if (!supabase) return null;

  const storagePath = `${type}s/${itemId}.webp`;

  try {
    // 检查文件是否存在
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(type + 's', {
        search: `${itemId}.webp`,
      });

    if (error || !data || data.length === 0) {
      return null;
    }

    // 返回公开 URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    return publicUrlData?.publicUrl || null;
  } catch {
    return null;
  }
}

/**
 * 获取 Storage 中的头像 URL（如果存在），否则返回远程 URL
 * @param {string} itemId - 角色/武器 ID
 * @param {string} type - 类型（'character' | 'weapon'）
 * @returns {string} 头像 URL
 */
export function getAvatarUrl(itemId, type = 'character') {
  return type === 'weapon'
    ? REMOTE_IMAGE_URLS.weapon(itemId)
    : REMOTE_IMAGE_URLS.character(itemId);
}

export default {
  ensureBucketExists,
  uploadImageFromUrl,
  syncItemAvatar,
  batchSyncAvatars,
  getStoredAvatarUrl,
  getAvatarUrl,
  BUCKET_NAME,
};
