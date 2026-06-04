import { fetchJsonWithTimeout } from './supabaseRequest.js';

export async function loadPublicSiteStatus() {
  const { response, data } = await fetchJsonWithTimeout('/api/site-status', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  }, {
    label: 'site-status',
    timeoutMs: 30000,
    retries: 1,
  });

  if (!response.ok || data?.success !== true) {
    throw new Error(data?.error || '服务状态读取失败');
  }

  return {
    ...(data.data || {}),
    meta: data.meta || {},
  };
}

export default {
  loadPublicSiteStatus,
};
