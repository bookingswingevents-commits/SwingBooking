import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

async function getTokenFromCookies(): Promise<string | null> {
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

  const token = await getTokenFromCookies();
  const supabase = createClient(url, anon, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser(token ?? undefined);

  if (!user) {
    return NextResponse.json({ user: null, role: null, venue: null, artist: null });
  }

  const { data: prof } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  let venue = null,
    artist = null;
  if (prof?.role === 'venue') {
    venue = (await supabase.from('venues').select('*').eq('id', user.id).maybeSingle()).data;
  } else if (prof?.role === 'artist') {
    artist = (await supabase.from('artists').select('*').eq('id', user.id).maybeSingle()).data;
  }

  return NextResponse.json({ user, role: prof?.role ?? null, venue, artist });
}
