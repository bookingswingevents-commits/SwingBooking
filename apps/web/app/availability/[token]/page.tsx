'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { fmtDateFR } from '@/lib/date';

type InvitationRow = {
  id: string;
  residency_id: string;
  target_filter: any;
};

type ResidencyRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  lodging_included: boolean;
  meals_included: boolean;
  companion_included: boolean;
};

type ResidencyWeek = {
  id: string;
  start_date_sun: string;
  end_date_sun: string;
  type: 'CALM' | 'BUSY';
  performances_count: number;
  fee_cents: number;
  status: 'OPEN' | 'CONFIRMED';
};

type WeekApplication = {
  id: string;
  residency_week_id: string;
  status: 'APPLIED' | 'WITHDRAWN' | 'REJECTED';
};

const formatMoney = (cents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

export default function AvailabilityPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [residency, setResidency] = useState<ResidencyRow | null>(null);
  const [weeks, setWeeks] = useState<ResidencyWeek[]>([]);
  const [applications, setApplications] = useState<WeekApplication[]>([]);
  const [artistName, setArtistName] = useState<string | null>(null);
  const [artistId, setArtistId] = useState<string | null>(null);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [busyWeekId, setBusyWeekId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const publicSupa = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { 'x-residency-token': token } },
        });

        const { data: inv, error: invErr } = await publicSupa
          .from('residency_invitations')
          .select('id, residency_id, target_filter')
          .eq('token', token)
          .maybeSingle();
        if (invErr || !inv) throw new Error('Invitation invalide ou expiree.');
        const invitation = inv as InvitationRow;
        const tf = invitation.target_filter || {};
        const tArtistId = tf?.artist_id as string | undefined;
        if (!tArtistId) throw new Error('Invitation incomplete (artiste introuvable).');

        setArtistId(tArtistId);
        setInvitationId(invitation.id);
        setArtistName((tf?.artist_name as string | undefined) ?? null);

        const [resRes, weeksRes, appsRes] = await Promise.all([
          publicSupa
            .from('residencies')
            .select('id, name, start_date, end_date, lodging_included, meals_included, companion_included')
            .eq('id', invitation.residency_id)
            .maybeSingle(),
          publicSupa
            .from('residency_weeks')
            .select('id, start_date_sun, end_date_sun, type, performances_count, fee_cents, status')
            .eq('residency_id', invitation.residency_id)
            .order('start_date_sun', { ascending: true }),
          publicSupa
            .from('week_applications')
            .select('id, residency_week_id, status')
            .eq('artist_id', tArtistId),
        ]);

        if (resRes.error || !resRes.data) throw resRes.error || new Error('Residency introuvable');
        if (weeksRes.error) throw weeksRes.error;
        if (appsRes.error) throw appsRes.error;

        setResidency(resRes.data as ResidencyRow);
        setWeeks((weeksRes.data as ResidencyWeek[]) ?? []);
        setApplications((appsRes.data as WeekApplication[]) ?? []);
      } catch (e: any) {
        setError(e?.message ?? 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const appByWeek = useMemo(() => {
    const map = new Map<string, WeekApplication>();
    for (const app of applications) map.set(app.residency_week_id, app);
    return map;
  }, [applications]);

  async function apply(week: ResidencyWeek) {
    if (!artistId) return;
    try {
      setBusyWeekId(week.id);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const publicSupa = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { 'x-residency-token': token } },
      });
      const existing = appByWeek.get(week.id);
      if (existing) {
        const { error } = await publicSupa
          .from('week_applications')
          .update({ status: 'APPLIED' })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await publicSupa
          .from('week_applications')
          .insert({
            residency_week_id: week.id,
            artist_id: artistId,
            invitation_id: invitationId,
          });
        if (error) throw error;
      }
      const { data: appsRes } = await publicSupa
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
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const publicSupa = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { 'x-residency-token': token } },
      });
      const { error } = await publicSupa
        .from('week_applications')
        .update({ status: 'WITHDRAWN' })
        .eq('id', existing.id);
      if (error) throw error;
      const { data: appsRes } = await publicSupa
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
  if (!residency) return <div className="text-slate-500">Aucune residence.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{residency.name}</h1>
        <p className="text-sm text-slate-600">
          {fmtDateFR(residency.start_date)} → {fmtDateFR(residency.end_date)}
        </p>
        {artistName ? (
          <p className="text-sm text-slate-600">Invitation pour {artistName}.</p>
        ) : null}
      </header>

      <section className="rounded-xl border p-4 space-y-2">
        <h2 className="font-semibold">Conditions</h2>
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
      </section>

      <section className="space-y-3">
        {weeks.map((w) => {
          const app = appByWeek.get(w.id);
          const isConfirmed = w.status === 'CONFIRMED';
          const isApplied = app?.status === 'APPLIED';
          const isWithdrawn = app?.status === 'WITHDRAWN';
          const isRejected = app?.status === 'REJECTED';
          const disabled = isConfirmed || busyWeekId === w.id;
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
                  {isConfirmed ? 'CONFIRMED' : 'OPEN'}
                </div>
              </div>

              {isConfirmed ? (
                <div className="text-sm text-slate-500">Semaine confirmee par l'admin.</div>
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
    </div>
  );
}
