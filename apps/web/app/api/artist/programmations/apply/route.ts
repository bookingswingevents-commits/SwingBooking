import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { isUuid } from '@/lib/uuid';
import { notifyArtistAppliedAdmin } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === value;
}

export async function POST(req: Request) {
  const debug: Record<string, any> = { step: 'start' };
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    debug.step = 'auth';
    debug.userId = user?.id ?? null;
    if (userErr || !user) {
      console.error('[artist/programmations/apply] NO_USER', debug);
      return NextResponse.json(
        { ok: false, error: 'Vous devez être connecté.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const residency_id = body?.residency_id as string | undefined;
    const date = body?.date as string | undefined;
    debug.residency_id = residency_id ?? null;
    debug.date = date ?? null;

    if (!residency_id || !date) {
      console.error('[artist/programmations/apply] MISSING_FIELDS', debug);
      return NextResponse.json(
        { ok: false, error: 'Champs manquants (programmation, date).' },
        { status: 400 }
      );
    }
    if (!isUuid(residency_id)) {
      console.error('[artist/programmations/apply] INVALID_RESIDENCY_ID', debug);
      return NextResponse.json(
        { ok: false, error: 'Identifiant de programmation invalide.' },
        { status: 400 }
      );
    }
    if (!isValidIsoDate(date)) {
      console.error('[artist/programmations/apply] INVALID_DATE', debug);
      return NextResponse.json(
        { ok: false, error: 'Date invalide.' },
        { status: 400 }
      );
    }

    debug.step = 'artist_lookup';
    const { data: artistRow, error: artistErr } = await supabase
      .from('artists')
      .select('id, stage_name, contact_email, user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (artistErr || !artistRow?.id) {
      console.error('[artist/programmations/apply] NO_ARTIST_LINK', {
        ...debug,
        error: artistErr?.message ?? null,
      });
      return NextResponse.json(
        { ok: false, error: 'Votre compte artiste n’est pas relié. Contactez l’administrateur.' },
        { status: 400 }
      );
    }

    debug.step = 'residency_lookup';
    const { data: resRow, error: resErr } = await supabase
      .from('residencies')
      .select('id, name, mode, is_public, is_open, start_date, end_date, clients(name, contact_email)')
      .eq('id', residency_id)
      .maybeSingle();
    if (resErr || !resRow) {
      console.error('[artist/programmations/apply] RESIDENCY_NOT_FOUND', {
        ...debug,
        error: resErr?.message ?? null,
      });
      return NextResponse.json(
        { ok: false, error: 'Programmation introuvable.' },
        { status: 404 }
      );
    }
    if (!resRow.is_public || !resRow.is_open) {
      console.error('[artist/programmations/apply] RESIDENCY_CLOSED', debug);
      return NextResponse.json(
        { ok: false, error: 'Cette programmation n’est pas ouverte aux candidatures.' },
        { status: 400 }
      );
    }

    debug.step = 'date_check';
    if (resRow.mode === 'DATES') {
      const { data: occRow, error: occErr } = await supabase
        .from('residency_occurrences')
        .select('id')
        .eq('residency_id', residency_id)
        .eq('date', date)
        .maybeSingle();
      if (occErr) {
        console.error('[artist/programmations/apply] OCC_LOOKUP_ERROR', {
          ...debug,
          error: occErr?.message ?? null,
        });
        return NextResponse.json(
          { ok: false, error: 'Impossible de vérifier la date.' },
          { status: 500 }
        );
      }
      if (!occRow?.id) {
        return NextResponse.json(
          { ok: false, error: 'Cette date ne fait pas partie de cette programmation.' },
          { status: 400 }
        );
      }
    } else if (date < resRow.start_date || date > resRow.end_date) {
      return NextResponse.json(
        { ok: false, error: 'Cette date ne fait pas partie de cette programmation.' },
        { status: 400 }
      );
    }

    debug.step = 'insert';
    const { error: insErr } = await supabase
      .from('residency_applications')
      .insert({
        residency_id,
        artist_id: artistRow.id,
        date,
        status: 'PENDING',
      });
    if (insErr) {
      if ((insErr as any)?.code === '23505') {
        return NextResponse.json({ ok: true, status: 'PENDING' });
      }
      console.error('[artist/programmations/apply] INSERT_ERROR', {
        ...debug,
        error: insErr.message,
      });
      return NextResponse.json(
        { ok: false, error: 'Envoi de la candidature impossible.' },
        { status: 500 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.swingbooking.fr';
    const adminEmail = process.env.ADMIN_EMAIL;
    const artistName = artistRow.stage_name || 'Artiste';
    const clientName = Array.isArray(resRow.clients)
      ? resRow.clients[0]?.name
      : (resRow.clients as any)?.name;
    const clientEmail = Array.isArray(resRow.clients)
      ? resRow.clients[0]?.contact_email
      : (resRow.clients as any)?.contact_email;
    const adminUrl = `${appUrl}/admin/programmations/${residency_id}`;

    if (adminEmail) {
      await notifyArtistAppliedAdmin({
        to: adminEmail,
        artistName,
        title: resRow.name,
        date,
        adminUrl,
        eventKey: `artist_apply:${residency_id}:${date}:${artistRow.id}:admin`,
        residencyId: residency_id,
      });
    }
    if (clientEmail) {
      await notifyArtistAppliedAdmin({
        to: clientEmail,
        artistName,
        title: resRow.name,
        date,
        adminUrl: `${appUrl}/dashboard`,
        eventKey: `artist_apply:${residency_id}:${date}:${artistRow.id}:client`,
        residencyId: residency_id,
      });
    } else {
      console.error('[artist/programmations/apply] CLIENT_EMAIL_MISSING', {
        residency_id,
        clientName: clientName ?? null,
      });
    }

    return NextResponse.json({ ok: true, status: 'PENDING' });
  } catch (e: any) {
    console.error('[artist/programmations/apply] UNHANDLED', {
      error: e?.message ?? e,
    });
    return NextResponse.json(
      { ok: false, error: 'Erreur serveur.' },
      { status: 500 }
    );
  }
}
