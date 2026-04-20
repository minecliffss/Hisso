import { supabase } from '../supabase';
import type { Layer, Project } from '@/types';

export const projectService = {
  async saveProject(project: Partial<Project>) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const projectData = {
      ...project,
      user_id: user?.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('projects')
      .upsert(projectData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getProject(id: string) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async listProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, updated_at')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data;
  }
};

export const storageService = {
  async uploadFile(file: File, bucket: string = 'assets') {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicUrl;
  }
};
