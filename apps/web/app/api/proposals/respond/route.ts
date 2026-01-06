import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPlanConfig } from '@/lib/plan';

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) {
    throw new Error(
      'Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * Body attendu:
 * {
 *   "request_id": "uuid-de-la-demande",
 *   "accept": true | false,             // true = accepté, false = refusé ; si omis mais changes_message présent => demande de modifs
 *   "changes_message": "string optionnelle"
 * }
 */
export async function POST(req: Request) {
  const supabase = getSupabaseServerClient();

  try {
    const body = await req.json().catch(() => ({}));
    const request_id: string | undefined = body?.request_id;
    const accept: boolean | undefined =
      typeof body?.accept === 'boolean' ? body.accept : undefined;
    const changes_message: string | null =
      (body?.changes_message ?? null) || null;

    if (!request_id) {
      return NextResponse.json(
        { ok: false, error: 'Missing request_id' },
        { status: 400 }
      );
    }
    if (accept === undefined && !changes_message) {
      return NextResponse.json(
        { ok: false, error: 'Provide accept boolean or changes_message' },
        { status: 400 }
      );
    }

    // 1) Récupérer la dernière proposition pour cette demande
    const { data: prop, error: propErr } = await supabase
      .from('proposals')
      .select('id, status, request_id, artist_id, created_at')
      .eq('request_id', request_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (propErr) {
      return NextResponse.json(
        { ok: false, error: 'Read proposal failed: ' + propErr.message },
        { status: 500 }
      );
    }
    if (!prop) {
      return NextResponse.json(
        { ok: false, error: 'No proposal found for request_id' },
        { status: 404 }
      );
    }

    // 2) Récupérer la demande + le plan de l'établissement
    const { data: reqRow, error: reqErr } = await supabase
      .from('booking_requests')
      .select('id, venue_id, status, event_date')
      .eq('id', request_id)
      .maybeSingle();

    if (reqErr) {
      return NextResponse.json(
        { ok: false, error: 'Read booking_request failed: ' + reqErr.message },
        { status: 500 }
      );
    }

    let planId: 'free' | 'starter' | 'pro' | 'premium' = 'free';

    if (reqRow?.venue_id) {
      const { data: venueRow, error: venueErr } = await supabase
        .from('venues')
        .select('subscription_plan, is_pro')
        .eq('id', reqRow.venue_id)
        .maybeSingle();

      if (venueErr) {
        return NextResponse.json(
          { ok: false, error: 'Read venue failed: ' + venueErr.message },
          { status: 500 }
        );
      }

      const rawPlan = (venueRow?.subscription_plan as string | null) ?? null;
      const isProFlag = venueRow?.is_pro === true;

      if (rawPlan === 'starter' || rawPlan === 'pro' || rawPlan === 'premium') {
        planId = rawPlan;
      } else if (isProFlag) {
        planId = 'pro';
      } else {
        planId = 'free';
      }
    }

    const planCfg = getPlanConfig(planId);

    // 3) Vérifier les limites de pack AVANT de changer les statuts

    // 3.a Limite de modifications (refus / demande de changements)
    const isModificationAction =
      accept === false || (accept === undefined && !!changes_message);

    if (isModificationAction && planCfg.modificationsPerRequest !== null) {
      const { data: existingMods, error: modErr } = await supabase
        .from('proposals')
        .select('id, status')
        .eq('request_id', request_id)
        .in('status', ['rejected', 'needs_changes']);

      if (modErr) {
        return NextResponse.json(
          { ok: false, error: 'Read modifications failed: ' + modErr.message },
          { status: 500 }
        );
      }

      const used = existingMods?.length ?? 0;
      if (used >= planCfg.modificationsPerRequest) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Limite de modifications atteinte pour votre pack. Passez à une formule supérieure pour demander plus de changements d'artistes.",
          },
          { status: 403 }
        );
      }
    }

    // 3.b Limite d'événements acceptés par mois (Starter / pack à limite)
    if (accept === true && planCfg.monthlyEventsLimit !== null && reqRow?.venue_id) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthStartIsoDate = monthStart.toISOString().slice(0, 10);

      const { data: existingBookings, error: countErr } = await supabase
        .from('booking_requests')
        .select('id')
        .eq('venue_id', reqRow.venue_id)
        .in('status', ['confirmed'])
        .gte('event_date', monthStartIsoDate);

      if (countErr) {
        return NextResponse.json(
          { ok: false, error: 'Read monthly bookings failed: ' + countErr.message },
          { status: 500 }
        );
      }

      const used = existingBookings?.length ?? 0;
      if (used >= planCfg.monthlyEventsLimit) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Vous avez atteint la limite d'événements confirmés pour ce mois avec votre pack actuel. Passez au pack Pro pour débloquer des événements illimités.",
          },
          { status: 403 }
        );
      }
    }

    // 4) Appliquer la décision
    let newProposalStatus: string = prop.status;
    let newRequestStatus: string | null = null;

    if (accept === true) {
      newProposalStatus = 'accepted';
      newRequestStatus = 'confirmed';
    } else if (accept === false) {
      newProposalStatus = 'rejected';
      newRequestStatus = 'client_declined';
    } else if (changes_message) {
      newProposalStatus = 'needs_changes';
      newRequestStatus = 'client_review';
    }

    // 5) Update proposal
    {
      const updates: any = { status: newProposalStatus };
      if (changes_message) updates.client_note = changes_message;
      const { error: upPropErr } = await supabase
        .from('proposals')
        .update(updates)
        .eq('id', prop.id);

      if (upPropErr) {
        return NextResponse.json(
          { ok: false, error: 'Update proposal failed: ' + upPropErr.message },
          { status: 500 }
        );
      }
    }

    // 6) Update booking_request
    if (newRequestStatus) {
      const updates: any = { status: newRequestStatus };
      if (accept === true) {
        updates.commission_rate = 0;
      }
      const { error: upReqErr } = await supabase
        .from('booking_requests')
        .update(updates)
        .eq('id', request_id);

      if (upReqErr) {
        return NextResponse.json(
          { ok: false, error: 'Update booking_request failed: ' + upReqErr.message },
          { status: 500 }
        );
      }
    }

    // 7) Si accepté, débloquer l'artiste pour le lieu
    if (accept === true && reqRow?.venue_id && prop.artist_id) {
      const { data: existingUnlock, error: unlockErr } = await supabase
        .from('venue_unlocked_artists')
        .select('id')
        .eq('venue_id', reqRow.venue_id)
        .eq('artist_id', prop.artist_id)
        .maybeSingle();

      if (unlockErr) {
        console.warn('[proposals/respond] warn: check unlock failed', unlockErr.message);
      }

      if (!existingUnlock) {
        const { error: insErr } = await supabase
          .from('venue_unlocked_artists')
          .insert({
            venue_id: reqRow.venue_id,
            artist_id: prop.artist_id,
            first_unlocked_at: new Date().toISOString(),
          })
          .select('id')
          .maybeSingle();
        if (insErr) {
          console.warn('[proposals/respond] warn: unlock insert failed', insErr.message);
        }
      }
    }

    // 8) Créer des feuilles de route minimalistes si accepté
    if (accept === true) {
      try {
        await supabase.from('itineraries').insert([
          {
            request_id,
            proposal_id: prop.id,
            target: 'client',
            title: 'Feuille de route client',
            data_json: { generated_at: new Date().toISOString() },
          },
          {
            request_id,
            proposal_id: prop.id,
            target: 'artist',
            title: 'Feuille de route artiste',
            data_json: { generated_at: new Date().toISOString() },
          },
        ]);
      } catch (e: any) {
        console.warn('[proposals/respond] warn: itinerary insert failed', e?.message);
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        proposal_id: prop.id,
        new_proposal_status: newProposalStatus,
        new_request_status: newRequestStatus,
      },
    });
  } catch (e: any) {
    console.error('[proposals/respond] fatal', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
