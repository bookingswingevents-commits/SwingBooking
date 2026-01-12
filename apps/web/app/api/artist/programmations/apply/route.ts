import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { getArtistIdentity } from '@/lib/artistIdentity';
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

    const supaSrv = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let weekId: string | null = null;
    const { data: existingWeek } = await supaSrv
      .from('residency_weeks')
      .select('id')
      .eq('residency_id', residency_id)
      .eq('start_date_sun', date)
      .maybeSingle();

    if (existingWeek?.id) {
      weekId = existingWeek.id;
    } else {
      const { data: insertedWeek, error: insWeekErr } = await supaSrv
        .from('residency_weeks')
        .insert({
          residency_id,
          start_date_sun: date,
          end_date_sun: date,
          type: 'CALM',
          performances_count: 1,
          fee_cents: typeof resRow.fee_amount_cents === 'number' ? resRow.fee_amount_cents : 0,
          status: 'OPEN',
        })
        .select('id')
        .maybeSingle();
      if (insWeekErr || !insertedWeek?.id) {
        return NextResponse.json(
          { ok: false, error: insWeekErr?.message ?? 'Création impossible.' },
          { status: 500 }
        );
      }
      weekId = insertedWeek.id;
    }

    const { error: upErr } = await supaSrv
      .from('week_applications')
      .upsert(
        {
          residency_week_id: weekId,
          artist_id: identity.artistId,
          status: 'APPLIED',
        },
        { onConflict: 'residency_week_id,artist_id' }
      );
    if (upErr) {
      return NextResponse.json(
        { ok: false, error: upErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, residency_week_id: weekId });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Erreur serveur' },
      { status: 500 }
    );
  }
}
