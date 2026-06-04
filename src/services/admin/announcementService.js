import { getSupabaseAccessToken } from '../authFetchService.js';
import { fetchJsonWithTimeout } from '../supabaseRequest.js';

const ADMIN_ANNOUNCEMENTS_TIMEOUT_MS = 45000;
const ADMIN_ANNOUNCEMENTS_ENDPOINT = '/api/admin-announcements';

async function buildAdminAnnouncementHeaders(extraHeaders = {}) {
  const accessToken = await getSupabaseAccessToken({
    syncSiteSession: false,
    useSiteSessionCache: true,
    allowSiteSessionToken: false,
  }).catch(() => null);

  const headers = {
    Accept: 'application/json',
    ...extraHeaders,
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

function throwAdminAnnouncementError(data, response, fallbackMessage, fallbackCode) {
  const error = new Error(data?.error || `${fallbackMessage} (${response.status})`);
  error.code = data?.code || fallbackCode;
  error.status = response.status;
  throw error;
}

async function requestAdminAnnouncements({
  method = 'GET',
  body = null,
  label = 'admin-announcements',
  retries = method === 'GET' ? 1 : 0,
} = {}) {
  const headers = await buildAdminAnnouncementHeaders(
    body ? { 'Content-Type': 'application/json' } : {}
  );
  const { response, data } = await fetchJsonWithTimeout(ADMIN_ANNOUNCEMENTS_ENDPOINT, {
    method,
    credentials: 'same-origin',
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  }, {
    label,
    timeoutMs: ADMIN_ANNOUNCEMENTS_TIMEOUT_MS,
    retries,
  });

  if (!response.ok || data?.success !== true) {
    throwAdminAnnouncementError(data, response, '公告管理操作失败', 'admin_announcements_request_failed');
  }

  return data;
}

export async function loadAnnouncements() {
  const result = await requestAdminAnnouncements({
    label: 'admin-announcements-load',
  });
  return Array.isArray(result.announcements) ? result.announcements : [];
}

export async function createAnnouncement(announcementForm) {
  const result = await requestAdminAnnouncements({
    method: 'POST',
    body: announcementForm,
    label: 'admin-announcement-create',
  });
  return result.announcement || null;
}

export async function updateAnnouncement(announcementId, announcementForm) {
  const result = await requestAdminAnnouncements({
    method: 'PATCH',
    body: {
      id: announcementId,
      ...announcementForm,
    },
    label: 'admin-announcement-update',
  });
  return result.updated_at || result.announcement?.updated_at || new Date().toISOString();
}

export async function setAnnouncementActive(announcementId, isActive) {
  await requestAdminAnnouncements({
    method: 'PATCH',
    body: {
      action: 'setActive',
      id: announcementId,
      isActive,
    },
    label: 'admin-announcement-toggle',
  });
}

export async function deleteAnnouncement(announcementId) {
  await requestAdminAnnouncements({
    method: 'DELETE',
    body: {
      id: announcementId,
    },
    label: 'admin-announcement-delete',
  });
}

export default {
  createAnnouncement,
  deleteAnnouncement,
  loadAnnouncements,
  setAnnouncementActive,
  updateAnnouncement,
};
