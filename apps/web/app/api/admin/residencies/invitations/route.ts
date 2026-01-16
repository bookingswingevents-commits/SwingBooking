import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { isUuid } from '@/lib/uuid';
import { notifyInvitationArtist } from '@/lib/notify';
import { LEGACY_RESIDENCIES_DISABLED } from '@/lib/featureFlags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Variables d'environnement manquantes: ${name}`);
  return v;
}

function makeToken(): string {
  return randomBytes(32).toString('base64url');
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
    const residency_id = body?.residency_id as string | undefined;
    const artist_ids = (body?.artist_ids as string[] | undefined) ?? [];
    const emailList = (body?.emails as string[] | undefined) ?? [];
    if (!residency_id || residency_id === 'undefined') {
      console.warn('[admin/residencies] MISSING_RESIDENCY_ID', { residency_id });
      return NextResponse.json({ ok: false, error: 'MISSING_RESIDENCY_ID' }, { status: 400 });
    }
    if (!isUuid(residency_id)) {
      console.warn('[admin/residencies] INVALID_RESIDENCY_ID', { residency_id });
      return NextResponse.json({ ok: false, error: 'INVALID_RESIDENCY_ID' }, { status: 400 });
    }
    if (artist_ids.length === 0 && emailList.length === 0) {
      console.warn('[admin/residencies] MISSING_ARTIST_IDS', { artist_ids });
      return NextResponse.json({ ok: false, error: 'MISSING_ARTISTS' }, { status: 400 });
    }
    const invalidArtistId = artist_ids.find((id) => !id || id === 'undefined' || !isUuid(id));
    if (invalidArtistId) {
      console.warn('[admin/residencies] INVALID_ARTIST_ID', { invalidArtistId });
      return NextResponse.json({ ok: false, error: 'INVALID_ARTIST_ID' }, { status: 400 });
    }

    const supaSrv = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: residency, error: resErr } = await supaSrv
      .from('residencies')
      .select('id, name, start_date')
      .eq('id', residency_id)
      .maybeSingle();
    if (resErr || !residency) {
      return NextResponse.json({ ok: false, error: 'Residency introuvable' }, { status: 404 });
    }

    let resolvedArtistIds = [...artist_ids];
    if (emailList.length) {
      const { data: emailProfiles } = await supaSrv
        .from('profiles')
        .select('id, email')
        .in('email', emailList);
      const resolved = (emailProfiles ?? []).map((p) => p.id);
      const missing = emailList.filter(
        (e) => !emailProfiles?.find((p) => (p.email ?? '').toLowerCase() === e.toLowerCase())
      );
      if (missing.length) {
        return NextResponse.json(
          { ok: false, error: 'INVALID_EMAILS', missing },
          { status: 400 }
        );
      }
      resolvedArtistIds = [...resolvedArtistIds, ...resolved];
    }

    const uniqueArtistIds = Array.from(new Set(resolvedArtistIds));

    const { data: artists } = uniqueArtistIds.length
      ? await supaSrv
          .from('artists')
          .select('id, stage_name, contact_email')
          .in('id', uniqueArtistIds)
      : { data: [] as any[] };

    const { data: profiles } = uniqueArtistIds.length
      ? await supaSrv.from('profiles').select('id, email, full_name').in('id', uniqueArtistIds)
      : { data: [] as any[] };

    const profById: Record<string, { email: string | null; full_name: string | null }> = {};
    for (const p of profiles ?? []) {
      profById[p.id] = { email: p.email ?? null, full_name: p.full_name ?? null };
    }
    const artistById: Record<string, { stage_name: string | null; contact_email: string | null }> = {};
    for (const a of artists ?? []) {
      artistById[a.id] = { stage_name: a.stage_name ?? null, contact_email: a.contact_email ?? null };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const results: Array<{
      id?: string;
      artist_id?: string;
      artist_name?: string | null;
      email?: string | null;
      status: string;
      token?: string;
      sent_at?: string | null;
    }> = [];

    for (const artist_id of uniqueArtistIds) {
      const meta = profById[artist_id];
      const artist = artistById[artist_id];
      const email = meta?.email ?? artist?.contact_email ?? null;
      const stageName = artist?.stage_name ?? meta?.full_name ?? 'Artiste';
      const inviteToken = makeToken();
      const link = `${baseUrl}/availability/${inviteToken}`;

      const { data: ins, error: insErr } = await supaSrv
        .from('residency_invitations')
        .insert({
          residency_id,
          token: inviteToken,
          status: 'sent',
          sent_at: new Date().toISOString(),
          target_filter: {
            artist_id,
            artist_name: stageName,
            artist_email: email,
          },
          created_by: user.id,
        })
        .select('id')
        .maybeSingle();

      if (insErr || !ins?.id) {
        results.push({ artist_id, artist_name: stageName, email, status: 'failed' });
        continue;
      }

      if (!email) {
        results.push({
          id: ins.id,
          artist_id,
          artist_name: stageName,
          email,
          status: 'sent',
          token: inviteToken,
          sent_at: new Date().toISOString(),
        });
        continue;
      }

      try {
        await notifyInvitationArtist({
          to: email,
          invitationId: ins.id,
          artistName: stageName,
          title: residency.name,
          date: residency.start_date,
          ctaUrl: link,
        });
        results.push({
          id: ins.id,
          artist_id,
          artist_name: stageName,
          email,
          status: 'sent',
          token: inviteToken,
          sent_at: new Date().toISOString(),
        });
      } catch (e: any) {
        results.push({ id: ins.id, artist_id, artist_name: stageName, email, status: 'failed' });
      }
    }

    return NextResponse.json({ ok: true, invitations: results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
