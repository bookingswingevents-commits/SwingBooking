import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateResidencyWeeks } from '@/lib/residencyWeeks';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { isUuid } from '@/lib/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
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
    if (!start_date || start_date === 'undefined') {
      console.warn('[admin/residencies] MISSING_START_DATE', { start_date });
      return NextResponse.json({ ok: false, error: 'MISSING_START_DATE' }, { status: 400 });
    }
    if (!end_date || end_date === 'undefined') {
      console.warn('[admin/residencies] MISSING_END_DATE', { end_date });
      return NextResponse.json({ ok: false, error: 'MISSING_END_DATE' }, { status: 400 });
    }

    const weeks = generateResidencyWeeks(start_date, end_date);
    if (weeks.length === 0) {
      return NextResponse.json({ ok: false, error: 'Periode invalide' }, { status: 400 });
    }

    const supaSrv = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: residency, error: insErr } = await supaSrv
      .from('residencies')
      .insert({
        client_id,
        name,
        start_date,
        end_date,
        lodging_included: body?.lodging_included ?? true,
        meals_included: body?.meals_included ?? true,
        companion_included: body?.companion_included ?? true,
        created_by: user.id,
      })
      .select('id')
      .maybeSingle();

    if (insErr || !residency?.id) {
      return NextResponse.json({ ok: false, error: insErr?.message ?? 'Insert failed' }, { status: 500 });
    }

    const weekRows = weeks.map((w) => ({
      ...w,
      residency_id: residency.id,
    }));

    const { error: weeksErr } = await supaSrv.from('residency_weeks').insert(weekRows);
    if (weeksErr) {
      return NextResponse.json({ ok: false, error: weeksErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: residency.id, weeks: weekRows.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
