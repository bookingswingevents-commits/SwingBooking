import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Variables d'environnement manquantes: ${name}`);
  return v;
};

async function getTokenFromCookies(): Promise<string | null> {
  const store = await cookies();
  const direct = store.get('sb-access-token')?.value;
  if (direct) return direct;

  const raw = store.get('supabase-auth-token')?.value;
  if (!raw) return null;
  try {
    if (raw[0] !== '[' && raw[0] !== '{') return raw.replace(/^"|"$/g, '');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr[0]) return String(arr[0]);
  } catch {
    /* ignore malformed cookie */
  }
  return null;
}

export async function GET(_req: Request, context: any) {
  try {
    const params = await context.params;
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Identifiant de demande manquant' }, { status: 400 });
    }

    const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');

    // Optionnel : identifie le viewer pour savoir s’il est propriétaire
    let viewerId: string | null = null;
    try {
      const token = await getTokenFromCookies();
      if (token) {
        const authed = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userRes } = await authed.auth.getUser(token);
        viewerId = userRes?.user?.id ?? null;
      }
    } catch {
      // Pas bloquant : accès public autorisé si le token n'est pas lisible
    }

    const supabaseSrv = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: req, error: reqErr } = await supabaseSrv
      .from('booking_requests')
      .select(
        `
        id, title, event_date, formation, event_format, practical_info, venue_address,
        start_time, duration_minutes, payment_mode, audience_size, status,
        venue_contact_email, venue_contact_name, venue_company_name, venue_id,
        travel_covered, travel_modes, travel_notes,
        accommodation_provided, accommodation_type, accommodation_notes,
        meal_provided, meal_notes,
        managed_booking, managed_booking_price_cents, managed_booking_status,
        request_tier
      `
      )
      .eq('id', id)
      .maybeSingle();

    if (reqErr) {
      return NextResponse.json(
        { ok: false, error: 'Read booking_request failed: ' + reqErr.message },
        { status: 500 }
      );
    }
    if (!req) {
      return NextResponse.json({ ok: false, error: 'booking_request not found' }, { status: 404 });
    }

    const { data: proposals, error: pErr } = await supabaseSrv
      .from('proposals')
      .select(
        `
        id, status, created_at, request_id,
        compensation_mode, compensation_amount, compensation_expenses, compensation_organism,
        booking_requests(id, title, event_date, formation, event_format, practical_info, venue_address, start_time, duration_minutes, payment_mode),
        artists:artist_id(
          id, stage_name, formations, bio, tech_needs,
          instagram_url, instagram_media_url,
          youtube_url, facebook_url, tiktok_url,
          contact_phone, is_active
        )
      `
      )
      .eq('request_id', id)
      .order('created_at', { ascending: false });

    if (pErr) {
      console.warn('[api/requests/public] proposal load error', pErr.message);
    }

    // Feuilles de route liées à la demande
    const { data: itineraries, error: itinErr } = await supabaseSrv
      .from('itineraries')
      .select('id, request_id, proposal_id, title, target, data_json, created_at')
      .eq('request_id', id)
      .order('created_at', { ascending: false });
    if (itinErr) {
      console.warn('[api/requests/public] itineraries load error', itinErr.message);
    }

    const { data: occurrences, error: occErr } = await supabaseSrv
      .from('booking_request_occurrences')
      .select('id, date, start_time, duration_minutes, address_snapshot, audience_estimate')
      .eq('request_id', id)
      .order('date', { ascending: true });
    if (occErr) {
      console.warn('[api/requests/public] occurrences load error', occErr.message);
    }

    let proposal: any = null;
    if (Array.isArray(proposals)) {
      const preferred = proposals.find((pr: any) =>
        ['sent', 'proposal_sent', 'sent_to_client', 'client_review'].includes(
          String(pr.status || '').toLowerCase()
        )
      );
      const chosen = preferred ?? proposals[0] ?? null;
      if (chosen) {
        proposal = {
          ...chosen,
          booking_requests: Array.isArray((chosen as any).booking_requests)
            ? (chosen as any).booking_requests[0] ?? null
            : (chosen as any).booking_requests,
          artists: Array.isArray((chosen as any).artists)
            ? (chosen as any).artists[0] ?? null
            : (chosen as any).artists,
        };
      }
    }

    const viewerOwns = req.venue_id ? req.venue_id === viewerId : false;
    const { venue_id: _omitVenueId, ...requestSafe } = req;

    return NextResponse.json({
      ok: true,
      data: {
        request: requestSafe,
        proposal,
        itineraries: itineraries ?? [],
        occurrences: occurrences ?? [],
      },
      viewer_is_owner: viewerOwns,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erreur serveur' }, { status: 500 });
  }
}
