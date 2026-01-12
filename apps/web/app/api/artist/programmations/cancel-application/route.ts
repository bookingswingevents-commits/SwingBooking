import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { getArtistIdentity } from '@/lib/artistIdentity';
import { isUuid } from '@/lib/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === value;
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
    if (!isValidIsoDate(date)) {
      return NextResponse.json(
        { ok: false, error: 'Date invalide.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('residency_applications')
      .update({ status: 'CANCELLED' })
      .eq('residency_id', residency_id)
      .eq('artist_id', identity.artistId)
      .eq('date', date)
      .eq('status', 'PENDING')
      .select('date')
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, error: 'Impossible de retirer la candidature.' },
        { status: 500 }
      );
    }
    if (!data?.date) {
      return NextResponse.json(
        { ok: false, error: 'Aucune candidature en attente à retirer.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Erreur serveur' },
      { status: 500 }
    );
  }
}
