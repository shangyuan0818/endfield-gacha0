import { supabase } from '../../supabaseClient';
import { executeSupabaseRead } from '../supabaseRequest';

async function getCurrentUserId() {
  return (await supabase.auth.getUser()).data.user?.id;
}

export async function loadPageContents() {
  const { data, error } = await executeSupabaseRead(
    () => supabase
      .from('page_content')
      .select('*')
      .order('id', { ascending: true }),
    {
      label: 'loadPageContents',
      retries: 1
    }
  );

  if (error) throw error;
  return data || [];
}

export async function createPageContent(pageContentForm) {
  const updatedBy = await getCurrentUserId();
  const { data, error } = await supabase
    .from('page_content')
    .insert({
      id: pageContentForm.id,
      title: pageContentForm.title,
      content: pageContentForm.content,
      is_active: pageContentForm.is_active,
      updated_by: updatedBy
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePageContent(pageContentId, pageContentForm) {
  const updatedBy = await getCurrentUserId();
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from('page_content')
    .update({
      title: pageContentForm.title,
      content: pageContentForm.content,
      is_active: pageContentForm.is_active,
      updated_by: updatedBy,
      updated_at: updatedAt
    })
    .eq('id', pageContentId);

  if (error) throw error;
  return updatedAt;
}

export async function setPageContentActive(pageContentId, isActive) {
  const { error } = await supabase
    .from('page_content')
    .update({ is_active: isActive })
    .eq('id', pageContentId);

  if (error) throw error;
}

export async function deletePageContent(pageContentId) {
  const { error } = await supabase
    .from('page_content')
    .delete()
    .eq('id', pageContentId);

  if (error) throw error;
}
