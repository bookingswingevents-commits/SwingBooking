import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_USER' }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'NOT_ADMIN' }, { status: 403 });
    }

    const body = await req.json();
    const { request_id, client_quote, artist_fee, internal_costs, currency } = body || {};
    if (!request_id) {
      return NextResponse.json({ ok: false, error: 'request_id manquant' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: 'Variables Supabase manquantes (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)' },
        { status: 500 }
      );
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/request_pricing`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        request_id,
        client_quote: client_quote ?? null,
        artist_fee: artist_fee ?? null,
        internal_costs: internal_costs ?? null,
        currency: currency ?? 'EUR',
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: 'Upsert failed', debug: json }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: Array.isArray(json) ? json[0] : json });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erreur serveur' }, { status: 500 });
  }
}
