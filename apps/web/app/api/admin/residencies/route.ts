import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateResidencyWeeks } from '@/lib/residencyWeeks';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { isUuid } from '@/lib/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Variables d'environnement manquantes: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
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
    const client_id = body?.client_id as string | undefined;
    const name = body?.name as string | undefined;
    const start_date = body?.start_date as string | undefined;
    const end_date = body?.end_date as string | undefined;
    const mode = (body?.mode as string | undefined) || (Array.isArray(body?.dates) ? 'DATES' : 'RANGE');
    const dates = Array.isArray(body?.dates) ? (body.dates as string[]) : [];
    if (!client_id || client_id === 'undefined') {
      console.warn('[admin/residencies] MISSING_CLIENT_ID', { client_id });
      return NextResponse.json({ ok: false, error: 'MISSING_CLIENT_ID' }, { status: 400 });
    }
    if (!isUuid(client_id)) {
      console.warn('[admin/residencies] INVALID_CLIENT_ID', { client_id });
      return NextResponse.json({ ok: false, error: 'INVALID_CLIENT_ID' }, { status: 400 });
    }
    if (!name || name === 'undefined') {
      console.warn('[admin/residencies] MISSING_NAME', { name });
      return NextResponse.json({ ok: false, error: 'MISSING_NAME' }, { status: 400 });
    }
    if (mode === 'RANGE') {
      if (!start_date || start_date === 'undefined') {
        console.warn('[admin/residencies] MISSING_START_DATE', { start_date });
        return NextResponse.json({ ok: false, error: 'MISSING_START_DATE' }, { status: 400 });
      }
      if (!end_date || end_date === 'undefined') {
        console.warn('[admin/residencies] MISSING_END_DATE', { end_date });
        return NextResponse.json({ ok: false, error: 'MISSING_END_DATE' }, { status: 400 });
      }
    } else if (mode === 'DATES') {
      if (!dates.length) {
        return NextResponse.json({ ok: false, error: 'MISSING_DATES' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ ok: false, error: 'INVALID_MODE' }, { status: 400 });
    }

    const supaSrv = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let normalizedDates: string[] = [];
    let computedStart: string;
    let computedEnd: string;
    let weeks: ReturnType<typeof generateResidencyWeeks> = [];

    if (mode === 'RANGE') {
      if (!start_date || start_date === 'undefined') {
        console.warn('[admin/residencies] MISSING_START_DATE', { start_date });
        return NextResponse.json({ ok: false, error: 'MISSING_START_DATE' }, { status: 400 });
      }
      if (!end_date || end_date === 'undefined') {
        console.warn('[admin/residencies] MISSING_END_DATE', { end_date });
        return NextResponse.json({ ok: false, error: 'MISSING_END_DATE' }, { status: 400 });
      }
      weeks = generateResidencyWeeks(start_date, end_date);
      if (weeks.length === 0) {
        return NextResponse.json({ ok: false, error: 'Periode invalide' }, { status: 400 });
      }
      computedStart = start_date;
      computedEnd = end_date;
    } else {
      normalizedDates = Array.from(new Set(dates.map((d) => String(d).trim()).filter(Boolean))).sort();
      computedStart = normalizedDates[0];
      computedEnd = normalizedDates[normalizedDates.length - 1];
      if (!computedStart || !computedEnd) {
        return NextResponse.json({ ok: false, error: 'INVALID_DATES' }, { status: 400 });
      }
    }

    const { data: residency, error: insErr } = await supaSrv
      .from('residencies')
      .insert({
        client_id,
        name,
        start_date: computedStart,
        end_date: computedEnd,
        lodging_included: body?.lodging_included ?? true,
        meals_included: body?.meals_included ?? true,
        companion_included: body?.companion_included ?? true,
        created_by: user.id,
        mode,
      })
      .select('id')
      .maybeSingle();

    if (insErr || !residency?.id) {
      return NextResponse.json({ ok: false, error: insErr?.message ?? 'Insertion impossible' }, { status: 500 });
    }

    if (mode === 'RANGE') {
      const weekRows = weeks.map((w) => {
        const fee_cents = w.type === 'BUSY' ? 30000 : w.type === 'CALM' ? 15000 : null;
        if (!fee_cents) return null;
        return {
          ...w,
          fee_cents,
          residency_id: residency.id,
          week_type: w.type === 'BUSY' ? 'strong' : 'calm',
        };
      });
      if (weekRows.some((row) => !row)) {
        return NextResponse.json(
          { ok: false, error: 'Type de semaine invalide pour le cachet.' },
          { status: 400 }
        );
      }

      const { error: weeksErr } = await supaSrv.from('residency_weeks').insert(weekRows);
      if (weeksErr) {
        return NextResponse.json({ ok: false, error: weeksErr.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, id: residency.id, mode, weeks: weekRows.length });
    }

    const occurrenceRows = normalizedDates.map((date) => ({
      residency_id: residency.id,
      date,
    }));

    const { error: occErr } = await supaSrv
      .from('residency_occurrences')
      .insert(occurrenceRows);
    if (occErr) {
      return NextResponse.json({ ok: false, error: occErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: residency.id, mode, occurrences: occurrenceRows.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
