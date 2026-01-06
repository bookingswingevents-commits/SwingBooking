import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
};

const fmtDate = (date: Date) =>
  date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export async function GET(req: Request) {
  try {
    const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL');
    const anonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');

    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const rangeStart = searchParams.get('rangeStart');
    const rangeEnd = searchParams.get('rangeEnd');

    if (!role || (role !== 'venue' && role !== 'artist')) {
      return NextResponse.json({ ok: false, error: 'Paramètre role manquant' }, { status: 400 });
    }
    if (!rangeStart || !rangeEnd) {
      return NextResponse.json({ ok: false, error: 'rangeStart/rangeEnd requis' }, { status: 400 });
    }

    const authHeader =
      req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : '';
    if (!token) return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });

    const supa = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userRes, error: userErr } = await supa.auth.getUser(token);
    if (userErr || !userRes?.user)
      return NextResponse.json({ ok: false, error: 'Session invalide' }, { status: 401 });

    const userId = userRes.user.id;
    const email = userRes.user.email ?? '';

    // 1) Récupérer les request_ids selon le rôle
    let requestIds: string[] = [];
    if (role === 'venue') {
      const { data: reqs, error: reqErr } = await supa
        .from('booking_requests')
        .select('id')
        .or(`venue_id.eq.${userId},venue_contact_email.eq.${email}`);
      if (reqErr) return NextResponse.json({ ok: false, error: reqErr.message }, { status: 500 });
      requestIds = (Array.isArray(reqs) ? reqs : []).map((r: any) => r.id).filter(Boolean);
    } else {
      const { data: reqs, error: reqErr } = await supa
        .from('proposals')
        .select('request_id')
        .eq('artist_id', userId);
      if (reqErr) return NextResponse.json({ ok: false, error: reqErr.message }, { status: 500 });
      requestIds = (Array.isArray(reqs) ? reqs : []).map((r: any) => r.request_id).filter(Boolean);
    }

    if (!requestIds.length) {
      const emptyIcs = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';
      return new NextResponse(emptyIcs, {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="swingbooking.ics"',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // 2) Occurrences dans la plage
    const { data: occ, error: occErr } = await supa
      .from('booking_request_occurrences')
      .select(
        `
        id, date, start_time, duration_minutes, address_snapshot, request_id,
        booking_requests(
          id, title, formation, event_format, status, venue_address
        )
      `
      )
      .in('request_id', requestIds)
      .gte('date', rangeStart)
      .lte('date', rangeEnd);

    if (occErr) return NextResponse.json({ ok: false, error: occErr.message }, { status: 500 });

    const occurrences = Array.isArray(occ) ? occ : [];
    const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SwingBooking//Calendar//FR'];

    occurrences.forEach((o: any) => {
      const br = o.booking_requests || {};
      const startIso = `${o.date}T${o.start_time || '20:00'}:00`;
      const startDate = new Date(startIso);
      const endIso = new Date(startDate.getTime() + ((o.duration_minutes ?? 120) * 60000));
      const summary = `${br.title || 'Événement'} • ${br.formation?.toUpperCase() || ''}`;
      const loc = o.address_snapshot || br.venue_address || '';
      const desc = `Demande: ${br.id || o.request_id}\nLien: ${
        role === 'venue'
          ? `${process.env.NEXT_PUBLIC_SITE_URL || ''}/venue/requests/${br.id || o.request_id}`
          : `${process.env.NEXT_PUBLIC_SITE_URL || ''}/artist/requests/${br.id || o.request_id}`
      }`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${o.id}@SwingBooking`);
      lines.push(`DTSTAMP:${fmtDate(new Date())}`);
      lines.push(`DTSTART:${fmtDate(startDate)}`);
      lines.push(`DTEND:${fmtDate(endIso)}`);
      lines.push(`SUMMARY:${summary.replace(/\n/g, ' ')}`);
      if (loc) lines.push(`LOCATION:${loc.replace(/\n/g, ' ')}`);
      lines.push(`DESCRIPTION:${desc.replace(/\n/g, ' ')}`);
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');
    const ics = lines.join('\n');

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="swingbooking.ics"',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Erreur serveur' },
      { status: 500 }
    );
  }
}
