import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
};

export async function POST(req: Request) {
  try {
    const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL');
    const anonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');

    const authHeader =
      req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : '';

    if (!token) {
      return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });
    }

    const anon = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userRes, error: userErr } = await anon.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return NextResponse.json({ ok: false, error: 'Session invalide' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const requestId: string | undefined = body?.requestId;
    const role: 'venue' | 'artist' | undefined = body?.role;
    const notes: string | undefined = body?.notes;

    if (!requestId || !role || (role !== 'venue' && role !== 'artist')) {
      return NextResponse.json(
        { ok: false, error: 'Champs manquants (requestId, role)' },
        { status: 400 }
      );
    }

    const contactEmail = userRes.user.email;
    if (!contactEmail) {
      return NextResponse.json(
        { ok: false, error: 'Email de contact manquant' },
        { status: 400 }
      );
    }

    const srv = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: insErr } = await srv.from('communication_requests').insert({
      request_id: requestId,
      requested_by_user_id: userRes.user.id,
      requested_by_role: role,
      contact_email: contactEmail,
      status: 'new',
      notes: notes ?? null,
    });

    if (insErr) {
      return NextResponse.json(
        { ok: false, error: insErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Erreur serveur' },
      { status: 500 }
    );
  }
}
