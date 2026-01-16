import type { SupabaseClient } from '@supabase/supabase-js';

export async function fetchPublishedPrograms(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('programming_programs')
    .select('id, title, program_type, status')
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchProgram(supabase: SupabaseClient, programId: string) {
  const { data, error } = await supabase
    .from('programming_programs')
    .select('id, title, program_type, status, conditions_json')
    .eq('id', programId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchProgramItems(supabase: SupabaseClient, programId: string) {
  const { data, error } = await supabase
    .from('programming_items')
    .select('id, item_type, start_date, end_date, status, metadata_json')
    .eq('program_id', programId)
    .order('start_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchArtistApplications(supabase: SupabaseClient, artistId: string) {
  const { data, error } = await supabase
    .from('programming_applications')
    .select('id, item_id, status, option_json, programming_items(id, program_id)')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchArtistBookings(supabase: SupabaseClient, artistId: string) {
  const { data, error } = await supabase
    .from('programming_bookings')
    .select('id, item_id, status, programming_items(id, program_id, start_date, end_date, programming_programs(title))')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchProgramApplications(supabase: SupabaseClient, programId: string) {
  const { data, error } = await supabase
    .from('programming_applications')
    .select('id, item_id, artist_id, status, option_json, artists(stage_name), programming_items!inner(program_id)')
    .eq('programming_items.program_id', programId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
