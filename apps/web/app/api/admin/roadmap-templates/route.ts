import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { isUuid } from '@/lib/uuid';
import { LEGACY_RESIDENCIES_DISABLED } from '@/lib/featureFlags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Variables d'environnement manquantes: ${name}`);
  return v;
}

export async function GET(req: Request) {
  try {
    if (LEGACY_RESIDENCIES_DISABLED) {
      return NextResponse.json({ ok: true, templates: [] });
    }
    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Vous devez être connecté.' }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Accès réservé aux admins.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const residency_id = url.searchParams.get('residency_id') || '';
    if (!residency_id || !isUuid(residency_id)) {
      return NextResponse.json({ ok: false, error: 'Programmation invalide.' }, { status: 400 });
    }

    const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    const supaSrv = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supaSrv
      .from('roadmap_templates')
      .select('id, residency_id, week_type, title, content, updated_at')
      .eq('residency_id', residency_id)
      .order('week_type', { ascending: true });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, templates: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Erreur serveur.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    if (LEGACY_RESIDENCIES_DISABLED) {
      return NextResponse.json(
        { ok: false, error: 'LEGACY_RESIDENCIES_DISABLED' },
        { status: 503 }
      );
    }
    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Vous devez être connecté.' }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Accès réservé aux admins.' }, { status: 403 });
    }

    const body = await req.json();
    const residency_id = body?.residency_id as string | undefined;
    const week_type = body?.week_type as 'calm' | 'strong' | undefined;
    const title = (body?.title as string | undefined) ?? '';
    const content = body?.content ?? {};
    if (!residency_id || !isUuid(residency_id)) {
      return NextResponse.json({ ok: false, error: 'Programmation invalide.' }, { status: 400 });
    }
    if (!week_type || (week_type !== 'calm' && week_type !== 'strong')) {
      return NextResponse.json({ ok: false, error: 'Type de semaine invalide.' }, { status: 400 });
    }

    const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    const supaSrv = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supaSrv
      .from('roadmap_templates')
      .upsert(
        {
          residency_id,
          week_type,
          title,
          content,
        },
        { onConflict: 'residency_id,week_type' }
      )
      .select('id, residency_id, week_type, title, content, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, template: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Erreur serveur.' },
      { status: 500 }
    );
  }
}
