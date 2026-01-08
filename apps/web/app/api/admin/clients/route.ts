import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
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
      .select('id, name')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, clients: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 });
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

    const supaSrv = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supaSrv
      .from('clients')
      .insert({ name: rawName })
      .select('id, name')
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message ?? 'Insert failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, client: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
