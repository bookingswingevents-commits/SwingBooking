import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { generateRoadmap } from '@/lib/programming/roadmap';
import { renderSimplePdf } from '@/lib/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function roadmapToLines(output: ReturnType<typeof generateRoadmap>): string[] {
  const lines: string[] = [];
  const pushSection = (title: string, entries: { label: string; value: string }[]) => {
    if (!entries.length) return;
    lines.push(title.toUpperCase());
    entries.forEach((entry) => {
      const label = entry.label ? `${entry.label}: ` : '';
      lines.push(`- ${label}${entry.value}`.trim());
    });
    lines.push('');
  };

  if (output.schedule.length) {
    lines.push('PLANNING');
    output.schedule.forEach((entry) => {
      const parts = [entry.date, entry.time].filter(Boolean).join(' ');
      const place = entry.place ? ` - ${entry.place}` : '';
      lines.push(`- ${parts}${place}`.trim());
      if (entry.notes) lines.push(`  ${entry.notes}`);
    });
    lines.push('');
  }

  pushSection('Frais', output.fees);
  pushSection('Lieux', output.venues);
  pushSection('Logement', output.lodging);
  pushSection('Repas', output.meals);
  pushSection('Logistique', output.logistics);
  pushSection('Contacts', output.contacts);

  return lines.filter((line, idx, arr) => {
    if (line !== '') return true;
    return idx === 0 || arr[idx - 1] !== '';
  });
}

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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_USER' }, { status: 401 });
    }

    const artistId = await getArtistId();
    if (!artistId) {
      return NextResponse.json({ ok: false, error: 'NOT_ARTIST' }, { status: 403 });
    }

    const { data: booking } = await supabase
      .from('programming_bookings')
      .select('id, artist_id, status, option_json, conditions_snapshot_json, programming_items(id, item_type, start_date, end_date, status, metadata_json, programming_programs(id, program_type, conditions_json))')
      .eq('id', id)
      .eq('artist_id', artistId)
      .maybeSingle();

    if (!booking) {
      return NextResponse.json({ ok: false, error: 'BOOKING_NOT_FOUND' }, { status: 404 });
    }

    const item = Array.isArray(booking.programming_items)
      ? booking.programming_items[0]
      : booking.programming_items;
    const program = Array.isArray(item?.programming_programs)
      ? item?.programming_programs[0]
      : item?.programming_programs;

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

    const lines = roadmapToLines(roadmap);
    const pdf = renderSimplePdf(lines);

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
