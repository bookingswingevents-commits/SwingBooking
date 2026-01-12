import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST body: { request_id: string, formation?: 'solo'|'duo'|'trio'|'quartet'|'dj', artist_ids?: string[] }
export async function POST(req: NextRequest) {
  try {
    const { formation, artist_ids, request_id } = await req.json();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: 'Variables Supabase manquantes (URL/Service key).' },
      { status: 500 }
      );
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Déterminer quels artistes inviter
    let artists: { id: string }[] = [];

    if (Array.isArray(artist_ids) && artist_ids.length > 0) {
      // Liste fournie par l'admin
      const { data, error } = await admin
        .from('artists')
        .select('id')
        .in('id', artist_ids)
        .eq('is_active', true);
      if (error) throw error;
      artists = data ?? [];
    } else if (formation) {
      // Filtre par formation (tableau d'enums)
      const { data, error } = await admin
        .from('artists')
        .select('id')
        .eq('is_active', true)
        .contains('formations', [formation as any]); // 👈 multi-formations
      if (error) throw error;
      artists = data ?? [];
    } else {
      return NextResponse.json(
        { ok: false, error: 'Need either "formation" or "artist_ids".' },
        { status: 400 }
      );
    }

    if (!artists.length || !request_id) {
      return NextResponse.json({ ok: true, invited: 0, note: 'Aucun artiste trouvé.' });
    }

    // 2) Créer les invitations (évite doublons via upsert onConflict)
    const payload = artists.map((a) => ({
      request_id,
      artist_id: a.id,
      status: 'invited' as const,
    }));

    const { error: insErr } = await admin
      .from('request_artists')
      .upsert(payload, { onConflict: 'request_id,artist_id', ignoreDuplicates: true });
    if (insErr) throw insErr;

    return NextResponse.json({ ok: true, invited: payload.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}
