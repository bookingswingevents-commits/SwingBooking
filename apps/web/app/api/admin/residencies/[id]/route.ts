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
    const terms_mode = body?.terms_mode as
      | 'SIMPLE_FEE'
      | 'INCLUDED'
      | 'WEEKLY'
      | 'RESIDENCY_WEEKLY'
      | undefined;
    const lodging_included = body?.lodging_included;
    const meals_included = body?.meals_included;
    const companion_included = body?.companion_included;
    const fee_amount_cents = body?.fee_amount_cents;
    const fee_currency = body?.fee_currency ? String(body.fee_currency) : undefined;
    const fee_is_net = body?.fee_is_net;
    const program_type = body?.program_type as 'MULTI_DATES' | 'WEEKLY_RESIDENCY' | undefined;
    const conditions_json = body?.conditions_json as Record<string, any> | undefined;
    const roadmap_overrides_json = body?.roadmap_overrides_json as Record<string, any> | undefined;
    const name = body?.name ? String(body.name) : undefined;
    const is_public = typeof body?.is_public === 'boolean' ? body.is_public : undefined;
    const is_open = typeof body?.is_open === 'boolean' ? body.is_open : undefined;

    if (terms_mode && !['SIMPLE_FEE', 'INCLUDED', 'WEEKLY', 'RESIDENCY_WEEKLY'].includes(terms_mode)) {
      return NextResponse.json({ ok: false, error: 'INVALID_TERMS_MODE' }, { status: 400 });
    }

    if (terms_mode === 'SIMPLE_FEE') {
      if (!Number.isInteger(Number(fee_amount_cents)) || Number(fee_amount_cents) <= 0) {
        return NextResponse.json({ ok: false, error: 'INVALID_FEE' }, { status: 400 });
      }
    }

    if (program_type && !['MULTI_DATES', 'WEEKLY_RESIDENCY'].includes(program_type)) {
      return NextResponse.json({ ok: false, error: 'INVALID_PROGRAM_TYPE' }, { status: 400 });
    }

    const supaSrv = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const updatePayload: Record<string, any> = {};
    if (terms_mode) updatePayload.terms_mode = terms_mode;
    if (typeof lodging_included === 'boolean') updatePayload.lodging_included = lodging_included;
    if (typeof meals_included === 'boolean') updatePayload.meals_included = meals_included;
    if (typeof companion_included === 'boolean') updatePayload.companion_included = companion_included;
    if (typeof fee_amount_cents !== 'undefined') updatePayload.fee_amount_cents = fee_amount_cents;
    if (typeof fee_currency !== 'undefined') updatePayload.fee_currency = fee_currency;
    if (typeof fee_is_net !== 'undefined') updatePayload.fee_is_net = fee_is_net;
    if (program_type) updatePayload.program_type = program_type;
    if (typeof conditions_json !== 'undefined') updatePayload.conditions_json = conditions_json;
    if (typeof roadmap_overrides_json !== 'undefined') {
      updatePayload.roadmap_overrides_json = roadmap_overrides_json;
    }
    if (typeof name === 'string') updatePayload.name = name.trim();
    if (typeof is_public === 'boolean') updatePayload.is_public = is_public;
    if (typeof is_open === 'boolean') updatePayload.is_open = is_open;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ ok: false, error: 'NO_FIELDS' }, { status: 400 });
    }

    const { error } = await supaSrv
      .from('residencies')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
