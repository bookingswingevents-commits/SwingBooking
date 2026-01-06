import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

async function getToken(): Promise<string | null> {
  const store = await cookies();
  const t1 = store.get('sb-access-token')?.value;
  if (t1) return t1;
  const raw = store.get('supabase-auth-token')?.value;
  if (!raw) return null;
  try {
    if (raw[0] !== '[' && raw[0] !== '{') return raw.replace(/^"|"$/g, '');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr[0]) return String(arr[0]);
  } catch {
    /* ignore */
  }
  return null;
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const srvKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const token = await getToken();

  const userClient = createClient(url, anon, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    auth: { persistSession: false, detectSessionInUrl: false },
  });

  const {
    data: { user },
  } = await userClient.auth.getUser(token ?? undefined);

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const { data: profile } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const { data: venue } = await userClient
    .from('venues')
    .select('subscription_plan, is_pro')
    .eq('id', user.id)
    .maybeSingle();

  const isAdmin = profile?.role === 'admin';
  const isPremiumVenue =
    profile?.role === 'venue' && ((venue?.subscription_plan as string) === 'premium' || venue?.is_pro);

  if (!isAdmin && !isPremiumVenue) {
    return NextResponse.json(
      { ok: false, error: 'Catalogue artistes réservé aux comptes Premium' },
      { status: 403 }
    );
  }

  const srv = createClient(url, srvKey, { auth: { persistSession: false } });

  const { data, error } = await srv
    .from('artists')
    .select('id, stage_name, bio, genres, formations, instagram_url, youtube_url')
    .order('stage_name', { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
