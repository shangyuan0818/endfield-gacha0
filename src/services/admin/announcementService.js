import { supabase } from '../../supabaseClient';
import { executeSupabaseRead } from '../supabaseRequest';

export async function loadAnnouncements() {
  const { data, error } = await executeSupabaseRead(
    () => supabase
      .from('announcements')
      .select('*')
      .is('source_id', null)
      .order('priority', { ascending: false }),
    {
      label: 'loadAnnouncements',
      retries: 1
    }
  );

  if (error) throw error;
  return data || [];
}

export async function createAnnouncement(announcementForm) {
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      title: announcementForm.title,
      title_en: announcementForm.title_en || null,
      content: announcementForm.content,
      content_en: announcementForm.content_en || null,
      version: announcementForm.version,
      announcement_type: announcementForm.announcement_type || 'update',
      severity: announcementForm.severity || 'info',
      is_active: announcementForm.is_active,
      priority: announcementForm.priority
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAnnouncement(announcementId, announcementForm) {
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from('announcements')
    .update({
      title: announcementForm.title,
      title_en: announcementForm.title_en || null,
      content: announcementForm.content,
      content_en: announcementForm.content_en || null,
      version: announcementForm.version,
      announcement_type: announcementForm.announcement_type || 'update',
      severity: announcementForm.severity || 'info',
      is_active: announcementForm.is_active,
      priority: announcementForm.priority,
      updated_at: updatedAt
    })
    .eq('id', announcementId);

  if (error) throw error;
  return updatedAt;
}

export async function setAnnouncementActive(announcementId, isActive) {
  const { error } = await supabase
    .from('announcements')
    .update({ is_active: isActive })
    .eq('id', announcementId);

  if (error) throw error;
}

export async function deleteAnnouncement(announcementId) {
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', announcementId);

  if (error) throw error;
}
