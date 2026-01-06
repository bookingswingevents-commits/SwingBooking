'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseBrowser';
import { CalendarView, CalendarEvent } from '@/components/calendar/CalendarView';
import {
  CalendarFilters,
  CalendarFiltersState,
} from '@/components/calendar/CalendarFilters';

type Formation = 'solo' | 'duo' | 'trio' | 'quartet' | 'dj' | string | null;

type BookingRequestRow = {
  id: string;
  title: string | null;
  event_format: string | null;
  formation: Formation;
  status: string | null;
  venue_address: string | null;
  venue_company_name: string | null;
};

type OccurrenceRow = {
  id: string;
  date: string;
  start_time: string | null;
  duration_minutes?: number | null;
  address_snapshot: string | null;
  request_id: string;
  booking_requests: BookingRequestRow | BookingRequestRow[] | null;
};

const addMinutes = (isoStart: string, minutes?: number | null) => {
  const d = new Date(isoStart);
  d.setMinutes(d.getMinutes() + (minutes ?? 120));
  return d.toISOString();
};

export default function AdminCalendarPage() {
  const router = useRouter();
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
          router.push('/login');
          return;
        }

        // Vérif rôle admin
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profErr || prof?.role !== 'admin') {
          setError('Accès refusé (admin requis).');
          setLoading(false);
          return;
        }

        const today = new Date();
        const rangeStart = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
        const rangeEnd = new Date(today.getTime() + 180 * 86400000).toISOString().slice(0, 10);

        const { data, error: occErr } = await supabase
          .from('booking_request_occurrences')
          .select(
            `
            id, date, start_time, duration_minutes, address_snapshot, request_id,
            booking_requests(
              id, title, event_format, formation, status,
              venue_address, venue_company_name
            )
          `
          )
          .gte('date', rangeStart)
          .lte('date', rangeEnd)
          .order('date', { ascending: true });

        if (occErr) throw new Error(occErr.message);
        const occArray: OccurrenceRow[] = Array.isArray(data) ? data : [];
        const normalized = occArray
          .map((o) => {
            const br = Array.isArray(o.booking_requests)
              ? o.booking_requests[0] ?? null
              : o.booking_requests ?? null;
            return { ...o, booking_requests: br };
          })
          .filter((o) => o.booking_requests);
        setRows(normalized as OccurrenceRow[]);
      } catch (e: any) {
        setError(e?.message ?? 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const events: CalendarEvent[] = useMemo(() => {
    const base: CalendarEvent[] = [];
    (rows ?? []).forEach((o) => {
      const br = o.booking_requests;
      const brRow = Array.isArray(br) ? br[0] ?? null : br;
      if (!brRow) return;
      const startIso = `${o.date}T${o.start_time || '20:00'}`;
      base.push({
        id: o.id,
        title: `${brRow.event_format || 'Événement'} — ${brRow.formation?.toUpperCase() || ''} — ${brRow.venue_company_name || ''}`,
        start: startIso,
        end: addMinutes(startIso, o.duration_minutes),
        url: `/admin/requests/${brRow.id}`,
        status: brRow.status || undefined,
        venueName: brRow.venue_company_name || brRow.venue_address || '',
        formation: brRow.formation || undefined,
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
      if (
        filters.venue &&
        (ev.venueName || '').toLowerCase().indexOf(filters.venue.toLowerCase()) === -1
      )
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
        <h1 className="text-2xl font-bold">Agenda admin</h1>
        <p className="text-red-600">{error}</p>
        <Link href="/login" className="text-sm underline text-[var(--brand)]">
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agenda admin</h1>
          <p className="text-slate-600 text-sm">Vue globale des demandes à venir.</p>
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
              const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
              const end = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
              const url = `/api/calendar/ics?role=admin&rangeStart=${start}&rangeEnd=${end}`;
              window.location.href = url;
            }}
          >
            Exporter iCal (6 mois)
          </button>
        </div>
        <CalendarFilters filters={filters} onChange={setFilters} />
        {filteredEvents.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
            Aucun événement dans la période (ou filtre actif).
          </div>
        ) : null}
        <CalendarView events={filteredEvents} />
      </div>
    </div>
  );
}
