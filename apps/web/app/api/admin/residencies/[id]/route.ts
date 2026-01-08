import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { isUuid } from '@/lib/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function PATCH(req: Request, context: any) {
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
    const id = params?.id as string | undefined;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ ok: false, error: 'INVALID_ID' }, { status: 400 });
    }

    const body = await req.json();
    const lodging_included = body?.lodging_included;
    const meals_included = body?.meals_included;
    const companion_included = body?.companion_included;

    if (
      typeof lodging_included !== 'boolean' ||
      typeof meals_included !== 'boolean' ||
      typeof companion_included !== 'boolean'
    ) {
      return NextResponse.json({ ok: false, error: 'INVALID_CONDITIONS' }, { status: 400 });
    }

    const supaSrv = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supaSrv
      .from('residencies')
      .update({ lodging_included, meals_included, companion_included })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
