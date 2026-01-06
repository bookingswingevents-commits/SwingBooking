import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ user: null, profile_role: null, metadata_role: null, is_admin: false }, { status: 401 });
    }

    const metadataRole = (user.user_metadata as { role?: string } | null)?.role ?? null;
    let profileRole: string | null = null;
    try {
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (!profErr) profileRole = (prof?.role as string | null) ?? null;
    } catch {
      profileRole = null;
    }

    const isAdmin = profileRole === 'admin' || metadataRole === 'admin';
    return NextResponse.json({
      user: { id: user.id, email: user.email, user_metadata: user.user_metadata },
      profile_role: profileRole,
      metadata_role: metadataRole,
      is_admin: isAdmin,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
