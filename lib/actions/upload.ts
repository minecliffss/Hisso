'use server';

import { getSupabaseAdmin } from '@/lib/supabase';

export async function uploadImageAction(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');

    const supabaseAdmin = getSupabaseAdmin();
    
    // Generate a unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    // Upload to Supabase using the admin client
    const { data, error } = await supabaseAdmin.storage
      .from('assets')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true
      });

    if (error) throw error;

    // Get the public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('assets')
      .getPublicUrl(filePath);

    return { success: true, url: publicUrl };
  } catch (error: any) {
    console.error('Server Action Upload Error:', error);
    return { success: false, error: error.message };
  }
}
