import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_USER' }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'NOT_ADMIN' }, { status: 403 });
    }

    const supaSrv = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const eventFormatId = searchParams.get('event_format_id');
    const q = searchParams.get('q')?.trim();

    let query = supaSrv
      .from('artist_applications')
      .select(
        `
        id, created_at, updated_at, stage_name, email, phone, city, bio, instagram_url, formations_supported, status, admin_notes,
        artist_application_event_formats(event_format_id, event_formats(title))
      `
      )
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (q) {
      query = query.or(`stage_name.ilike.%${q}%,email.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    let rows = (data ?? []) as any[];
    if (eventFormatId) {
      const idNum = Number(eventFormatId);
      rows = rows.filter((r) =>
        Array.isArray(r.artist_application_event_formats) &&
        r.artist_application_event_formats.some((f: any) => Number(f.event_format_id) === idNum)
      );
    }

    return NextResponse.json({ ok: true, items: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
