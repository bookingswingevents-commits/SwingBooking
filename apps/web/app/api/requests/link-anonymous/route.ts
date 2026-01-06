import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
};

async function getTokenFromCookies(): Promise<string | null> {
  const store = await cookies();
  const direct = store.get('sb-access-token')?.value;
  if (direct) return direct;

  const raw = store.get('supabase-auth-token')?.value;
  if (!raw) return null;
  try {
    if (raw[0] !== '[' && raw[0] !== '{') return raw.replace(/^"|"$/g, '');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr[0]) return String(arr[0]);
  } catch {
    /* ignore malformed cookie */
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL');
    const anonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');

    const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const m = /^Bearer\s+(.+)$/i.exec(header.trim());
    const bearer = m ? m[1] : null;

    const token = bearer ?? (await getTokenFromCookies());
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });
    }

    // Vérifie l'utilisateur connecté à partir du token de session
    const authed = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userRes, error: userErr } = await authed.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const emailFromAuth = (userRes.user.email ?? '').trim().toLowerCase();
    const emailFromBody =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;

    // On ne permet pas de relier un email différent de celui du compte connecté
    if (emailFromBody && emailFromAuth && emailFromBody !== emailFromAuth) {
      return NextResponse.json(
        { ok: false, error: 'Email fourni différent de celui du compte connecté' },
        { status: 400 }
      );
    }

    const normalizedEmail = emailFromAuth || emailFromBody;
    if (!normalizedEmail) {
      return NextResponse.json(
        { ok: false, error: 'Email de contact introuvable pour ce compte' },
        { status: 400 }
      );
    }

    const supabaseSrv = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabaseSrv
      .from('booking_requests')
      .update({
        venue_id: userRes.user.id,
        venue_contact_email: normalizedEmail,
        updated_at: new Date().toISOString(),
      })
      .ilike('venue_contact_email', normalizedEmail)
      .is('venue_id', null)
      .select('id');

    if (error) {
      return NextResponse.json(
        { ok: false, error: 'Relink failed: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, linked: data?.length ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}
