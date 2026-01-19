import type { SupabaseClient } from '@supabase/supabase-js';
import { ITEM_STATUS, PROGRAM_STATUS } from './types';
import { normalizeProgrammingStatus } from './status';

export async function fetchPublishedPrograms(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('programming_programs')
    .select('id, title, program_type, status')
    .eq('status', PROGRAM_STATUS.PUBLISHED)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

type OpenProgramSummary = {
  id: string;
  title: string | null;
  program_type?: string | null;
  status?: string | null;
  client_name?: string | null;
  open_count: number;
  start_date?: string | null;
  end_date?: string | null;
};

export async function fetchOpenProgramsForArtist(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('programming_items')
    .select('program_id, start_date, end_date, status, programming_programs(id, title, program_type, status, clients(name))')
    .eq('status', ITEM_STATUS.OPEN);
  if (error) throw error;

  const byProgram = new Map<string, OpenProgramSummary>();
  (data ?? []).forEach((item) => {
    const program = Array.isArray(item.programming_programs)
      ? item.programming_programs[0]
      : item.programming_programs;
    if (!program?.id) return;

    const normalizedStatus = program.status ? normalizeProgrammingStatus(program.status) : 'ACTIVE';
    if (program.status && normalizedStatus !== 'ACTIVE') return;

    const clientName = Array.isArray(program.clients)
      ? program.clients[0]?.name
      : (program.clients as any)?.name;

    const existing = byProgram.get(program.id);
    const start = item.start_date ?? null;
    const end = item.end_date ?? item.start_date ?? null;
    if (!existing) {
      byProgram.set(program.id, {
        id: program.id,
        title: program.title ?? null,
        program_type: program.program_type ?? null,
        status: program.status ?? null,
        client_name: clientName ?? null,
        open_count: 1,
        start_date: start,
        end_date: end,
      });
      return;
    }

    existing.open_count += 1;
    if (start && (!existing.start_date || start < existing.start_date)) {
      existing.start_date = start;
    }
    if (end && (!existing.end_date || end > existing.end_date)) {
      existing.end_date = end;
    }
  });

  return Array.from(byProgram.values());
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
    .select('id, item_type, start_date, end_date, status, meta_json')
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
