import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let requestId = searchParams.get('request_id');
    const proposalId = searchParams.get('proposal_id');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: 'Variables Supabase manquantes (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)' },
        { status: 500 }
      );
    }

    const rest = async (path: string) => {
      const res = await fetch(`${supabaseUrl}/rest/v1${path}`, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: 'count=exact',
        },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, json };
    };

    if (!requestId && proposalId) {
      const r = await rest(`/proposals?select=request_id&id=eq.${encodeURIComponent(proposalId)}`);
      const reqRow = Array.isArray(r.json) ? r.json[0] : null;
      requestId = reqRow?.request_id ?? null;
      if (!requestId) {
        return NextResponse.json(
          { ok: true, data: null, via: 'proposal->request:not-found', debug: { proposalId } },
          { status: 200 }
        );
      }
    }

    if (!requestId) {
      return NextResponse.json({ ok: false, error: 'request_id manquant or proposal_id' }, { status: 400 });
    }

    const res1 = await rest(
      `/request_pricing?select=client_quote,artist_fee,internal_costs,currency&request_id=eq.${encodeURIComponent(
        requestId
      )}`
    );

    if (res1.ok && Array.isArray(res1.json) && res1.json.length > 0) {
      const row = res1.json[0];
      return NextResponse.json({
        ok: true,
        data: {
          client_quote: toNumber(row?.client_quote),
          artist_fee: toNumber(row?.artist_fee),
          internal_costs: toNumber(row?.internal_costs),
          currency: row?.currency ?? 'EUR',
        },
        via: 'request_pricing',
      });
    }

    const res2 = await rest(
      `/pricing?select=client_quote,artist_fee,internal_costs,currency&request_id=eq.${encodeURIComponent(requestId)}`
    );
    if (res2.ok && Array.isArray(res2.json) && res2.json.length > 0) {
      const row = res2.json[0];
      return NextResponse.json({
        ok: true,
        data: {
          client_quote: toNumber(row?.client_quote),
          artist_fee: toNumber(row?.artist_fee),
          internal_costs: toNumber(row?.internal_costs),
          currency: row?.currency ?? 'EUR',
        },
        via: 'pricing(fallback)',
      });
    }

    return NextResponse.json(
      { ok: true, data: null, via: 'request_pricing:not-found', debug: { request_id: requestId } },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erreur serveur' }, { status: 500 });
  }
}

function toNumber(v: any): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
