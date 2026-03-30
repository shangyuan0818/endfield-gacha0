/**
 * 头像资源兼容层
 *
 * 旧版这里负责 Supabase Storage avatars bucket。
 * 当前链路已改为：
 * 1. 浏览器侧优先写同源代理 URL
 * 2. 本地脚本把头像下载到 public/avatars
 * 3. 部署后统一切到站点本地静态路径
 */

import {
  buildLocalAvatarPath,
  buildWikiAssetProxyPath,
  inferAvatarFileExtension
} from './avatarAssetPaths.js';

export function getProxyAvatarUrl(itemId, type = 'character') {
  return buildWikiAssetProxyPath(type, itemId);
}

export function getLocalAvatarUrl(itemId, type = 'character', extension = 'webp') {
  return buildLocalAvatarPath(type, itemId, extension);
}

export function getAvatarUrl(itemId, type = 'character', options = {}) {
  const mode = options.mode === 'local' ? 'local' : 'proxy';
  if (mode === 'local') {
    return getLocalAvatarUrl(itemId, type, options.extension);
  }

  return getProxyAvatarUrl(itemId, type);
}

export {
  buildLocalAvatarPath,
  buildWikiAssetProxyPath,
  inferAvatarFileExtension
};

export default {
  getAvatarUrl,
  getLocalAvatarUrl,
  getProxyAvatarUrl,
  buildLocalAvatarPath,
  buildWikiAssetProxyPath,
  inferAvatarFileExtension
};
