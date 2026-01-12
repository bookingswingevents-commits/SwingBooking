import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/roadmaps/create
 * Body: { proposal_id: string }
 * Effet:
 *   - Récupère la proposition + demande
 *   - Insère une feuille de route minimaliste (table itineraries)
 *   - Met la demande en "confirmed"
 *   - (optionnel) envoie des emails si RESEND_API_KEY est configuré
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const proposal_id: string | undefined = body?.proposal_id;
    if (!proposal_id) {
      return NextResponse.json({ ok: false, error: 'proposal_id manquant' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: 'Variables Supabase manquantes (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) Récup proposition + demande
    const { data: proposal, error: prErr } = await supabase
      .from('proposals')
      .select('id, request_id, artist_id')
      .eq('id', proposal_id)
      .maybeSingle();
    if (prErr || !proposal) {
      return NextResponse.json({ ok: false, error: 'Proposal not found' }, { status: 404 });
    }

    const request_id = proposal.request_id as string;

    // 2) Insère des itinéraires minimalistes
    await supabase.from('itineraries').insert([
      {
        request_id,
        proposal_id,
        target: 'client',
        title: 'Feuille de route client',
        data_json: { generated_at: new Date().toISOString() },
      },
      {
        request_id,
        proposal_id,
        target: 'artist',
        title: 'Feuille de route artiste',
        data_json: { generated_at: new Date().toISOString() },
      },
    ]);

    // 3) Marque la demande comme confirmée
    await supabase
      .from('booking_requests')
      .update({ status: 'confirmed' })
      .eq('id', request_id);

    return NextResponse.json({ ok: true, request_id, proposal_id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erreur serveur' }, { status: 500 });
  }
}
