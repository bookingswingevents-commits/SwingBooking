'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseBrowser';
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
  booking_requests: {
    id: string;
    title: string | null;
    event_format: string | null;
    formation: Formation;
    status: string | null;
    venue_address: string | null;
    venue_company_name: string | null;
    venue_contact_email: string | null;
    venue_id: string | null;
  } | null;
};

const addMinutes = (isoStart: string, minutes?: number | null) => {
  const d = new Date(isoStart);
  d.setMinutes(d.getMinutes() + (minutes ?? 120));
  return d.toISOString();
};

export default function VenueCalendarPage() {
  const [rows, setRows] = useState<OccurrenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CalendarFiltersState>({
    search: '',
    status: '',
    formation: '',
    venue: '',
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Connectez-vous pour voir votre agenda.');
          setLoading(false);
          return;
        }
        const today = new Date().toISOString().slice(0, 10);
        const email = session.user.email ?? '';
        const userId = session.user.id;

        // 1) Récupérer les demandes du client (id)
        const { data: reqs, error: reqErr } = await supabase
          .from('booking_requests')
          .select('id')
          .or(`venue_id.eq.${userId},venue_contact_email.eq.${email}`);
        if (reqErr) throw new Error(reqErr.message);
        const ids = (Array.isArray(reqs) ? reqs : []).map((r: any) => r.id).filter(Boolean);
        if (ids.length === 0) {
          setRows([]);
          return;
        }

        // 2) Occurrences à venir
        const { data, error: occErr } = await supabase
          .from('booking_request_occurrences')
          .select(
            `
            id, date, start_time, duration_minutes, address_snapshot, request_id,
            booking_requests(
              id, title, event_format, formation, status,
              venue_address, venue_company_name, venue_contact_email, venue_id
            )
          `
          )
          .gte('date', today)
          .in('request_id', ids)
          .order('date', { ascending: true });

        if (occErr) throw new Error(occErr.message);
        const occArray = (Array.isArray(data) ? data : []) as unknown as OccurrenceRow[];
        const list = occArray.filter(
          (o: any) => o.booking_requests && Object.keys(o.booking_requests).length > 0
        ) as OccurrenceRow[];
        setRows(list);
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
      const br = o.booking_requests;
      if (!br) return;
      const startIso = `${o.date}T${o.start_time || '20:00'}`;
      base.push({
        id: o.id,
        title: `${br.title || 'Événement'} • ${br.formation?.toUpperCase() || ''}`,
        start: startIso,
        end: addMinutes(startIso, o.duration_minutes),
        url: `/venue/requests/${br.id}`,
        status: br.status || undefined,
        venueName: br.venue_company_name || br.venue_address || '',
        formation: br.formation || undefined,
      });
    });
    return base;
  }, [rows]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (filters.status && (ev.status || '').toLowerCase() !== filters.status.toLowerCase())
        return false;
      if (filters.formation && (ev.formation || '').toLowerCase() !== filters.formation.toLowerCase())
        return false;
      if (filters.venue && (ev.venueName || '').toLowerCase().indexOf(filters.venue.toLowerCase()) === -1)
        return false;
      if (
        filters.search &&
        !(
          ev.title.toLowerCase().includes(filters.search.toLowerCase()) ||
          (ev.venueName || '').toLowerCase().includes(filters.search.toLowerCase())
        )
      )
        return false;
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
          <h1 className="text-2xl font-bold">Agenda établissement</h1>
          <p className="text-slate-600 text-sm">Occurrences à venir pour vos demandes.</p>
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
              const url = `/api/calendar/ics?role=venue&rangeStart=${start}&rangeEnd=${end}`;
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
