import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { isUuid } from '@/lib/uuid';

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
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Vous devez être connecté.' }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Accès réservé aux admins.' }, { status: 403 });
    }

    const body = await req.json();
    const week_id = body?.week_id as string | undefined;
    if (!week_id || week_id === 'undefined') {
      return NextResponse.json({ ok: false, error: 'Créneau manquant.' }, { status: 400 });
    }
    if (!isUuid(week_id)) {
      return NextResponse.json({ ok: false, error: 'Créneau invalide.' }, { status: 400 });
    }

    const supaSrv = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: wk, error: wkErr } = await supaSrv
      .from('residency_weeks')
      .select('id, status')
      .eq('id', week_id)
      .maybeSingle();
    if (wkErr || !wk) {
      return NextResponse.json({ ok: false, error: 'Créneau introuvable.' }, { status: 404 });
    }
    if (wk.status === 'CONFIRMED') {
      return NextResponse.json(
        { ok: false, error: 'Impossible de supprimer une semaine confirmée.' },
        { status: 400 }
      );
    }

    const { error } = await supaSrv
      .from('residency_weeks')
      .update({ status: 'CANCELLED' })
      .eq('id', week_id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Erreur serveur.' },
      { status: 500 }
    );
  }
}
