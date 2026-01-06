import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, getAdminAuth } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    // 1) Auth via cookies (SSR Supabase)
    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) {
      return NextResponse.json({ error: "NO_USER" }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ error: "NOT_ADMIN" }, { status: 403 });
    }

    // 4) Payload + validations minimales (la RPC reverifie aussi)
    const body = await req.json();

    for (const k of ["event_format","formation","event_date","start_time","duration_minutes"] as const) {
      if (!body?.[k]) {
        return NextResponse.json({ error: `Champ manquant: ${k}` }, { status: 400 });
      }
    }

    const hasVenueId = !!body?.venue_id;
    const hasVenueSnapshot =
      !!body?.venue_company_name ||
      !!body?.venue_address ||
      !!body?.venue_contact_name ||
      !!body?.venue_contact_email ||
      !!body?.venue_contact_phone;

    if (!hasVenueId && !hasVenueSnapshot) {
      return NextResponse.json(
        { error: "Sélectionne un établissement OU renseigne les champs du nouvel établissement." },
        { status: 400 }
      );
    }

    // 5) Insert direct via service role (après vérif admin)
    const srv = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const payload: any = {
      event_format: body.event_format ?? null,
      formation: body.formation,
      event_date: body.event_date,
      start_time: body.start_time ?? null,
      duration_minutes: body.duration_minutes ?? null,
      audience_size: body.audience_size ?? null,
      notes: body.notes ?? null,
      practical_info: body.practical_info ?? null,
      status: 'reviewing',
    };

    if (body.event_format_id) payload.event_format_id = body.event_format_id;
    if (body.venue_id) payload.venue_id = body.venue_id;
    if (!body.venue_id) {
      payload.venue_company_name = body.venue_company_name ?? null;
      payload.venue_address = body.venue_address ?? null;
      payload.venue_contact_name = body.venue_contact_name ?? null;
      payload.venue_contact_email = body.venue_contact_email ?? null;
      payload.venue_contact_phone = body.venue_contact_phone ?? null;
    }

    const { data: insert, error: insErr } = await srv
      .from("booking_requests")
      .insert(payload)
      .select("id")
      .maybeSingle();

    if (insErr) {
      return NextResponse.json({ error: `Insert failed: ${insErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: insert?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
