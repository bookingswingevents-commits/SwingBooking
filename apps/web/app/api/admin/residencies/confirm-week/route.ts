import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { isUuid } from '@/lib/uuid';
import { LEGACY_RESIDENCIES_DISABLED } from '@/lib/featureFlags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Variables d'environnement manquantes: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    if (LEGACY_RESIDENCIES_DISABLED) {
      return NextResponse.json(
        { ok: false, error: 'LEGACY_RESIDENCIES_DISABLED' },
        { status: 503 }
      );
    }
    const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_USER' }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'NOT_ADMIN' }, { status: 403 });
    }

    const body = await req.json();
    const week_id = body?.week_id as string | undefined;
    const artist_id = body?.artist_id as string | undefined;
    if (!week_id || week_id === 'undefined') {
      console.warn('[admin/residencies] MISSING_WEEK_ID', { week_id });
      return NextResponse.json({ ok: false, error: 'MISSING_WEEK_ID' }, { status: 400 });
    }
    if (!artist_id || artist_id === 'undefined') {
      console.warn('[admin/residencies] MISSING_ARTIST_ID', { artist_id });
      return NextResponse.json({ ok: false, error: 'MISSING_ARTIST_ID' }, { status: 400 });
    }
    if (!isUuid(week_id)) {
      console.warn('[admin/residencies] INVALID_WEEK_ID', { week_id });
      return NextResponse.json({ ok: false, error: 'INVALID_WEEK_ID' }, { status: 400 });
    }
    if (!isUuid(artist_id)) {
      console.warn('[admin/residencies] INVALID_ARTIST_ID', { artist_id });
      return NextResponse.json({ ok: false, error: 'INVALID_ARTIST_ID' }, { status: 400 });
    }

    const supaSrv = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supaSrv.rpc('confirm_residency_week', {
      p_week_id: week_id,
      p_artist_id: artist_id,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, booking_id: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
