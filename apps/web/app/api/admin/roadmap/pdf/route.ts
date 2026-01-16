import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { buildRoadmapData, roadmapToLines } from '@/lib/roadmap';
import { renderSimplePdf } from '@/lib/pdf';
import { fmtDateFR } from '@/lib/date';
import { LEGACY_RESIDENCIES_DISABLED } from '@/lib/featureFlags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mapWeekType(value?: string | null) {
  if (value === 'strong') return 'PEAK' as const;
  if (value === 'calm') return 'CALM' as const;
  return null;
}

export async function GET(req: Request) {
  try {
    if (LEGACY_RESIDENCIES_DISABLED) {
      return NextResponse.json(
        { ok: false, error: 'LEGACY_RESIDENCIES_DISABLED' },
        { status: 503 }
      );
    }
    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_USER' }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'NOT_ADMIN' }, { status: 403 });
    }

    const url = new URL(req.url);
    const residencyId = url.searchParams.get('residency_id');
    const weekId = url.searchParams.get('week_id');
    const date = url.searchParams.get('date');

    if (!residencyId || (!weekId && !date)) {
      return NextResponse.json({ ok: false, error: 'INVALID_PARAMS' }, { status: 400 });
    }

    if (weekId) {
      const { data: week, error } = await supabase
        .from('residency_weeks')
        .select('id, start_date_sun, end_date_sun, week_type, residencies(id, name, program_type, conditions_json, roadmap_overrides_json)')
        .eq('id', weekId)
        .eq('residency_id', residencyId)
        .maybeSingle();
      if (error || !week) {
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

      const pdf = renderSimplePdf(roadmapToLines(roadmap));
      return new NextResponse(pdf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=feuille-de-route-${week.id}.pdf`,
        },
      });
    }

    if (date) {
      const { data: residency, error: resErr } = await supabase
        .from('residencies')
        .select('id, name, program_type, conditions_json, roadmap_overrides_json')
        .eq('id', residencyId)
        .maybeSingle();
      if (resErr || !residency) {
        return NextResponse.json({ ok: false, error: 'RESIDENCY_NOT_FOUND' }, { status: 404 });
      }

      const { data: occurrence } = await supabase
        .from('residency_occurrences')
        .select('id, date')
        .eq('residency_id', residencyId)
        .eq('date', date)
        .maybeSingle();
      if (!occurrence) {
        return NextResponse.json({ ok: false, error: 'DATE_NOT_FOUND' }, { status: 404 });
      }

      const contextLabel = fmtDateFR(date);
      const roadmap = buildRoadmapData({
        residencyName: residency.name ?? 'Programmation',
        contextLabel,
        programType: residency.program_type ?? 'MULTI_DATES',
        conditions: (residency.conditions_json ?? {}) as any,
        overrides: (residency.roadmap_overrides_json ?? {}) as any,
      });

      const pdf = renderSimplePdf(roadmapToLines(roadmap));
      return new NextResponse(pdf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=feuille-de-route-${residency.id}-${date}.pdf`,
        },
      });
    }

    return NextResponse.json({ ok: false, error: 'INVALID_PARAMS' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'SERVER_ERROR' }, { status: 500 });
  }
}
