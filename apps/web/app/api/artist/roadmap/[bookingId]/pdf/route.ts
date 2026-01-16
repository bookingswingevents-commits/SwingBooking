import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { getArtistIdentity } from '@/lib/artistIdentity';
import { buildRoadmapData, roadmapToLines } from '@/lib/roadmap';
import { fmtDateFR } from '@/lib/date';
import { renderSimplePdf } from '@/lib/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mapWeekType(value?: string | null) {
  if (value === 'strong') return 'PEAK' as const;
  if (value === 'calm') return 'CALM' as const;
  return null;
}

export async function GET(req: Request, context: { params: { bookingId: string } }) {
  try {
    const bookingId = context.params?.bookingId;
    if (!bookingId) {
      return NextResponse.json({ ok: false, error: 'BOOKING_ID_REQUIRED' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const identity = await getArtistIdentity(supabase);
    if (!identity.artistId) {
      return NextResponse.json({ ok: false, error: 'NOT_ARTIST' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('week_bookings')
      .select(
        'id, artist_id, status, residency_week_id, residency_weeks(id, start_date_sun, end_date_sun, week_type, residencies(id, name, program_type, conditions_json, roadmap_overrides_json, clients(name)))'
      )
      .eq('id', bookingId)
      .eq('artist_id', identity.artistId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: 'BOOKING_NOT_FOUND' }, { status: 404 });
    }
    if (data.status !== 'CONFIRMED') {
      return NextResponse.json({ ok: false, error: 'BOOKING_NOT_CONFIRMED' }, { status: 403 });
    }

    const week = data.residency_weeks?.[0];
    if (!week) {
      return NextResponse.json({ ok: false, error: 'WEEK_NOT_FOUND' }, { status: 404 });
    }

    const residency = week.residencies?.[0];
    if (!residency) {
      return NextResponse.json({ ok: false, error: 'RESIDENCY_NOT_FOUND' }, { status: 404 });
    }

    const contextLabel = `${fmtDateFR(week.start_date_sun)} → ${fmtDateFR(week.end_date_sun)}`;
    const roadmap = buildRoadmapData({
      residencyName: residency.name ?? 'Programmation',
      contextLabel,
      programType: residency.program_type ?? 'WEEKLY_RESIDENCY',
      weekType: mapWeekType(week.week_type),
      conditions: (residency.conditions_json ?? {}) as any,
      overrides: (residency.roadmap_overrides_json ?? {}) as any,
    });

    const lines = roadmapToLines(roadmap);
    const pdf = renderSimplePdf(lines);

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=feuille-de-route-${week.id}.pdf`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'SERVER_ERROR' }, { status: 500 });
  }
}
