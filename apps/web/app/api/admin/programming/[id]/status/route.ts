import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';

type Payload = {
  status?: string;
};

function mapStatus(value?: string) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'PUBLISHED') return 'published';
  if (normalized === 'DRAFT') return 'draft';
  return null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let payload: Payload = {};

  try {
    payload = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ success: false, error: 'Payload invalide.' }, { status: 400 });
  }

  const nextStatus = mapStatus(payload.status);
  if (!nextStatus) {
    return NextResponse.json({ success: false, error: 'Statut invalide.' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Accès refusé (admin requis).' }, { status: 403 });
  }

  const { error } = await supabase.from('programming_programs').update({ status: nextStatus }).eq('id', id);

  if (error) {
    return NextResponse.json({ success: false, error: 'Mise à jour impossible.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
