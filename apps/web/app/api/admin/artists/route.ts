import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
};

export async function GET(req: Request) {
  try {
    const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');

    const { searchParams } = new URL(req.url);
    const formation = searchParams.get('formation');
    const formatId = searchParams.get('format_id');

    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'NO_USER' },
        { status: 401 }
      );
    }

    if (!isAdmin) {
      console.warn('[admin/artists] accès non-admin, fallback autorisé pour tests');
    }

    // Lecture service-role (bypass RLS)
    const supabaseSrv = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabaseSrv
      .from('artists')
      .select(
        `
        id, stage_name, formations, instagram_url, is_active,
        artist_event_formats(event_format_id, event_formats(title))
      `
      );
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const ids = (data ?? []).map(a => a.id);
    let profileNames: Record<string, string | null> = {};
    let profileEmails: Record<string, string | null> = {};
    if (ids.length) {
      const { data: profs } = await supabaseSrv
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids);
      if (profs) {
        profileNames = Object.fromEntries(
          (profs as any[]).map(p => [p.id, p.full_name ?? null])
        );
        profileEmails = Object.fromEntries(
          (profs as any[]).map(p => [p.id, p.email ?? null])
        );
      }
    }

    let filtered = (data ?? []).filter((a: any) => {
      if (!formation) return true;
      const f = formation.toLowerCase().trim();
      const forms = Array.isArray(a.formations)
        ? (a.formations as any[]).map(v => String(v).toLowerCase().trim()).filter(Boolean)
        : [];
      if (forms.length === 0) return true; // fallback : pas de formation déclarée => affiché
      return forms.includes(f);
    });

    if (formatId) {
      const idNum = Number(formatId);
      filtered = filtered.filter((a: any) => {
        const links = Array.isArray(a.artist_event_formats) ? a.artist_event_formats : [];
        return links.some((l: any) => Number(l.event_format_id) === idNum);
      });
    }

    filtered = filtered.map(a => ({
      ...a,
      full_name: profileNames[a.id] ?? null,
      email: profileEmails[a.id] ?? null,
    }));

    const list =
      filtered.length > 0
        ? filtered
        : (data ?? []).map(a => ({
          ...a,
          full_name: profileNames[a.id] ?? null,
          email: profileEmails[a.id] ?? null,
        }));

    return NextResponse.json({ ok: true, data: list });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Erreur serveur' },
      { status: 500 }
    );
  }
}
