import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Variables d'environnement manquantes: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL');
    const anonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');

    const body = await req.json().catch(() => ({}));
    const request_id: string | undefined = body?.request_id;
    const compensation_mode: 'cachet' | 'facture' | undefined = body?.compensation_mode;
    const compensation_amount: number | null =
      typeof body?.compensation_amount === 'number'
        ? body.compensation_amount
        : body?.compensation_amount
        ? Number(body.compensation_amount)
        : null;
    const compensation_expenses: number | null =
      typeof body?.compensation_expenses === 'number'
        ? body.compensation_expenses
        : body?.compensation_expenses
        ? Number(body.compensation_expenses)
        : null;
    const compensation_organism: string | null =
      body?.compensation_organism?.trim() || null;

    if (!request_id || !compensation_mode) {
      return NextResponse.json(
        { ok: false, error: 'request_id et compensation_mode requis' },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get('Authorization') || '';

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: sess } = await supabaseAuth.auth.getUser();
    const artistId = sess?.user?.id;
    if (!artistId) {
      return NextResponse.json(
        { ok: false, error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Vérifie que l'artiste est bien invité ou lié à la demande
    const { data: inv } = await supabaseAuth
      .from('request_artists')
      .select('id')
      .eq('request_id', request_id)
      .eq('artist_id', artistId)
      .maybeSingle();

    if (!inv) {
      return NextResponse.json(
        { ok: false, error: 'Accès refusé pour cette demande' },
        { status: 403 }
      );
    }

    // Utilise service role pour écrire dans proposals (bypass RLS)
    const supabaseSrv = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Cherche une proposition existante pour ce request/artist (draft en cours)
    const { data: existing } = await supabaseSrv
      .from('proposals')
      .select('id, status')
      .eq('request_id', request_id)
      .eq('artist_id', artistId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { error: upErr } = await supabaseSrv
        .from('proposals')
        .update({
          compensation_mode,
          compensation_amount,
          compensation_expenses,
          compensation_organism,
        })
        .eq('id', existing.id);
      if (upErr) throw upErr;
      return NextResponse.json({ ok: true, proposal_id: existing.id });
    }

    // Aucune proposition existante : on crée un brouillon support de la rémunération
    const { data: inserted, error: insErr } = await supabaseSrv
      .from('proposals')
      .insert({
        request_id,
        artist_id: artistId,
        status: 'pending', // brouillon de rémunération
        compensation_mode,
        compensation_amount,
        compensation_expenses,
        compensation_organism,
      })
      .select('id')
      .maybeSingle();

    if (insErr) throw insErr;
    return NextResponse.json({ ok: true, proposal_id: inserted?.id });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Erreur serveur' },
      { status: 500 }
    );
  }
}
