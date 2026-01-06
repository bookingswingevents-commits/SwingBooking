import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { getArtistIdentity } from '@/lib/artistIdentity';

export async function GET() {
  const debugContext: Record<string, any> = {};
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    debugContext.userId = user?.id ?? null;

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized', code: 'NO_USER' }, { status: 401 });
    }

    const identity = await getArtistIdentity(supabase as any);
    if (!identity.artistId) {
      return NextResponse.json({ ok: false, error: 'Artist not linked', code: 'NO_ARTIST_LINK' }, { status: 403 });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    debugContext.artistId = identity.artistId;
    debugContext.today = todayStr;

    const { data, error } = await supabase
      .from('residency_weeks')
      .select(
        'id, start_date_sun, end_date_sun, residencies(id, name, clients(name)), week_bookings!inner(id, artist_id, status)'
      )
      .eq('week_bookings.artist_id', identity.artistId)
      .eq('week_bookings.status', 'CONFIRMED')
      .gte('end_date_sun', todayStr)
      .order('start_date_sun', { ascending: true })
      .limit(100);

    if (error) {
      console.error('[artist/calendar] DB_ERROR', { error, ...debugContext });
      return NextResponse.json(
        { ok: false, error: 'Database error', code: 'DB_ERROR', details: error.message },
        { status: 500 }
      );
    }

    const { data: applied, error: appErr } = await supabase
      .from('residency_weeks')
      .select(
        'id, start_date_sun, end_date_sun, residencies(id, name, clients(name)), week_applications!inner(id, artist_id, status)'
      )
      .eq('week_applications.artist_id', identity.artistId)
      .eq('week_applications.status', 'APPLIED')
      .gte('end_date_sun', todayStr)
      .order('start_date_sun', { ascending: true })
      .limit(100);

    if (appErr) {
      console.error('[artist/calendar] DB_ERROR_APPLIED', { error: appErr, ...debugContext });
      return NextResponse.json(
        { ok: false, error: 'Database error', code: 'DB_ERROR', details: appErr.message },
        { status: 500 }
      );
    }

    console.log('[artist/calendar] CONFIRMED_RESIDENCIES', {
      today: todayStr,
      count: (data ?? []).length,
      appliedCount: (applied ?? []).length,
      artistId: identity.artistId,
    });

    const items = (data ?? []).map((row: any) => {
      const res = row.residencies;
      const clientName = Array.isArray(res?.clients)
        ? res?.clients[0]?.name
        : (res?.clients?.name ?? null);
      return {
        id: row.id,
        start_date_sun: row.start_date_sun,
        end_date_sun: row.end_date_sun,
        residency_id: res?.id ?? null,
        residency_name: res?.name ?? null,
        client_name: clientName,
        status: 'CONFIRMED',
      };
    });

    const appliedItems = (applied ?? []).map((row: any) => {
      const res = row.residencies;
      const clientName = Array.isArray(res?.clients)
        ? res?.clients[0]?.name
        : (res?.clients?.name ?? null);
      return {
        id: row.id,
        start_date_sun: row.start_date_sun,
        end_date_sun: row.end_date_sun,
        residency_id: res?.id ?? null,
        residency_name: res?.name ?? null,
        client_name: clientName,
        status: 'APPLIED',
      };
    });

    const map = new Map<string, any>();
    for (const it of items) map.set(it.id, it);
    for (const it of appliedItems) {
      if (!map.has(it.id)) map.set(it.id, it);
    }
    const merged = Array.from(map.values()).sort((a, b) =>
      a.start_date_sun < b.start_date_sun ? -1 : a.start_date_sun > b.start_date_sun ? 1 : 0
    );

    return NextResponse.json({ ok: true, items: merged });
  } catch (e: any) {
    console.error('[artist/calendar] UNHANDLED', { error: e, ...debugContext });
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Server error', code: 'UNHANDLED', details: e?.stack },
      { status: 500 }
    );
  }
}
