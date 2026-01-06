'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR } from '@/lib/date';
import { labelForEventFormat } from '@/lib/event-formats';

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

function fmtMinutes(m?: number | null) {
  if (m == null) return '—';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h}h${String(min).padStart(2, '0')}` : `${h}h`;
}

export default function ArtistRoadmapsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Roadmap[]>([]);
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
        const artistId = session.user.id;
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
          .eq('proposals.artist_id', artistId)
          .eq('target', 'artist')
          .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);

        const list = (data ?? []) as Roadmap[];
        // Filtre payload vide et garde la plus récente par request_id
        const filtered = list.filter(
          (r: any) => r && r.request_id && r.booking_requests && Object.keys(r.booking_requests).length > 0
        );
        const dedup = new Map<string, Roadmap>();
        for (const r of filtered) {
          if (!dedup.has(r.request_id)) dedup.set(r.request_id, r);
        }
        setRows(Array.from(dedup.values()));
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

      {rows.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
          Aucune feuille de route pour le moment.
        </div>
      ) : (
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
      )}
    </div>
  );
}
