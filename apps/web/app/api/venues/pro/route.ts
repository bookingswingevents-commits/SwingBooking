import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

function getSupabase(token?: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

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

/**
 * Permet de changer le plan d’un établissement.
 * Appels typiques :
 *   POST /api/venues/pro?plan=starter
 *   POST /api/venues/pro?plan=pro
 * Corps attendu : { "venue_id": "uuid" } (optionnel si session détectée)
 */
export async function POST(req: Request) {
  try {
    const token = await getToken();
    const supabase = getSupabase(token);

    // Lecture du paramètre plan
    const url = new URL(req.url);
    const plan = url.searchParams.get('plan') as
      | 'free'
      | 'starter'
      | 'pro'
      | 'premium'
      | null;

    if (!plan || !['free', 'starter', 'pro', 'premium'].includes(plan)) {
      return NextResponse.json(
        { ok: false, error: 'Paramètre ?plan= invalide ou manquant' },
        { status: 400 }
      );
    }

    // Lecture du corps JSON facultatif
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {}

    // Si venue_id non fourni → on essaie de lire la session utilisateur
    let venueId = body?.venue_id as string | undefined;

    if (!venueId) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        return NextResponse.json(
          { ok: false, error: 'Not authenticated' },
          { status: 401 }
        );
      }
      venueId = session.user.id;
    }

    // Vérifier que la venue existe
    const { data: venue, error: vErr } = await supabase
      .from('venues')
      .select('id')
      .eq('id', venueId)
      .maybeSingle();

    if (vErr) {
      return NextResponse.json(
        { ok: false, error: 'Impossible de lire l'établissement: ' + vErr.message },
        { status: 500 }
      );
    }
    if (!venue) {
      return NextResponse.json(
        { ok: false, error: 'Établissement introuvable' },
        { status: 404 }
      );
    }

    // Déterminer si on doit activer is_pro
    const isPro = plan === 'pro' || plan === 'premium';

    // Mise à jour via service role pour bypass RLS
    const srv = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const { error: upErr } = await srv
      .from('venues')
      .update({
        subscription_plan: plan,
        is_pro: isPro,
        plan_started_at: new Date().toISOString(),
        plan_expires_at: null,
      })
      .eq('id', venueId);

    if (upErr) {
      return NextResponse.json(
        { ok: false, error: 'Mise à jour impossible: ' + upErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Subscription plan updated',
      venue_id: venueId,
      plan,
      is_pro: isPro,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
