'use client';

import { useEffect, useMemo, useState } from 'react';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR } from '@/lib/date';
import { labelForStatus } from '@/lib/i18n';
import { getArtistIdentity } from '@/lib/artistIdentity';

type ResidencyRow = {
  id: string;
  name: string;
  mode?: 'RANGE' | 'DATES' | null;
  start_date: string;
  end_date: string;
  terms_mode?: 'SIMPLE_FEE' | 'INCLUDED' | 'WEEKLY' | 'RESIDENCY_WEEKLY' | null;
  fee_amount_cents?: number | null;
  fee_currency?: string | null;
  fee_is_net?: boolean | null;
  lodging_included: boolean;
  meals_included: boolean;
  companion_included: boolean;
  is_public: boolean;
  is_open: boolean;
  clients?: { name: string } | { name: string }[] | null;
};

type ResidencyWeek = {
  id: string;
  start_date_sun: string;
  end_date_sun: string;
  type: 'CALM' | 'BUSY';
  performances_count: number;
  fee_cents: number;
  status: 'OPEN' | 'CONFIRMED';
  week_bookings?: WeekBooking[] | WeekBooking | null;
};

type WeekApplication = {
  id: string;
  residency_week_id: string;
  status: 'APPLIED' | 'WITHDRAWN' | 'REJECTED';
};

type WeekBooking = {
  id: string;
  artist_id: string;
  status: 'CONFIRMED' | 'CANCELLED';
};

type ResidencyOccurrence = {
  id: string;
  date: string;
};

const formatMoney = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);

const toArray = <T,>(v: T[] | T | null | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);

