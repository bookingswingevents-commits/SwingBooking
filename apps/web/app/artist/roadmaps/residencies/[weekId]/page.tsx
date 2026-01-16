'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR } from '@/lib/date';
import { getArtistIdentity } from '@/lib/artistIdentity';
import RoadmapPreview from '@/components/RoadmapPreview';
import { buildRoadmapData, ConditionsJson, RoadmapOverrides } from '@/lib/roadmap';
import { LEGACY_RESIDENCIES_DISABLED } from '@/lib/featureFlags';

type WeekRow = {
  id: string;
  start_date_sun: string;
  end_date_sun: string;
  week_type?: 'calm' | 'strong' | null;
  status?: string | null;
  residencies: {
    id: string;
    name: string;
    program_type?: 'MULTI_DATES' | 'WEEKLY_RESIDENCY' | null;
    conditions_json?: ConditionsJson | null;
    roadmap_overrides_json?: RoadmapOverrides | null;
    clients?: { name: string }[] | null;
  }[] | null;
};

type BookingRow = {
  id: string;
};

function mapWeekType(value?: string | null) {
  if (value === 'strong') return 'PEAK' as const;
  if (value === 'calm') return 'CALM' as const;
  return null;
}

export default function ArtistResidencyRoadmapPage() {
  const params = useParams<{ weekId: string }>();
  const weekId = params?.weekId;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [week, setWeek] = useState<WeekRow | null>(null);
  const [booking, setBooking] = useState<BookingRow | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');
        if (LEGACY_RESIDENCIES_DISABLED) {
          setError('Module de programmation indisponible.');
          return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }
        const identity = await getArtistIdentity(supabase);
        if (!identity.artistId) {
          setError('Votre compte artiste n’est pas relié.');
          return;
        }

        const { data: bookingRow } = await supabase
          .from('week_bookings')
          .select(
            'id, status, residency_week_id, residency_weeks!inner(id, start_date_sun, end_date_sun, week_type, status, residencies(id, name, program_type, conditions_json, roadmap_overrides_json, clients(name)))'
          )
          .eq('artist_id', identity.artistId)
          .eq('status', 'CONFIRMED')
          .eq('residency_week_id', weekId)
          .maybeSingle();
        const wk = bookingRow?.residency_weeks?.[0] ?? null;
        if (!wk) {
          setError('Aucune feuille de route disponible pour cette semaine.');
          return;
        }
        if (wk.status === 'CANCELLED') {
          setError('Cette semaine a été annulée.');
          return;
        }
        setWeek(wk);
        setBooking(bookingRow?.id ? { id: bookingRow.id } : null);
      } catch (e: any) {
        setError(e?.message ?? 'Erreur de chargement.');
      } finally {
        setLoading(false);
      }
    })();
  }, [weekId, router]);

  const clientName = useMemo(() => {
    const res = week?.residencies?.[0];
    return res?.clients?.[0]?.name ?? null;
  }, [week]);

  const roadmapData = useMemo(() => {
    if (!week) return null;
    const residency = week.residencies?.[0];
    if (!residency) return null;
    return buildRoadmapData({
      residencyName: residency.name ?? 'Programmation',
      contextLabel: `${fmtDateFR(week.start_date_sun)} → ${fmtDateFR(week.end_date_sun)}`,
      programType: residency.program_type ?? 'WEEKLY_RESIDENCY',
      weekType: mapWeekType(week.week_type),
      conditions: (residency.conditions_json ?? {}) as ConditionsJson,
      overrides: (residency.roadmap_overrides_json ?? {}) as RoadmapOverrides,
    });
  }, [week]);

  if (loading) return <div className="text-slate-500">Chargement…</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Feuille de route</h1>
          {week ? (
            <p className="text-sm text-slate-600">
              {week.residencies?.[0]?.name ?? 'Programmation'}
              {clientName ? ` • ${clientName}` : ''} •{' '}
              {fmtDateFR(week.start_date_sun)} → {fmtDateFR(week.end_date_sun)}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {booking?.id ? (
            <a
              href={`/api/artist/roadmap/${booking.id}/pdf`}
              className="btn"
              target="_blank"
              rel="noreferrer"
            >
              Exporter PDF
            </a>
          ) : null}
          <Link href="/artist/roadmaps" className="text-sm underline text-[var(--brand)]">
            ← Retour
          </Link>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
          {error}
        </div>
      ) : null}

      {roadmapData ? <RoadmapPreview data={roadmapData} /> : null}
    </div>
  );
}
