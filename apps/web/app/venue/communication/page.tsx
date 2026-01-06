'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR, statusFR } from '@/lib/date';
import { labelForEventFormat } from '@/lib/event-formats';

type BookingRequest = {
  id: string;
  title: string;
  status: string;
  event_date: string | null;
  event_format?: string | null;
  formation?: string | null;
};

type Occurrence = {
  id: string;
  request_id: string;
  date: string | null;
  start_time?: string | null;
  address_snapshot?: string | null;
};

type CommunicationRequest = {
  id: string;
  request_id: string;
  status: string;
  notes: string | null;
  created_at: string;
  booking_requests?: BookingRequest | null;
};

export default function CommunicationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [commRequests, setCommRequests] = useState<CommunicationRequest[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLastError(null);
      const {
        data: { session },
        error: sessErr,
      } = await supabase.auth.getSession();
      if (sessErr) {
        setLastError(sessErr.message);
        setLoading(false);
        return;
      }
      if (!session) {
        router.push('/login');
        return;
      }
      const uid = session.user.id;
      const email = session.user.email ?? '';

      // Vérifier rôle venue
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .maybeSingle();
      if (prof?.role !== 'venue') {
        router.push('/');
        return;
      }

      // Charger les demandes du client
      const { data: reqs, error: reqErr } = await supabase
        .from('booking_requests')
        .select('id, title, status, event_date, event_format, formation')
        .eq('venue_id', uid)
        .order('created_at', { ascending: false });
      if (reqErr) {
        setLastError(reqErr.message);
        setLoading(false);
        return;
      }
      const reqList = Array.isArray(reqs) ? (reqs as BookingRequest[]) : [];
      setRequests(reqList);

      // Occurrences liées
      if (reqList.length > 0) {
        const ids = reqList.map((r) => r.id);
        const { data: occs } = await supabase
          .from('booking_request_occurrences')
          .select('id, request_id, date, start_time, address_snapshot')
          .in('request_id', ids);
        setOccurrences(Array.isArray(occs) ? (occs as Occurrence[]) : []);
      }

      // Demandes "Tout passe par là"
      const { data: comms, error: commErr } = await supabase
        .from('communication_requests')
        .select(
          `
          id,
          request_id,
          status,
          notes,
          created_at,
          booking_requests ( id, title, status, event_date, event_format, formation )
        `
        )
        .or(`contact_email.eq.${email},requested_by_user_id.eq.${uid}`)
        .order('created_at', { ascending: false });
      if (commErr) {
        setLastError(commErr.message);
      } else {
        const unwrap = <T,>(v: T | T[] | null): T | null =>
          Array.isArray(v) ? (v[0] ?? null) : v ?? null;
        setCommRequests(
          (Array.isArray(comms) ? comms : []).map((c: any) => ({
            ...c,
            booking_requests: unwrap(c.booking_requests),
          }))
        );
      }

      setLoading(false);
    })();
  }, [router]);

  const nextDateByRequest = useMemo(() => {
    const map = new Map<string, string | null>();
    const today = new Date().toISOString().slice(0, 10);
    occurrences.forEach((occ) => {
      if (!occ.date) return;
      if (occ.date < today) return;
      const prev = map.get(occ.request_id);
      if (!prev || (prev && occ.date < prev)) {
        map.set(occ.request_id, occ.date);
      }
    });
    return map;
  }, [occurrences]);

  const kitsSorted = useMemo(() => {
    return [...requests].sort((a, b) => {
      const da = nextDateByRequest.get(a.id) ?? a.event_date ?? '';
      const db = nextDateByRequest.get(b.id) ?? b.event_date ?? '';
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da < db ? -1 : 1;
    });
  }, [requests, nextDateByRequest]);

  const counts = useMemo(() => {
    const kits = requests.length;
    const totalComm = commRequests.length;
    const pending = commRequests.filter((c) =>
      ['new', 'contacted'].includes(c.status)
    ).length;
    return { kits, totalComm, pending };
  }, [requests.length, commRequests]);

  if (loading) {
    return <div className="text-slate-500">Chargement…</div>;
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border bg-white p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Communication</h1>
          <p className="text-slate-600 text-sm">
            Préparez vos publications et suivez vos demandes de création de contenu.
          </p>
          {lastError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {lastError}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/venue/calendar" className="btn">
            Voir l’agenda
          </Link>
        </div>
      </header>

      {/* Bloc à faire */}
      <div className="grid md:grid-cols-3 gap-3">
        <StatCard label="Kits récents" value={counts.kits} />
        <StatCard label="Demandes envoyées à Tout passe par là" value={counts.totalComm} />
        <StatCard label="En attente (new/contacted)" value={counts.pending} />
      </div>

      {/* Kits de communication */}
      <section className="rounded-2xl border bg-white p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Kits de communication</h2>
          <span className="text-xs text-slate-500">{requests.length} demande(s)</span>
        </div>
        {requests.length === 0 ? (
          <p className="text-sm text-slate-600">Aucun kit de communication pour le moment.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {kitsSorted.map((r) => {
              const date = nextDateByRequest.get(r.id) ?? r.event_date;
              return (
                <article
                  key={r.id}
                  className="rounded-xl border p-4 space-y-2 hover:shadow-sm transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold line-clamp-1">{r.title || 'Demande'}</h3>
                    <Badge status={r.status} />
                  </div>
                  <div className="text-sm text-slate-600">
                    {fmtDateFR(date)} • {labelForEventFormat(r.event_format)} •{' '}
                    {r.formation?.toUpperCase() || 'Formation ?'}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Link
                      href={`/venue/requests/${r.id}/media-kit`}
                      className="btn btn-primary flex-1 text-center"
                    >
                      Ouvrir le kit
                    </Link>
                    <Link
                      href={`/venue/requests/${r.id}`}
                      className="btn flex-1 text-center"
                    >
                      Voir la demande
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Tout passe par là */}
      <section className="rounded-2xl border bg-white p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Tout passe par là</h2>
          <span className="text-xs text-slate-500">
            {commRequests.length} demande{commRequests.length > 1 ? 's' : ''}
          </span>
        </div>
        {commRequests.length === 0 ? (
          <p className="text-sm text-slate-600">Aucune demande envoyée pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4">Demande</th>
                  <th className="py-2 pr-4">Notes</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {commRequests.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="py-3 pr-4">{fmtDateFR(c.created_at)}</td>
                    <td className="py-3 pr-4">
                      <Badge status={c.status} />
                    </td>
                    <td className="py-3 pr-4">
                      {c.booking_requests?.title || c.request_id}
                    </td>
                    <td className="py-3 pr-4 max-w-[220px]">
                      <span className="line-clamp-2 text-slate-600">
                        {c.notes || '—'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 flex flex-wrap gap-2">
                      <Link
                        href={`/venue/requests/${c.request_id}`}
                        className="text-[13px] underline"
                      >
                        Voir la demande
                      </Link>
                      <Link
                        href={`/venue/requests/${c.request_id}/media-kit`}
                        className="text-[13px] underline text-[var(--brand)]"
                      >
                        Ouvrir le kit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-white p-4 space-y-1">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Badge({ status }: { status?: string | null }) {
  const map: Record<string, string> = {
    new: 'bg-amber-100 text-amber-700',
    contacted: 'bg-blue-100 text-blue-700',
    scheduled: 'bg-indigo-100 text-indigo-700',
    delivered: 'bg-emerald-100 text-emerald-700',
    proposal_sent: 'bg-blue-100 text-blue-700',
    waiting_client: 'bg-amber-100 text-amber-700',
    pending_client: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-emerald-100 text-emerald-700',
    accepted: 'bg-emerald-100 text-emerald-700',
    booked: 'bg-emerald-100 text-emerald-700',
    done: 'bg-slate-200 text-slate-700',
    archived: 'bg-slate-200 text-slate-700',
    cancelled: 'bg-slate-200 text-slate-700',
  };
  const cls = map[status ?? ''] ?? 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${cls}`}>
      {statusFR(status ?? 'en_cours')}
    </span>
  );
}
