import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const body = await req.json();

    const stage_name = String(body?.stage_name ?? '').trim();
    const email = String(body?.email ?? '').trim();
    const phone = body?.phone ? String(body.phone).trim() : null;
    const city = body?.city ? String(body.city).trim() : null;
    const bio = body?.bio ? String(body.bio).trim() : null;
    const instagram_url = body?.instagram_url ? String(body.instagram_url).trim() : null;
    const formations_supported = Array.isArray(body?.formations_supported)
      ? (body.formations_supported as string[]).map((f) => String(f))
      : null;
    const event_format_ids_supported = Array.isArray(body?.event_format_ids_supported)
      ? (body.event_format_ids_supported as number[]).map((n) => Number(n))
      : [];
    const notes = body?.notes ? String(body.notes).trim() : null;

    if (!stage_name) {
      return NextResponse.json({ ok: false, error: 'MISSING_STAGE_NAME' }, { status: 400 });
    }
    if (!email || !email.includes('@')) {
      return NextResponse.json({ ok: false, error: 'INVALID_EMAIL' }, { status: 400 });
    }
    if (!event_format_ids_supported.length || event_format_ids_supported.some((n) => !Number.isFinite(n))) {
      return NextResponse.json({ ok: false, error: 'MISSING_EVENT_FORMATS' }, { status: 400 });
    }

    const supaSrv = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: appRow, error: appErr } = await supaSrv
      .from('artist_applications')
      .insert({
        stage_name,
        email,
        phone,
        city,
        bio,
        instagram_url,
        formations_supported,
        status: 'PENDING',
        admin_notes: notes,
      })
      .select('id')
      .maybeSingle();

    if (appErr || !appRow?.id) {
      return NextResponse.json({ ok: false, error: appErr?.message ?? 'Insert failed' }, { status: 500 });
    }

    const links = event_format_ids_supported.map((id) => ({
      application_id: appRow.id,
      event_format_id: id,
    }));

    const { error: linkErr } = await supaSrv
      .from('artist_application_event_formats')
      .insert(links);

    if (linkErr) {
      await supaSrv.from('artist_applications').delete().eq('id', appRow.id);
      return NextResponse.json({ ok: false, error: linkErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, application_id: appRow.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
