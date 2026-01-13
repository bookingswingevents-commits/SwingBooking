import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { notifySignupConfirmation } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Vous devez être connecté.' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .maybeSingle();

    const email = profile?.email || user.email;
    if (!email) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    await notifySignupConfirmation({
      to: email,
      toName: profile?.full_name ?? null,
      userId: user.id,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[notify/signup-confirmation] error', e?.message);
    return NextResponse.json({ ok: false, error: 'Erreur serveur.' }, { status: 500 });
  }
}
