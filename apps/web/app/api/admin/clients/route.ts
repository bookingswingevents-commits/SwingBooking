import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Variables d'environnement manquantes: ${name}`);
  return v;
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_USER' }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'NOT_ADMIN' }, { status: 403 });
    }

    const supaSrv = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supaSrv
      .from('clients')
      .select(
        'id, name, contact_name, contact_email, contact_phone, default_event_address_line1, default_event_address_line2, default_event_zip, default_event_city, default_event_country, notes'
      )
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, clients: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

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
    const rawName = body?.name ? String(body.name).trim() : '';
    if (rawName.length < 2) {
      return NextResponse.json({ ok: false, error: 'INVALID_NAME' }, { status: 400 });
    }

    const payload = {
      name: rawName,
      contact_name: body?.contact_name ? String(body.contact_name).trim() : null,
      contact_email: body?.contact_email ? String(body.contact_email).trim() : null,
      contact_phone: body?.contact_phone ? String(body.contact_phone).trim() : null,
      default_event_address_line1: body?.default_event_address_line1 ? String(body.default_event_address_line1).trim() : null,
      default_event_address_line2: body?.default_event_address_line2 ? String(body.default_event_address_line2).trim() : null,
      default_event_zip: body?.default_event_zip ? String(body.default_event_zip).trim() : null,
      default_event_city: body?.default_event_city ? String(body.default_event_city).trim() : null,
      default_event_country: body?.default_event_country ? String(body.default_event_country).trim() : null,
      notes: body?.notes ? String(body.notes).trim() : null,
    };

    const supaSrv = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supaSrv
      .from('clients')
      .insert(payload)
      .select('id, name')
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message ?? 'Insertion impossible' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, client: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
