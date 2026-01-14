'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR } from '@/lib/date';
import { labelForEventFormat } from '@/lib/event-formats';
import { getArtistIdentity } from '@/lib/artistIdentity';

type Formation = 'solo' | 'duo' | 'trio' | 'quartet' | 'dj';

type Roadmap = {
  id: string;
  request_id: string;
  proposal_id: string | null;
  created_at: string | null;
  title: string | null;
  target: string | null;
  booking_requests: {
    id: string;
    title: string | null;
    event_date: string | null;
    start_time: string | null;
    duration_minutes: number | null;
    event_format: string | null;
    formation: Formation | null;
    venue_address: string | null;
    venue_company_name: string | null;
  } | null;
};

type ResidencyRoadmap = {
  week_id: string;
  start_date_sun: string;
  end_date_sun: string;
  week_type: 'calm' | 'strong';
  week_status?: string | null;
  residency_id: string;
  residency_name: string;
  client_name?: string | null;
  template_id?: string | null;
  template_title?: string | null;
};

function fmtMinutes(m?: number | null) {
  if (m == null) return '—';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h}h${String(min).padStart(2, '0')}` : `${h}h`;
}

export default function ArtistRoadmapsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Roadmap[]>([]);
  const [residencyRows, setResidencyRows] = useState<ResidencyRoadmap[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.href = '/login';
          return;
        }
        const userId = session.user.id;
        const identity = await getArtistIdentity(supabase);
        const artistId = identity.artistId;
        const { data, error } = await supabase
          .from('itineraries')
          .select(
            `
            id, request_id, proposal_id, created_at, title, target,
            proposals!inner(artist_id),
            booking_requests(
              id, title, event_date, start_time, duration_minutes, event_format, formation, venue_address, venue_company_name
            )
          `
          )
          .eq('proposals.artist_id', userId)
          .eq('target', 'artist')
          .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);

        const list = (data ?? []) as unknown as Roadmap[];
        // Filtre payload vide et garde la plus récente par request_id
        const filtered = list.filter(
          (r: any) => r && r.request_id && r.booking_requests && Object.keys(r.booking_requests).length > 0
        );
        const dedup = new Map<string, Roadmap>();
        for (const r of filtered) {
          if (!dedup.has(r.request_id)) dedup.set(r.request_id, r);
        }
        setRows(Array.from(dedup.values()));

        if (artistId) {
          const { data: weekBookings } = await supabase
            .from('week_bookings')
            .select(
              'status, residency_week_id, residency_weeks(id, start_date_sun, end_date_sun, week_type, status, residency_id, residencies(id, name, clients(name)))'
            )
            .eq('artist_id', artistId)
            .eq('status', 'CONFIRMED')
            .order('created_at', { ascending: false });
          const weekRows = (weekBookings ?? [])
            .map((row: any) => ({
              week_id: row.residency_week_id,
              start_date_sun: row.residency_weeks?.start_date_sun,
              end_date_sun: row.residency_weeks?.end_date_sun,
              week_type: (row.residency_weeks?.week_type as 'calm' | 'strong') ?? 'calm',
              week_status: row.residency_weeks?.status,
              residency_id: row.residency_weeks?.residency_id,
              residency_name: row.residency_weeks?.residencies?.name ?? 'Programmation',
              client_name: Array.isArray(row.residency_weeks?.residencies?.clients)
                ? row.residency_weeks?.residencies?.clients?.[0]?.name
                : row.residency_weeks?.residencies?.clients?.name ?? null,
            }))
            .filter((r: any) => r.week_id && r.residency_id && r.week_status !== 'CANCELLED');

          const residencyIds = Array.from(new Set(weekRows.map((r: any) => r.residency_id)));
          let templates: any[] = [];
          if (residencyIds.length > 0) {
            const { data: tpl } = await supabase
              .from('roadmap_templates')
              .select('id, residency_id, week_type, title')
              .in('residency_id', residencyIds);
            templates = tpl ?? [];
          }

          const withTemplates = weekRows.map((r: any) => {
            const tpl =
              templates.find(
                (t) => t.residency_id === r.residency_id && t.week_type === r.week_type
              ) ??
              templates.find((t) => t.residency_id === r.residency_id && t.week_type === 'calm');
            return {
              ...r,
              template_id: tpl?.id ?? null,
              template_title: tpl?.title ?? null,
            } as ResidencyRoadmap;
          });

          setResidencyRows(withTemplates);
        }
      } catch (e: any) {
        setError(e?.message ?? 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-slate-500">Chargement des feuilles de route…</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Feuilles de route</h1>
          <p className="text-slate-600 text-sm">
            Tes prestations confirmées et leurs détails pratiques.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">← Retour</Link>
      </header>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Programmations confirmées</h2>
        {residencyRows.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
            Aucune feuille de route de résidence pour le moment.
          </div>
        ) : (
          <ul className="space-y-3">
            {residencyRows.map((r) => (
              <li key={r.week_id} className="border rounded-2xl p-4 hover:shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-semibold">{r.residency_name}</div>
                    <div className="text-sm text-slate-600">
                      {r.client_name ? `${r.client_name} • ` : ''}
                      {fmtDateFR(r.start_date_sun)} → {fmtDateFR(r.end_date_sun)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {r.week_type === 'strong' ? 'Semaine forte' : 'Semaine calme'}
                    </div>
                  </div>
                  <Link
                    href={`/artist/roadmaps/residencies/${r.week_id}`}
                    className="btn btn-primary"
                  >
                    Voir la feuille de route
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rows.length === 0 && residencyRows.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
          Aucune feuille de route pour le moment.
        </div>
      ) : rows.length > 0 ? (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="border rounded-2xl p-4 hover:shadow-sm space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-semibold">
                    {r.booking_requests?.title || r.title || 'Événement'}
                  </div>
                  <div className="text-sm text-slate-600">
                    {fmtDateFR(r.booking_requests?.event_date)} •{' '}
                    {r.booking_requests?.start_time || '—'} •{' '}
                    {fmtMinutes(r.booking_requests?.duration_minutes)}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                      {labelForEventFormat(r.booking_requests?.event_format)}
                    </span>
                    {r.booking_requests?.formation ? (
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                        {String(r.booking_requests?.formation).toUpperCase()}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {r.created_at ? `Générée le ${fmtDateFR(r.created_at)}` : null}
                </div>
              </div>

              {r.booking_requests?.venue_address && (
                <div className="text-sm">
                  <div className="text-slate-500">Lieu</div>
                  <div className="font-medium">{r.booking_requests.venue_address}</div>
                </div>
              )}

              <Link
                href={`/artist/requests/${r.request_id}`}
                className="inline-flex text-sm text-[var(--brand)] underline"
              >
                Voir la demande
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
