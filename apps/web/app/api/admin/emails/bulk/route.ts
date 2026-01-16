import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { sendEmailOnce } from '@/lib/email';
import { bulkProgrammationOuverte } from '@/lib/emailTemplates';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Variables d'environnement manquantes: ${name}`);
  return v;
}

function hashPayload(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_USER' }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'NOT_ADMIN' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const type = body?.type as string | undefined;
    const formations = Array.isArray(body?.formations) ? (body.formations as string[]) : [];
    const genres = Array.isArray(body?.genres) ? (body.genres as string[]) : [];
    const subject = String(body?.subject ?? 'Programmation ouverte').trim();
    const message = String(body?.message ?? '').trim();
    const testMode = body?.test_mode === true;

    if (!type || type !== 'PROGRAMMATION_OUVERTE') {
      return NextResponse.json({ ok: false, error: 'Type d’envoi invalide.' }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ ok: false, error: 'Le message est obligatoire.' }, { status: 400 });
    }

    const supaSrv = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.swingbooking.fr';
    const template = bulkProgrammationOuverte({
      subject,
      message,
      ctaUrl: `${appUrl}/artist/programming`,
      footer: process.env.EMAIL_REPLY_TO || null,
    });

    if (testMode) {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) {
        return NextResponse.json(
          { ok: false, error: 'Adresse admin manquante.' },
          { status: 400 }
        );
      }
      const payloadHash = hashPayload([subject, message, 'test'].join('|'));
      const eventKey = `bulk:${type}:test:${payloadHash}`;
      await sendEmailOnce({
        to: adminEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
        eventKey,
        eventType: 'bulk_programmation_ouverte',
        entityType: 'admin_test',
        entityId: user.id,
      });
      return NextResponse.json({ ok: true, sent: 1, test_mode: true });
    }

    let artistQuery = supaSrv
      .from('artists')
      .select('id, stage_name, contact_email, user_id, formations, genres, is_active')
      .eq('is_active', true);

    if (formations.length > 0) {
      artistQuery = artistQuery.contains('formations', formations);
    }
    if (genres.length > 0) {
      artistQuery = artistQuery.contains('genres', genres);
    }

    const { data: artists, error: artistErr } = await artistQuery;
    if (artistErr) {
      return NextResponse.json({ ok: false, error: artistErr.message }, { status: 500 });
    }

    const userIds = (artists ?? [])
      .map((a: any) => a.user_id)
      .filter((v: any): v is string => typeof v === 'string' && !!v);
    const { data: profiles } = userIds.length
      ? await supaSrv.from('profiles').select('id, email, full_name').in('id', userIds)
      : { data: [] as any[] };

    const profileById: Record<string, { email: string | null; full_name: string | null }> = {};
    for (const p of profiles ?? []) {
      profileById[p.id] = { email: p.email ?? null, full_name: p.full_name ?? null };
    }

    const dayKey = new Date().toISOString().slice(0, 10);
    const payloadHash = hashPayload([subject, message, formations.join(','), genres.join(',')].join('|'));

    let sent = 0;
    let skippedNoEmail = 0;
    let skippedAlreadySent = 0;
    const errors: Array<{ artist_id: string; error: string }> = [];

    for (const artist of artists ?? []) {
      const profile = artist.user_id ? profileById[artist.user_id] : null;
      const email = profile?.email || artist.contact_email || null;
      if (!email) {
        skippedNoEmail += 1;
        continue;
      }
      const eventKey = `bulk:${type}:${dayKey}:${artist.id}:${payloadHash}`;
      try {
        const result = await sendEmailOnce({
          to: email,
          subject: template.subject,
          html: template.html,
          text: template.text,
          eventKey,
          eventType: 'bulk_programmation_ouverte',
          entityType: 'artist',
          entityId: artist.id,
        });
        if (result.skipped) {
          skippedAlreadySent += 1;
        } else {
          sent += 1;
        }
      } catch (e: any) {
        errors.push({ artist_id: artist.id, error: e?.message ?? 'Erreur envoi' });
      }
      // throttle léger
      await new Promise((r) => setTimeout(r, 80));
    }

    return NextResponse.json({
      ok: true,
      sent,
      skipped_no_email: skippedNoEmail,
      skipped_already_sent: skippedAlreadySent,
      errors,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
