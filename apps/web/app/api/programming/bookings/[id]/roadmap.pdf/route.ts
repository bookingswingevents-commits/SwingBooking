import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { generateRoadmap } from '@/lib/programming/roadmap';
import { buildRoadmapPdf } from '@/lib/programming/pdf/roadmapPdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getArtistId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: byUser } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (byUser?.id) return byUser.id;

  const { data: byId } = await supabase
    .from('artists')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  return byId?.id ?? null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) return NextResponse.json({ ok: false, error: 'NO_USER' }, { status: 401 });

    const artistId = isAdmin ? null : await getArtistId();
    if (!isAdmin && !artistId) {
      return NextResponse.json({ ok: false, error: 'NOT_ARTIST' }, { status: 403 });
    }

    let bookingQuery = supabase
      .from('programming_bookings')
      .select('id, artist_id, status, option_json, conditions_snapshot_json, artists(stage_name), programming_items(id, item_type, start_date, end_date, status, metadata_json, programming_programs(id, name, program_type, conditions_json))')
      .eq('id', id);
    if (!isAdmin && artistId) bookingQuery = bookingQuery.eq('artist_id', artistId);
    const { data: booking } = await bookingQuery.maybeSingle();

    if (!booking) {
      return NextResponse.json({ ok: false, error: 'BOOKING_NOT_FOUND' }, { status: 404 });
    }

    const item = Array.isArray(booking.programming_items)
      ? booking.programming_items[0]
      : booking.programming_items;
    const program = Array.isArray(item?.programming_programs)
      ? item?.programming_programs[0]
      : item?.programming_programs;
    const artistRow = Array.isArray((booking as any)?.artists)
      ? (booking as any).artists[0]
      : (booking as any)?.artists;

    if (!item || !program) {
      return NextResponse.json({ ok: false, error: 'DATA_MISSING' }, { status: 404 });
    }

    const roadmap = generateRoadmap({
      program: {
        id: program.id,
        program_type: program.program_type,
        conditions_json: program.conditions_json ?? {},
      },
      item: {
        id: item.id,
        program_id: program.id,
        item_type: item.item_type,
        start_date: item.start_date,
        end_date: item.end_date,
        status: item.status,
        metadata_json: item.metadata_json ?? {},
      },
      booking: {
        id: booking.id,
        item_id: item.id,
        artist_id: booking.artist_id,
        status: booking.status,
        conditions_snapshot_json: booking.conditions_snapshot_json ?? {},
        option_json: booking.option_json ?? {},
        option: booking.option_json ?? null,
      },
    });

    const pdf = buildRoadmapPdf(
      {
        title: program.name ?? 'Roadmap',
        artistName: artistRow?.stage_name ?? null,
        period: `${item.start_date} → ${item.end_date}`,
      },
      roadmap
    );

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=roadmap-${booking.id}.pdf`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'SERVER_ERROR' }, { status: 500 });
  }
}
