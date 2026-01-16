import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { LEGACY_RESIDENCIES_DISABLED } from '@/lib/featureFlags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Variables d'environnement manquantes: ${name}`);
  return v;
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_USER' }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'NOT_ADMIN' }, { status: 403 });
    }
    if (LEGACY_RESIDENCIES_DISABLED) {
      return NextResponse.json({
        ok: true,
        counts: {
          programmations_actives: 0,
          programmations_ouvertes: 0,
          programmations_publiees: 0,
          demandes_ouvertes: 0,
          candidatures_en_attente: 0,
          artistes_confirmes_a_venir: 0,
          evenements_a_venir: 0,
        },
        actions: [],
      });
    }

    const supaSrv = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const todayStr = new Date().toISOString().slice(0, 10);

    const [
      residenciesActive,
      residenciesOpen,
      residenciesPublic,
      bookingOpen,
      pendingApps,
      confirmedApps,
      futureOccurrences,
      confirmedWeeks,
      futureWeeks,
    ] = await Promise.all([
      supaSrv
        .from('residencies')
        .select('id', { count: 'exact', head: true })
        .gte('end_date', todayStr),
      supaSrv
        .from('residencies')
        .select('id', { count: 'exact', head: true })
        .gte('end_date', todayStr)
        .eq('is_open', true),
      supaSrv
        .from('residencies')
        .select('id', { count: 'exact', head: true })
        .gte('end_date', todayStr)
        .eq('is_public', true),
      supaSrv
        .from('booking_requests')
        .select('id', { count: 'exact', head: true })
        .in('status', ['OPEN', 'PENDING', 'open', 'pending']),
      supaSrv
        .from('residency_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING'),
      supaSrv
        .from('residency_applications')
        .select('residency_id, date')
        .eq('status', 'CONFIRMED')
        .gte('date', todayStr),
      supaSrv
        .from('residency_occurrences')
        .select('residency_id, date')
        .gte('date', todayStr),
      supaSrv
        .from('residency_weeks')
        .select('residency_id, start_date_sun, week_bookings!inner(status)')
        .eq('week_bookings.status', 'CONFIRMED')
        .gte('start_date_sun', todayStr),
      supaSrv
        .from('residency_weeks')
        .select('residency_id, start_date_sun')
        .gte('start_date_sun', todayStr),
    ]);

    const confirmedAppSet = new Set(
      (confirmedApps.data ?? []).map((row: any) => `${row.residency_id}:${row.date}`)
    );
    const confirmedWeekSet = new Set(
      (confirmedWeeks.data ?? []).map(
        (row: any) => `${row.residency_id}:${row.start_date_sun}`
      )
    );
    const upcomingOccurrences = (futureOccurrences.data ?? []) as any[];
    const upcomingWeeks = (futureWeeks.data ?? []) as any[];

    const eventsUpcomingDates = upcomingOccurrences.filter((o: any) =>
      confirmedAppSet.has(`${o.residency_id}:${o.date}`)
    ).length;
    const eventsUpcomingWeeks = upcomingWeeks.filter((w: any) =>
      confirmedWeekSet.has(`${w.residency_id}:${w.start_date_sun}`)
    ).length;

    const confirmedArtistsUpcoming =
      (confirmedApps.data ?? []).length + (confirmedWeeks.data ?? []).length;

    const actions: Array<{ title: string; description: string; href: string; count: number }> = [];

    const { data: pendingAppsRows } = await supaSrv
      .from('residency_applications')
      .select('id, date, residency_id, residencies(name)')
      .eq('status', 'PENDING')
      .order('date', { ascending: true })
      .limit(10);
    if ((pendingAppsRows ?? []).length > 0) {
      actions.push({
        title: 'Candidatures artistes en attente',
        description: 'Valider ou refuser les candidatures reçues.',
        href: '/admin/programmations',
        count: pendingAppsRows?.length ?? 0,
      });
    }

    const futureResidencyIds = new Set<string>();
    (upcomingOccurrences ?? []).forEach((o: any) => futureResidencyIds.add(o.residency_id));
    (upcomingWeeks ?? []).forEach((w: any) => futureResidencyIds.add(w.residency_id));

    const confirmedResidencyIds = new Set<string>();
    (confirmedApps.data ?? []).forEach((row: any) => confirmedResidencyIds.add(row.residency_id));
    (confirmedWeeks.data ?? []).forEach((row: any) => confirmedResidencyIds.add(row.residency_id));

    const residenciesWithoutConfirmed = Array.from(futureResidencyIds).filter(
      (id) => !confirmedResidencyIds.has(id)
    );

    if (residenciesWithoutConfirmed.length > 0) {
      actions.push({
        title: 'Programmations ouvertes sans artiste confirmé',
        description: 'Des dates futures sont encore sans confirmation.',
        href: '/admin/programmations',
        count: residenciesWithoutConfirmed.length,
      });
    }

    const { data: openRequests } = await supaSrv
      .from('booking_requests')
      .select('id, title')
      .in('status', ['OPEN', 'PENDING', 'open', 'pending'])
      .order('created_at', { ascending: false })
      .limit(10);
    const requestIds = (openRequests ?? []).map((r: any) => r.id);
    const { data: proposalRows } = requestIds.length
      ? await supaSrv.from('proposals').select('request_id').in('request_id', requestIds)
      : { data: [] as any[] };
    const proposalSet = new Set((proposalRows ?? []).map((p: any) => p.request_id));
    const openWithoutProposal = (openRequests ?? []).filter((r: any) => !proposalSet.has(r.id));
    if (openWithoutProposal.length > 0) {
      actions.push({
        title: 'Demandes sans proposition',
        description: 'Créer une proposition pour ces demandes.',
        href: '/admin/requests',
        count: openWithoutProposal.length,
      });
    }

    return NextResponse.json({
      ok: true,
      counts: {
        programmations_actives: residenciesActive.count ?? 0,
        programmations_ouvertes: residenciesOpen.count ?? 0,
        programmations_publiees: residenciesPublic.count ?? 0,
        demandes_ouvertes: bookingOpen.count ?? 0,
        candidatures_en_attente: pendingApps.count ?? 0,
        artistes_confirmes_a_venir: confirmedArtistsUpcoming,
        evenements_a_venir: eventsUpcomingDates + eventsUpcomingWeeks,
      },
      actions: actions.slice(0, 5),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
