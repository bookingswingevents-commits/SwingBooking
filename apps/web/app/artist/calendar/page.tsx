'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { labelForEventFormat } from '@/lib/event-formats';
import { CalendarView, CalendarEvent } from '@/components/calendar/CalendarView';
import {
  CalendarFilters,
  CalendarFiltersState,
} from '@/components/calendar/CalendarFilters';

type Formation = 'solo' | 'duo' | 'trio' | 'quartet' | 'dj' | string | null;

type OccurrenceRow = {
  id: string;
  date: string;
  start_time: string | null;
  duration_minutes?: number | null;
  address_snapshot: string | null;
  request_id: string;
};
type RequestMap = Record<
  string,
  {
    id: string;
    title: string | null;
    event_format: string | null;
    formation: Formation;
    status: string | null;
    venue_address: string | null;
    venue_company_name: string | null;
  }
>;
type ProposalMap = Record<string, { id: string; status?: string | null }>;

type ResidencyItem = {
  id: string;
  start_date_sun: string;
  end_date_sun: string;
  residency_id: string | null;
  residency_name: string | null;
  client_name: string | null;
  status: 'CONFIRMED' | 'APPLIED';
};

const addMinutes = (isoStart: string, minutes?: number | null) => {
  const d = new Date(isoStart);
  d.setMinutes(d.getMinutes() + (minutes ?? 120));
  return d.toISOString();
};

export default function ArtistCalendarPage() {
  const [rows, setRows] = useState<OccurrenceRow[]>([]);
  const [requestsById, setRequestsById] = useState<RequestMap>({});
  const [proposalByRequestId, setProposalByRequestId] = useState<ProposalMap>({});
  const [residencyItems, setResidencyItems] = useState<ResidencyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CalendarFiltersState>({
    search: '',
    status: '',
    formation: '',
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/artist/calendar', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`Erreur agenda (${res.status})`);
        }
        const json = await res.json();
        setRows(Array.isArray(json.occurrences) ? json.occurrences : []);
        setRequestsById(json.requestsById || {});
        setProposalByRequestId(json.proposalByRequestId || {});
        setResidencyItems(Array.isArray(json.items) ? json.items : []);
      } catch (e: any) {
        setError(e?.message ?? 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const events: CalendarEvent[] = useMemo(() => {
    const base: CalendarEvent[] = [];
    (rows ?? []).forEach((o) => {
      const br = requestsById[o.request_id];
      if (!br) return;
      const startIso = `${o.date}T${o.start_time || '20:00'}`;
      const propStatus = proposalByRequestId[o.request_id]?.status ?? null;
      const status = propStatus || br.status || 'scheduled';
      base.push({
        id: o.id,
        title: `${br.title || 'Événement'} • ${br.formation?.toUpperCase() || ''}`,
        start: startIso,
        end: addMinutes(startIso, o.duration_minutes),
        url: `/artist/requests/${br.id}`,
        status,
        formation: br.formation || undefined,
        venueName: br.venue_company_name || br.venue_address || '',
      });
    });
    (residencyItems ?? []).forEach((r) => {
      base.push({
        id: `res-${r.id}`,
        title: `${r.residency_name || 'Résidence'}${r.client_name ? ` • ${r.client_name}` : ''}`,
        start: `${r.start_date_sun}T00:00`,
        end: `${r.end_date_sun}T00:00`,
        url: r.residency_id ? `/artist/programming/${r.residency_id}` : undefined,
        status: r.status === 'CONFIRMED' ? 'confirmed' : 'pending',
        venueName: r.client_name || '',
      });
    });
    return base;
  }, [rows, residencyItems]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (filters.status && (ev.status || '').toLowerCase() !== filters.status.toLowerCase())
        return false;
      if (filters.formation && (ev.formation || '').toLowerCase() !== filters.formation.toLowerCase())
        return false;
      if (filters.search) {
        const hay = `${ev.title} ${ev.venueName || ''}`.toLowerCase();
        if (!hay.includes(filters.search.toLowerCase())) return false;
      }
      return true;
    });
  }, [events, filters]);

  if (loading) return <div className="text-slate-500">Chargement de l’agenda…</div>;
  if (error) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Agenda</h1>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agenda artiste</h1>
          <p className="text-slate-600 text-sm">Occurrences à venir pour tes demandes.</p>
        </div>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </header>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-sm px-3 py-2 rounded-lg border"
            onClick={() => {
              const today = new Date();
              const start = today.toISOString().slice(0, 10);
              const end = new Date(today.getTime() + 90 * 86400000).toISOString().slice(0, 10);
              const url = `/api/calendar/ics?role=artist&rangeStart=${start}&rangeEnd=${end}`;
              window.location.href = url;
            }}
          >
            Exporter iCal (90j)
          </button>
        </div>
        <CalendarFilters filters={filters} onChange={setFilters} />
        {filteredEvents.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
            Aucun événement à venir (filtre ou planning vide).
          </div>
        ) : null}
        <CalendarView events={filteredEvents} />
      </div>
    </div>
  );
}
