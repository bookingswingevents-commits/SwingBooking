import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { getArtistIdentity } from '@/lib/artistIdentity';
import { isUuid } from '@/lib/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Connexion requise.' }, { status: 401 });
    }

    const identity = await getArtistIdentity(supabase as any);
    if (!identity.artistId) {
      return NextResponse.json(
        { ok: false, error: 'Compte artiste non lié.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const residency_id = body?.residency_id as string | undefined;
    const date = body?.date as string | undefined;

    if (!residency_id || !date) {
      return NextResponse.json(
        { ok: false, error: 'Champs manquants (programmation, date).' },
        { status: 400 }
      );
    }
    if (!isUuid(residency_id)) {
      return NextResponse.json(
        { ok: false, error: 'Identifiant de programmation invalide.' },
        { status: 400 }
      );
    }

    const { data: resRow, error: resErr } = await supabase
      .from('residencies')
      .select('id, mode, is_open, fee_amount_cents')
      .eq('id', residency_id)
      .maybeSingle();
    if (resErr || !resRow) {
      return NextResponse.json(
        { ok: false, error: 'Programmation introuvable.' },
        { status: 404 }
      );
    }
    if (!resRow.is_open) {
      return NextResponse.json(
        { ok: false, error: 'Programmation fermée aux candidatures.' },
        { status: 403 }
      );
    }
    if (resRow.mode !== 'DATES') {
      return NextResponse.json(
        { ok: false, error: 'Candidature par date indisponible.' },
        { status: 400 }
      );
    }

    const { data: existingWeek, error: weekErr } = await supabase
      .from('residency_weeks')
      .select('id')
      .eq('residency_id', residency_id)
      .eq('start_date_sun', date)
      .maybeSingle();

    if (weekErr) {
      return NextResponse.json(
        { ok: false, error: 'Impossible de vérifier la date.' },
        { status: 500 }
      );
    }

    if (!existingWeek?.id) {
      return NextResponse.json(
        { ok: false, error: 'Date indisponible pour cette programmation.' },
        { status: 400 }
      );
    }

    const { error: upErr } = await supabase
      .from('week_applications')
      .upsert(
        {
          residency_week_id: existingWeek.id,
          artist_id: identity.artistId,
          status: 'APPLIED',
        },
        { onConflict: 'residency_week_id,artist_id' }
      );
    if (upErr) {
      return NextResponse.json(
        { ok: false, error: upErr.message ?? 'Envoi impossible.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, residency_week_id: existingWeek.id });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Erreur serveur' },
      { status: 500 }
    );
  }
}
