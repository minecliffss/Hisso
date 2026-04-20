import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    
    // Example: Fetch project stats
    const { data: projects, error, count } = await supabaseAdmin
      .from('projects')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      stats: {
        totalProjects: count || 0,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    
    // Example restricted operation: Batch update project names
    const { data, error } = await supabaseAdmin
      .from('projects')
      .update({ name: body.name })
      .eq('id', body.id);

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
