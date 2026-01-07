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

export async function GET(_req: Request, context: any) {
  return NextResponse.json(
    { ok: false, error: 'DEPRECATED_ARTIST_APPLICATIONS' },
    { status: 410 }
  );
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

    const params = await context.params;
    const id = params?.id;

    const { data, error } = await supaSrv
      .from('artist_applications')
      .select(
        `
        id, created_at, updated_at, stage_name, email, phone, city, bio, instagram_url, formations_supported, status, admin_notes,
        artist_application_event_formats(event_format_id, event_formats(title))
      `
      )
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: any) {
  return NextResponse.json(
    { ok: false, error: 'DEPRECATED_ARTIST_APPLICATIONS' },
    { status: 410 }
  );
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

    const params = await context.params;
    const id = params?.id;
    const body = await req.json();
    const status = body?.status as 'APPROVED' | 'REJECTED' | undefined;
    const admin_notes = body?.admin_notes ? String(body.admin_notes).trim() : null;

    if (!status || (status !== 'APPROVED' && status !== 'REJECTED')) {
      return NextResponse.json({ ok: false, error: 'INVALID_STATUS' }, { status: 400 });
    }

    const { data: appRow, error: appErr } = await supaSrv
      .from('artist_applications')
      .select(
        'id, stage_name, email, bio, instagram_url, status, admin_notes, artist_application_event_formats(event_format_id)'
      )
      .eq('id', id)
      .maybeSingle();
    if (appErr || !appRow) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    if (status === 'REJECTED') {
      const { error: upErr } = await supaSrv
        .from('artist_applications')
        .update({ status: 'REJECTED', admin_notes })
        .eq('id', id);
      if (upErr) {
        return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    // APPROVED
    const { data: existingArtist } = await supaSrv
      .from('artists')
      .select('id')
      .eq('id', appRow.id)
      .maybeSingle();

    if (!existingArtist) {
      await supaSrv.from('artists').insert({
        id: appRow.id,
        stage_name: appRow.stage_name,
        bio: appRow.bio ?? null,
        instagram_url: appRow.instagram_url ?? null,
        is_active: true,
      });
    }

    const formatIds = Array.isArray(appRow.artist_application_event_formats)
      ? appRow.artist_application_event_formats.map((f: any) => f.event_format_id)
      : [];
    if (formatIds.length) {
      const links = formatIds.map((fid: number) => ({
        artist_id: appRow.id,
        event_format_id: fid,
      }));
      await supaSrv.from('artist_event_formats').upsert(links, { onConflict: 'artist_id,event_format_id' });
    }

    const { error: upErr } = await supaSrv
      .from('artist_applications')
      .update({ status: 'APPROVED', admin_notes })
      .eq('id', id);
    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
