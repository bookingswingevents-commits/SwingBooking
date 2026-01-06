// apps/web/app/api/proposals/create/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // ⚠️ SERVICE ROLE côté serveur UNIQUEMENT
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const { request_id, artist_id } = (await req.json()) as {
      request_id?: string;
      artist_id?: string;
    };

    if (!request_id || !artist_id) {
      return NextResponse.json(
        { ok: false, error: 'Paramètres manquants (request_id, artist_id).' },
        { status: 400 }
      );
    }

    // 1) Vérifier que la demande existe
    const { data: br, error: brErr } = await supabase
      .from('booking_requests')
      .select('id, title')
      .eq('id', request_id)
      .maybeSingle();

    if (brErr) {
      return NextResponse.json(
        { ok: false, error: `Erreur lecture demande: ${brErr.message}` },
        { status: 500 }
      );
    }
    if (!br) {
      return NextResponse.json(
        { ok: false, error: 'Demande introuvable' },
        { status: 404 }
      );
    }

    // 2) (Optionnel) vérifier que l’artiste existe
    const { data: art, error: artErr } = await supabase
      .from('artists')
      .select('id')
      .eq('id', artist_id)
      .maybeSingle();

    if (artErr) {
      return NextResponse.json(
        { ok: false, error: `Erreur lecture artiste: ${artErr.message}` },
        { status: 500 }
      );
    }
    if (!art) {
      return NextResponse.json(
        { ok: false, error: `Artiste introuvable` },
        { status: 404 }
      );
    }

    // 3) Trouver une proposition existante pour ce couple (request, artist)
    const { data: existing, error: existingErr } = await supabase
      .from('proposals')
      .select('id, status, compensation_mode, compensation_amount, compensation_expenses, compensation_organism')
      .eq('request_id', request_id)
      .eq('artist_id', artist_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json(
        { ok: false, error: `Erreur lecture proposition: ${existingErr.message}` },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'Aucune rémunération saisie par l’artiste pour cette demande.' },
        { status: 422 }
      );
    }

    if (existing.compensation_amount == null) {
      return NextResponse.json(
        { ok: false, error: 'Impossible d’envoyer la proposition : la rémunération est manquante.' },
        { status: 422 }
      );
    }

    const { error: upPropErr } = await supabase
      .from('proposals')
      .update({
        status: 'sent',
        compensation_mode: existing.compensation_mode,
        compensation_amount: existing.compensation_amount,
        compensation_expenses: existing.compensation_expenses,
        compensation_organism: existing.compensation_organism,
      })
      .eq('id', existing.id);

    if (upPropErr) {
      return NextResponse.json(
        { ok: false, error: `Erreur mise à jour proposition: ${upPropErr.message}` },
        { status: 500 }
      );
    }

    // 4) Mettre à jour le statut de la demande (best effort)
    const { error: upErr } = await supabase
      .from('booking_requests')
      .update({ status: 'proposal_sent' })
      .eq('id', request_id);

    if (upErr) {
      // on ne bloque pas pour ça
      console.warn('[proposals/create] warn: booking_requests status not updated', upErr.message);
    }

    return NextResponse.json({ ok: true, proposal_id: existing.id });
  } catch (e: any) {
    console.error('[proposals/create] fatal', e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
