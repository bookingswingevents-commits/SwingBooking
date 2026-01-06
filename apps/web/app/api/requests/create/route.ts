// apps/web/app/api/requests/create/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseSrv = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role (serveur ONLY)
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Champs attendus (snapshots pour la demande)
    const {
      event_format_id,
      event_format,
      title,
      event_date,
      start_time,
      duration_minutes,
      location,
      audience_size,
      notes,
      formation,
      venue_address,
      venue_contact_name,
      venue_contact_phone,
      venue_contact_email,
      venue_company_name, // optionnel
      venue_id, // optionnel : établissement connecté
      travel_covered,
      travel_modes,
      travel_notes,
      accommodation_provided,
      accommodation_type,
      accommodation_notes,
      meal_provided,
      meal_notes,
      managed_booking,
      occurrences,
    } = body ?? {};

    const normalizedEmail = String(venue_contact_email ?? '').trim().toLowerCase();

    // Validation minimale
    const occList = Array.isArray(occurrences)
      ? occurrences
          .map((o: any) => ({
            date: o?.date ?? null,
            start_time: o?.start_time ?? null,
            duration_minutes:
              typeof o?.duration_minutes === 'number' ? o.duration_minutes : o?.duration_minutes ? Number(o.duration_minutes) : null,
            address_snapshot: o?.address_snapshot || null,
            audience_estimate:
              typeof o?.audience_estimate === 'number'
                ? o.audience_estimate
                : o?.audience_estimate
                ? Number(o.audience_estimate)
                : null,
            venue_id: o?.venue_id ?? null,
          }))
          .filter((o: any) => !!o.date)
      : [];

    const mainDate = occList[0]?.date ?? event_date;

    if (!mainDate || !formation || !venue_address || !venue_contact_name || !normalizedEmail) {
      return NextResponse.json(
        { ok: false, error: 'Champs obligatoires manquants.' },
        { status: 400 }
      );
    }

    const autoTitle =
      title ??
      `DEMANDE — ${mainDate} — ${String(formation).toUpperCase()}`;

    // Récupère un slug de format (snapshot) si possible
    let formatSlug: string | null = event_format ?? null;
    if (!formatSlug && event_format_id) {
      const { data: fmt } = await supabaseSrv
        .from('event_formats')
        .select('slug')
        .eq('id', event_format_id)
        .maybeSingle();
      formatSlug = fmt?.slug ?? null;
    }

    const insertPayload: any = {
      event_format_id: event_format_id ?? null,
      event_format: formatSlug,
      title: autoTitle,
      event_date: mainDate,
      start_time: start_time ?? null,
      duration_minutes: duration_minutes ?? null,
      location: location ?? null,
      audience_size: audience_size ?? null,
      notes: notes ?? null,
      formation,
      // snapshots établissement
      venue_company_name: venue_company_name ?? null,
      venue_address,
      venue_contact_name,
      venue_contact_phone: venue_contact_phone ?? null,
      venue_contact_email: normalizedEmail,
      travel_covered: !!travel_covered,
      travel_modes: Array.isArray(travel_modes) ? travel_modes : null,
      travel_notes: travel_notes ?? null,
      accommodation_provided: !!accommodation_provided,
      accommodation_type: accommodation_type ?? null,
      accommodation_notes: accommodation_notes ?? null,
      meal_provided: !!meal_provided,
      meal_notes: meal_notes ?? null,
      managed_booking: !!managed_booking,
      managed_booking_status: managed_booking ? 'requested' : 'none',
      managed_booking_price_cents: 6900,
    };

    // Tier discovery : première demande par email
    const { count } = await supabaseSrv
      .from('booking_requests')
      .select('id', { count: 'exact', head: true })
      .eq('venue_contact_email', normalizedEmail);
    insertPayload.request_tier = (count ?? 0) === 0 ? 'discovery' : 'paid';

    // Si un établissement est connecté et qu'on reçoit son id → on rattache
    if (venue_id) {
      insertPayload.venue_id = venue_id;
    }

    const { data, error } = await supabaseSrv
      .from('booking_requests')
      .insert(insertPayload)
      .select('id, venue_id')
      .maybeSingle();

    if (error) throw new Error(error.message);

    // Occurrences (au moins une)
    const occToInsert =
      occList.length > 0
        ? occList
        : [
            {
              date: mainDate,
              start_time: start_time ?? null,
              duration_minutes: duration_minutes ?? null,
              address_snapshot: venue_address ?? null,
              audience_estimate: audience_size ?? null,
              venue_id: venue_id ?? null,
            },
          ];

    try {
      await supabaseSrv.from('booking_request_occurrences').insert(
        occToInsert.map((o: any) => ({
          ...o,
          request_id: data?.id,
        }))
      );
    } catch (occErr) {
      console.warn('[requests/create] occurrences insert warn', (occErr as any)?.message);
    }

    return NextResponse.json({
      ok: true,
      id: data?.id,
      venue_id: data?.venue_id ?? null,
    });
  } catch (e: any) {
    console.error('[api/requests/create]', e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
