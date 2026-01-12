import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';

export async function GET(_req: NextRequest, context: any) {
  try {
    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_USER' }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'NOT_ADMIN' }, { status: 403 });
    }

    const params = await context.params;
    const id = params?.id;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: 'Variables Supabase manquantes (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)' },
        { status: 500 }
      );
    }

    const rest = async (path: string, init?: RequestInit) => {
      const res = await fetch(`${supabaseUrl}/rest/v1${path}`, {
        ...(init || {}),
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: 'return=representation',
          ...(init?.headers || {}),
        },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, json };
    };

    // 1) booking_request
    const rq = await rest(`/booking_requests?select=*&id=eq.${encodeURIComponent(id)}`);
    const request = Array.isArray(rq.json) ? rq.json[0] : null;
    if (!rq.ok || !request) {
      return NextResponse.json({ ok: false, error: 'booking_request not found', debug: rq.json }, { status: 404 });
    }

    // 2) venue fallback si snapshots vides
    let venue_fb: any = null;
    const snapshotsEmpty =
      !request.venue_company_name &&
      !request.venue_address &&
      !request.venue_contact_name &&
      !request.venue_contact_email &&
      !request.venue_contact_phone;

    if (snapshotsEmpty && request.venue_id) {
      const vq = await rest(
        `/venues?select=company_name,address_line1,postal_code,city,contact_name,billing_email,contact_phone&id=eq.${encodeURIComponent(
          request.venue_id
        )}`
      );
      venue_fb = Array.isArray(vq.json) ? vq.json[0] : null;
    }

    // 3) pricing
    const pq = await rest(
      `/request_pricing?select=request_id,client_quote,artist_fee,internal_costs,currency&request_id=eq.${encodeURIComponent(
        id
      )}`
    );
    const pricing = Array.isArray(pq.json) && pq.json.length ? pq.json[0] : null;

    // 4) dernière proposition
    const pr = await rest(
      `/proposals?request_id=eq.${encodeURIComponent(
        id
      )}&select=id,status,created_at,artist_id,artists:artist_id(id,stage_name)&order=created_at.desc&limit=1`
    );
    const proposal = Array.isArray(pr.json) && pr.json.length ? pr.json[0] : null;

    // 5) artistes acceptés
    const ac = await rest(
      `/request_artists?request_id=eq.${encodeURIComponent(
        id
      )}&status=eq.accepted&select=artist_id,status,artists(id,stage_name,formations)`
    );
    const accepted_artists = Array.isArray(ac.json) ? ac.json : [];

    return NextResponse.json({
      ok: true,
      data: {
        request,
        venue_fb,
        pricing,
        proposal,
        accepted_artists,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erreur serveur' }, { status: 500 });
  }
}