export default function ArtistProgrammationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: residencyId } = React.use(params);
  const router = useRouter();
  const [residency, setResidency] = useState<ResidencyRow | null>(null);
  const [weeks, setWeeks] = useState<ResidencyWeek[]>([]);
  const [occurrences, setOccurrences] = useState<ResidencyOccurrence[]>([]);
  const [applications, setApplications] = useState<WeekApplication[]>([]);
  const [artistId, setArtistId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyWeekId, setBusyWeekId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        if (!residencyId) {
          setError('Id de programmation manquant.');
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const identity = await getArtistIdentity(supabase);
        if (!identity.artistId) {
          setError('Compte artiste non lié.');
          return;
        }
        setArtistId(identity.artistId);

        const [resRes, weeksRes, appsRes, occRes] = await Promise.all([
          supabase
            .from('residencies')
            .select(
              'id, name, mode, start_date, end_date, terms_mode, fee_amount_cents, fee_currency, fee_is_net, lodging_included, meals_included, companion_included, is_public, is_open, clients(name)'
            )
            .eq('id', residencyId)
            .maybeSingle(),
          supabase
            .from('residency_weeks')
            .select('id, start_date_sun, end_date_sun, type, performances_count, fee_cents, status, week_bookings(id, artist_id, status)')
            .eq('residency_id', residencyId)
            .order('start_date_sun', { ascending: true }),
          supabase
            .from('week_applications')
            .select('id, residency_week_id, status')
            .eq('artist_id', identity.artistId),
          supabase
            .from('residency_occurrences')
            .select('id, date')
            .eq('residency_id', residencyId)
            .order('date', { ascending: true }),
        ]);

        if (resRes.error || !resRes.data) throw resRes.error || new Error('Programmation introuvable.');
        if (weeksRes.error) throw weeksRes.error;
        if (appsRes.error) throw appsRes.error;
        if (occRes.error) throw occRes.error;

        setResidency(resRes.data as ResidencyRow);
        setWeeks((weeksRes.data as ResidencyWeek[]) ?? []);
        setApplications((appsRes.data as WeekApplication[]) ?? []);
        setOccurrences((occRes.data as ResidencyOccurrence[]) ?? []);
      } catch (e: any) {
        setError(e?.message ?? 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [router, residencyId]);

  const appByWeek = useMemo(() => {
    const map = new Map<string, WeekApplication>();
    for (const app of applications) map.set(app.residency_week_id, app);
    return map;
  }, [applications]);

  async function apply(week: ResidencyWeek) {
    if (!artistId) return;
    try {
      setBusyWeekId(week.id);
      const existing = appByWeek.get(week.id);
      if (existing) {
        const { error: upErr } = await supabase
          .from('week_applications')
          .update({ status: 'APPLIED' })
          .eq('id', existing.id);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabase
          .from('week_applications')
          .insert({ residency_week_id: week.id, artist_id: artistId });
        if (insErr) throw insErr;
      }
      const { data: appsRes } = await supabase
        .from('week_applications')
        .select('id, residency_week_id, status')
        .eq('artist_id', artistId);
      setApplications((appsRes as WeekApplication[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de candidater');
    } finally {
      setBusyWeekId(null);
    }
  }

  async function withdraw(week: ResidencyWeek) {
    if (!artistId) return;
    const existing = appByWeek.get(week.id);
    if (!existing) return;
    try {
      setBusyWeekId(week.id);
      const { error: upErr } = await supabase
        .from('week_applications')
        .update({ status: 'WITHDRAWN' })
        .eq('id', existing.id);
      if (upErr) throw upErr;
      const { data: appsRes } = await supabase
        .from('week_applications')
        .select('id, residency_week_id, status')
        .eq('artist_id', artistId);
      setApplications((appsRes as WeekApplication[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de retirer');
    } finally {
      setBusyWeekId(null);
    }
  }

  if (loading) return <div className="text-slate-500">Chargement…</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!residency) return <div className="text-slate-500">Programmation introuvable.</div>;

  const clientName = Array.isArray(residency.clients)
    ? residency.clients[0]?.name
    : (residency.clients as any)?.name;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="space-y-2">
        <Link href="/artist/programmations" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold">{residency.name}</h1>
        <p className="text-sm text-slate-600">
          {clientName || 'Client'} • {fmtDateFR(residency.start_date)} → {fmtDateFR(residency.end_date)}
        </p>
      </header>

      <section className="rounded-xl border p-4 space-y-2">
        <h2 className="font-semibold">Conditions</h2>
        {residency.terms_mode === 'SIMPLE_FEE' ? (
          <div className="text-sm text-slate-600">
            Cachet :{' '}
            {typeof residency.fee_amount_cents === 'number'
              ? formatMoney(residency.fee_amount_cents, residency.fee_currency ?? 'EUR')
              : '—'}{' '}
            ({residency.fee_is_net === false ? 'brut' : 'net'})
          </div>
        ) : (
          <>
            <div className="text-sm text-slate-600">
              {residency.lodging_included ? 'Logement inclus' : 'Logement non inclus'} •{' '}
              {residency.meals_included ? 'Repas inclus' : 'Repas non inclus'} •{' '}
              {residency.companion_included ? 'Accompagnant inclus' : 'Accompagnant non inclus'}
            </div>
            <div className="text-sm text-slate-600">
              Semaine calme: 2 prestations • 1 cachet (150€ net)
            </div>
            <div className="text-sm text-slate-600">
              Semaine forte: 4 prestations • 2 cachets (300€ net)
            </div>
          </>
        )}
      </section>

      {residency.mode === 'DATES' ? (
        <section className="space-y-3">
          <h2 className="font-semibold">Dates</h2>
          {occurrences.length === 0 ? (
            <div className="text-sm text-slate-500">Aucune date disponible.</div>
          ) : (
            occurrences.map((occ) => {
              const status = residency.is_open ? 'À confirmer' : 'Sur invitation uniquement';
              const badgeClass = residency.is_open
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-600';
              return (
                <div key={occ.id} className="rounded-xl border p-4 flex items-center justify-between">
                  <div className="font-semibold">{fmtDateFR(occ.date)}</div>
                  <span className={`text-xs px-2 py-1 rounded-full ${badgeClass}`}>{status}</span>
                </div>
              );
            })
          )}
          {!residency.is_open ? (
            <div className="text-sm text-slate-500">Sur invitation uniquement.</div>
          ) : null}
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="font-semibold">Semaines</h2>
          {weeks.map((w) => {
            const app = appByWeek.get(w.id);
            const isConfirmed = w.status === 'CONFIRMED';
            const bookings = toArray(w.week_bookings) as WeekBooking[];
            const confirmedBooking = bookings.find((b) => b.status === 'CONFIRMED');
            const isMyConfirmed =
              isConfirmed && confirmedBooking?.artist_id && confirmedBooking.artist_id === artistId;
            const isApplied = app?.status === 'APPLIED';
            const isWithdrawn = app?.status === 'WITHDRAWN';
            const isRejected = app?.status === 'REJECTED';
            const disabled = isConfirmed || busyWeekId === w.id || !residency.is_open;
            return (
              <div
                key={w.id}
                className={`rounded-xl border p-4 flex flex-col gap-2 ${isConfirmed ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {fmtDateFR(w.start_date_sun)} → {fmtDateFR(w.end_date_sun)}
                    </div>
                    <div className="text-sm text-slate-500">
                      {w.type === 'BUSY' ? 'Semaine forte' : 'Semaine calme'} •{' '}
                      {w.performances_count} prestations • {formatMoney(w.fee_cents)}
                    </div>
                  </div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    {isConfirmed
                      ? isMyConfirmed
                        ? '✅ Confirmé'
                        : labelForStatus(w.status)
                      : labelForStatus(w.status)}
                  </div>
                </div>

                {isConfirmed ? (
                  <div className="text-sm text-slate-500">
                    {isMyConfirmed
                      ? 'Vous etes confirme sur cette semaine.'
                      : "Semaine confirmee par l'admin."}
                  </div>
                ) : isApplied ? (
                  <div className="text-sm text-emerald-700">Vous etes candidat.</div>
                ) : isRejected ? (
                  <div className="text-sm text-slate-500">Candidature refusee.</div>
                ) : isWithdrawn ? (
                  <div className="text-sm text-slate-500">Candidature retiree.</div>
                ) : null}

                <div className="flex gap-2">
                  {!isConfirmed && !isApplied ? (
                    <button className="btn btn-primary" disabled={disabled} onClick={() => apply(w)}>
                      Je suis disponible
                    </button>
                  ) : null}
                  {!isConfirmed && isApplied ? (
                    <button className="btn" disabled={disabled} onClick={() => withdraw(w)}>
                      Retirer
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
