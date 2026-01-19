import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';

type Payload = {
  conditions_override?: Record<string, any> | null;
};

export async function PATCH(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  let payload: Payload = {};

  try {
    payload = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Payload invalide.' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Non authentifié.' }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: 'Accès refusé (admin requis).' }, { status: 403 });
  }

  const { data: item, error: itemError } = await supabase
    .from('programming_items')
    .select('meta_json')
    .eq('id', itemId)
    .maybeSingle();

  if (itemError || !item) {
    return NextResponse.json({ ok: false, error: 'Créneau introuvable.' }, { status: 404 });
  }

  const nextMeta = {
    ...(item.meta_json ?? {}),
    conditions_override: payload.conditions_override ?? {},
  };

  const { error } = await supabase
    .from('programming_items')
    .update({ meta_json: nextMeta })
    .eq('id', itemId);

  if (error) {
    return NextResponse.json({ ok: false, error: 'Mise à jour impossible.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
