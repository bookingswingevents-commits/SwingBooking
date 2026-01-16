import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { isUuid } from '@/lib/uuid';
import { notifyBookingDeclinedArtist } from '@/lib/notify';
import { LEGACY_RESIDENCIES_DISABLED } from '@/lib/featureFlags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Variables d'environnement manquantes: ${name}`);
  return v;
}

export async function PATCH(req: Request, context: any) {
  try {
    if (LEGACY_RESIDENCIES_DISABLED) {
      return NextResponse.json(
        { ok: false, error: 'LEGACY_RESIDENCIES_DISABLED' },
        { status: 503 }
      );
    }
    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_USER' }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'NOT_ADMIN' }, { status: 403 });
    }

    const params = await context.params;
    const id = params?.id as string | undefined;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ ok: false, error: 'INVALID_ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const status = body?.status as 'CONFIRMED' | 'DECLINED' | undefined;
    if (!status || !['CONFIRMED', 'DECLINED'].includes(status)) {
      return NextResponse.json({ ok: false, error: 'INVALID_STATUS' }, { status: 400 });
    }

    const supaSrv = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supaSrv
      .from('residency_applications')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, residency_id, artist_id, date')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!data?.id) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    if (status === 'DECLINED') {
      try {
        const { data: residencyRow } = await supaSrv
          .from('residencies')
          .select('id, name')
          .eq('id', data.residency_id)
          .maybeSingle();
        const { data: artistRow } = await supaSrv
          .from('artists')
          .select('id, stage_name, contact_email, user_id')
          .eq('id', data.artist_id)
          .maybeSingle();
        let profileEmail: string | null = null;
        if (artistRow?.user_id) {
          const { data: profileRow } = await supaSrv
            .from('profiles')
            .select('email')
            .eq('id', artistRow.user_id)
            .maybeSingle();
          profileEmail = profileRow?.email ?? null;
        }
        const targetEmail = profileEmail || artistRow?.contact_email || null;
        if (targetEmail && residencyRow?.name) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.swingbooking.fr';
          await notifyBookingDeclinedArtist({
            to: targetEmail,
            artistName: artistRow?.stage_name ?? null,
            title: residencyRow.name,
            date: data.date,
            ctaUrl: `${appUrl}/artist/programming/${data.residency_id}`,
            eventKey: `residency_declined:${data.id}`,
            entityId: data.id,
          });
        }
      } catch (e: any) {
        console.error('[admin/residency-applications] notify declined failed', e?.message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
