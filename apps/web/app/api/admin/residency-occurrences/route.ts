import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { isUuid } from '@/lib/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Variables d'environnement manquantes: ${name}`);
  return v;
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_USER' }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'NOT_ADMIN' }, { status: 403 });
    }

    const body = await req.json();
    const id = body?.id as string | undefined;
    if (!id) {
      return NextResponse.json({ ok: false, error: 'MISSING_ID' }, { status: 400 });
    }
    if (!isUuid(id)) {
      return NextResponse.json({ ok: false, error: 'INVALID_ID' }, { status: 400 });
    }

    const supaSrv = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supaSrv.from('residency_occurrences').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_USER' }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'NOT_ADMIN' }, { status: 403 });
    }

    const body = await req.json();
    const residency_id = body?.residency_id as string | undefined;
    const date = body?.date as string | undefined;
    const dates = Array.isArray(body?.dates) ? (body.dates as string[]) : null;
    const start_time = body?.start_time ? String(body.start_time) : null;
    const end_time = body?.end_time ? String(body.end_time) : null;
    const notes = body?.notes ? String(body.notes) : null;

    if (!residency_id || (!date && (!dates || dates.length === 0))) {
      return NextResponse.json({ ok: false, error: 'MISSING_FIELDS' }, { status: 400 });
    }
    if (!isUuid(residency_id)) {
      return NextResponse.json({ ok: false, error: 'INVALID_RESIDENCY_ID' }, { status: 400 });
    }

    const supaSrv = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (dates && dates.length > 0) {
      const rows = dates.map((d) => ({
        residency_id,
        date: d,
        start_time,
        end_time,
        notes,
      }));
      const { error } = await supaSrv.from('residency_occurrences').insert(rows);
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, count: rows.length });
    }

    const { data, error } = await supaSrv
      .from('residency_occurrences')
      .insert({ residency_id, date, start_time, end_time, notes })
      .select('id')
      .maybeSingle();

    if (error || !data?.id) {
      return NextResponse.json({ ok: false, error: error?.message ?? 'Insertion impossible' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
