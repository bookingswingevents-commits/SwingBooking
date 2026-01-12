'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR } from '@/lib/date';

type ResidencyRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  mode?: 'RANGE' | 'DATES' | null;
  terms_mode?: 'SIMPLE_FEE' | 'INCLUDED' | 'WEEKLY' | 'RESIDENCY_WEEKLY' | null;
  fee_amount_cents?: number | null;
  fee_currency?: string | null;
  fee_is_net?: boolean | null;
  is_public: boolean;
  is_open: boolean;
  lodging_included: boolean;
  meals_included: boolean;
  companion_included: boolean;
  event_address_line1?: string | null;
  event_address_line2?: string | null;
  event_address_zip?: string | null;
  event_address_city?: string | null;
  event_address_country?: string | null;
  clients?:
    | {
        name: string;
        default_event_address_line1?: string | null;
        default_event_address_line2?: string | null;
        default_event_zip?: string | null;
        default_event_city?: string | null;
        default_event_country?: string | null;
      }
    | {
        name: string;
        default_event_address_line1?: string | null;
        default_event_address_line2?: string | null;
        default_event_zip?: string | null;
        default_event_city?: string | null;
        default_event_country?: string | null;
      }[]
    | null;
};

type WeekApplication = {
  id: string;
  artist_id: string;
  status: 'APPLIED' | 'WITHDRAWN' | 'REJECTED';
  created_at: string;
  artists?: { stage_name: string | null } | { stage_name: string | null }[] | null;
};

type WeekBooking = {
  id: string;
  artist_id: string;
  status: 'CONFIRMED' | 'CANCELLED';
  artists?: { stage_name: string | null } | { stage_name: string | null }[] | null;
};

type ResidencyWeek = {
  id: string;
  start_date_sun: string;
  end_date_sun: string;
  type: 'CALM' | 'BUSY';
  performances_count: number;
  fee_cents: number;
  status: 'OPEN' | 'CONFIRMED';
  confirmed_booking_id: string | null;
  week_applications?: WeekApplication[] | WeekApplication | null;
  week_bookings?: WeekBooking[] | WeekBooking | null;
};

type ResidencyOccurrence = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
};

type InvitationRow = {
  id: string;
  token: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  target_filter: any;
};

type ArtistOption = {
  id: string;
  stage_name: string | null;
  full_name?: string | null;
  email?: string | null;
};

const formatMoney = (cents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

const toArray = <T,>(v: T[] | T | null | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);

function buildAddress(
  line1?: string | null,
  line2?: string | null,
  zip?: string | null,
  city?: string | null,
  country?: string | null
) {
  const parts = [
    line1?.trim(),
    line2?.trim(),
    [zip?.trim(), city?.trim()].filter(Boolean).join(' '),
    country?.trim(),
  ].filter(Boolean);
  return parts.join(', ');
}

function normalizeTermsMode(
  mode?: ResidencyRow['terms_mode']
): 'SIMPLE_FEE' | 'RESIDENCY_WEEKLY' {
  if (mode === 'SIMPLE_FEE') return 'SIMPLE_FEE';
  return 'RESIDENCY_WEEKLY';
}

export default function AdminResidencyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: residencyId } = React.use(params);
  const router = useRouter();
  const [residency, setResidency] = useState<ResidencyRow | null>(null);
  const [weeks, setWeeks] = useState<ResidencyWeek[]>([]);
  const [occurrences, setOccurrences] = useState<ResidencyOccurrence[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [artists, setArtists] = useState<ArtistOption[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<Record<string, boolean>>({});
  const [searchArtist, setSearchArtist] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [origin, setOrigin] = useState<string>('');
  const [editName, setEditName] = useState('');
  const [editLodging, setEditLodging] = useState(true);
  const [editMeals, setEditMeals] = useState(true);
  const [editCompanion, setEditCompanion] = useState(true);
  const [editTermsMode, setEditTermsMode] = useState<'SIMPLE_FEE' | 'RESIDENCY_WEEKLY'>('RESIDENCY_WEEKLY');
  const [editFeeAmount, setEditFeeAmount] = useState('');
  const [editFeeIsNet, setEditFeeIsNet] = useState(true);
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editIsOpen, setEditIsOpen] = useState(true);
  const [isEditingConditions, setIsEditingConditions] = useState(false);
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  async function loadData() {
    if (!residencyId) {
      setError('Id de programmation manquant.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (prof?.role !== 'admin') {
        setError('Acces refuse (admin requis).');
        setLoading(false);
        return;
      }

      const resRes = await supabase
        .from('residencies')
        .select(
          'id, name, start_date, end_date, mode, terms_mode, fee_amount_cents, fee_currency, fee_is_net, is_public, is_open, lodging_included, meals_included, companion_included, event_address_line1, event_address_line2, event_address_zip, event_address_city, event_address_country, clients(name, default_event_address_line1, default_event_address_line2, default_event_zip, default_event_city, default_event_country)'
        )
        .eq('id', residencyId)
        .maybeSingle();
      if (resRes.error) throw resRes.error;
      const resRow = resRes.data as ResidencyRow;

      const invRes = await supabase
        .from('residency_invitations')
        .select('id, token, status, sent_at, created_at, target_filter')
        .eq('residency_id', residencyId)
        .order('created_at', { ascending: false });
      if (invRes.error) throw invRes.error;

      if (resRow?.mode === 'DATES') {
        const occRes = await supabase
          .from('residency_occurrences')
          .select('id, date, start_time, end_time, notes')
          .eq('residency_id', residencyId)
          .order('date', { ascending: true });
        if (occRes.error) throw occRes.error;
        setOccurrences((occRes.data as ResidencyOccurrence[]) ?? []);
        setWeeks([]);
      } else {
        const weeksRes = await supabase
          .from('residency_weeks')
          .select(
            'id, start_date_sun, end_date_sun, type, performances_count, fee_cents, status, confirmed_booking_id, week_applications(id, artist_id, status, created_at, artists(stage_name)), week_bookings(id, artist_id, status, artists(stage_name))'
          )
          .eq('residency_id', residencyId)
          .order('start_date_sun', { ascending: true });
        if (weeksRes.error) throw weeksRes.error;
        setWeeks((weeksRes.data as ResidencyWeek[]) ?? []);
        setOccurrences([]);
      }

      setResidency(resRow);
      setEditName(resRow.name);
      setEditLodging(!!resRow.lodging_included);
      setEditMeals(!!resRow.meals_included);
      setEditCompanion(!!resRow.companion_included);
      setEditTermsMode(normalizeTermsMode(resRow.terms_mode));
      setEditFeeAmount(
        typeof resRow.fee_amount_cents === 'number'
          ? String((resRow.fee_amount_cents / 100).toFixed(2)).replace(/\.00$/, '')
          : ''
      );
      setEditFeeIsNet(resRow.fee_is_net ?? true);
      setEditIsPublic(!!resRow.is_public);
      setEditIsOpen(!!resRow.is_open);
      setInvitations((invRes.data as InvitationRow[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  async function loadArtists() {
    try {
      const res = await fetch('/api/admin/artists', { credentials: 'include' });
      const json = await res.json();
      if (!json.ok) return;
      setArtists(json.data ?? []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!residencyId) return;
    setResidency(null);
    setWeeks([]);
    setOccurrences([]);
    setInvitations([]);
    setError(null);
    setLoading(true);
    loadData();
    loadArtists();
  }, [residencyId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const filteredArtists = useMemo(() => {
    if (!searchArtist.trim()) return artists;
    const q = searchArtist.toLowerCase();
    return artists.filter((a) =>
      `${a.stage_name ?? ''} ${a.full_name ?? ''} ${a.email ?? ''}`.toLowerCase().includes(q)
    );
  }, [artists, searchArtist]);

  async function sendInvitations() {
    const artist_ids = Object.entries(selectedArtists)
      .filter(([, v]) => v)
      .map(([id]) => id);
    if (artist_ids.length === 0) return;
    try {
      setActionLoading(true);
      const res = await fetch('/api/admin/residencies/invitations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residency_id: residencyId, artist_ids }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Envoi impossible');
      setSelectedArtists({});
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de l\'envoi');
    } finally {
      setActionLoading(false);
    }
  }

  async function updateWeekType(week: ResidencyWeek, type: 'CALM' | 'BUSY') {
    try {
      setActionLoading(true);
      const payload =
        type === 'BUSY'
          ? { type, performances_count: 4, fee_cents: 30000 }
          : { type, performances_count: 2, fee_cents: 15000 };
      const { error: upErr } = await supabase
        .from('residency_weeks')
        .update(payload)
        .eq('id', week.id);
      if (upErr) throw upErr;
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la mise a jour');
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmWeek(weekId: string, artistId: string) {
    try {
      setActionLoading(true);
      const res = await fetch('/api/admin/residencies/confirm-week', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_id: weekId, artist_id: artistId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Confirmation impossible');
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la confirmation');
    } finally {
      setActionLoading(false);
    }
  }

  async function saveResidency() {
    if (!residency) return;
    if (!editName.trim()) {
      setError('Nom requis.');
      return;
    }
    try {
      setActionLoading(true);
      const { error: upErr } = await supabase
        .from('residencies')
        .update({
          name: editName.trim(),
          lodging_included: editLodging,
          meals_included: editMeals,
          companion_included: editCompanion,
          is_public: editIsPublic,
          is_open: editIsOpen,
        })
        .eq('id', residency.id);
      if (upErr) throw upErr;
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la mise a jour');
    } finally {
      setActionLoading(false);
    }
  }

  async function saveConditions() {
    if (!residency) return;
    try {
      setActionLoading(true);
      setError(null);
      const payload: Record<string, any> = {
        terms_mode: editTermsMode,
      };
      if (editTermsMode === 'SIMPLE_FEE') {
        const num = Number(editFeeAmount.replace(',', '.'));
        if (!Number.isFinite(num) || num <= 0) {
          setError('Montant du cachet invalide.');
          setActionLoading(false);
          return;
        }
        payload.fee_amount_cents = Math.round(num * 100);
        payload.fee_currency = 'EUR';
        payload.fee_is_net = editFeeIsNet;
      } else if (editTermsMode === 'RESIDENCY_WEEKLY') {
        payload.lodging_included = editLodging;
        payload.meals_included = editMeals;
        payload.companion_included = editCompanion;
      }
      const res = await fetch(`/api/admin/residencies/${residency.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Mise a jour impossible');
      setSuccess('Conditions mises a jour.');
      setIsEditingConditions(false);
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la mise a jour');
    } finally {
      setActionLoading(false);
    }
  }

  function cancelEditConditions() {
    if (!residency) return;
    setEditLodging(!!residency.lodging_included);
    setEditMeals(!!residency.meals_included);
    setEditCompanion(!!residency.companion_included);
    setEditTermsMode(normalizeTermsMode(residency.terms_mode));
    setEditFeeAmount(
      typeof residency.fee_amount_cents === 'number'
        ? String((residency.fee_amount_cents / 100).toFixed(2)).replace(/\.00$/, '')
        : ''
    );
    setEditFeeIsNet(residency.fee_is_net ?? true);
    setIsEditingConditions(false);
  }

  async function deleteResidency() {
    if (!residency) return;
    if (!window.confirm('Supprimer cette residence et ses semaines ?')) return;
    try {
      setActionLoading(true);
      const { error: delErr } = await supabase
        .from('residencies')
        .delete()
        .eq('id', residency.id);
      if (delErr) throw delErr;
      router.push('/admin/programmations');
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la suppression');
    } finally {
      setActionLoading(false);
    }
  }

  async function cancelConfirmation(weekId: string) {
    try {
      setActionLoading(true);
      const res = await fetch('/api/admin/residencies/cancel-week', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_id: weekId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Annulation impossible');
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de l\'annulation');
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteOccurrence(occurrenceId: string) {
    try {
      setActionLoading(true);
      const res = await fetch('/api/admin/residency-occurrences', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: occurrenceId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Suppression impossible');
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la suppression');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div className="text-slate-500">Chargement…</div>;
  if (error) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Agenda programmation</h1>
        <p className="text-red-600">{error}</p>
        <Link href="/admin/programmations" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  if (!residency) {
    return (
        <div className="space-y-3">
        <p className="text-slate-500">Programmation introuvable.</p>
        <Link href="/admin/programmations" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const clientName = Array.isArray(residency.clients)
    ? residency.clients[0]?.name
    : (residency.clients as any)?.name;
  const occurrenceCount = occurrences.length;
  const clientRow = Array.isArray(residency.clients)
    ? residency.clients[0]
    : (residency.clients as any);
  const resolvedLine2 = residency.event_address_line2 ?? clientRow?.default_event_address_line2 ?? null;
  const resolvedAddress = buildAddress(
    residency.event_address_line1 ?? clientRow?.default_event_address_line1 ?? null,
    resolvedLine2,
    residency.event_address_zip ?? clientRow?.default_event_zip ?? null,
    residency.event_address_city ?? clientRow?.default_event_city ?? null,
    residency.event_address_country ?? clientRow?.default_event_country ?? null
  );
  const mapLink = resolvedAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolvedAddress)}`
    : null;
  const staticMapUrl =
    mapsKey && resolvedAddress
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(resolvedAddress)}&zoom=13&size=600x300&maptype=roadmap&markers=color:red%7C${encodeURIComponent(resolvedAddress)}&key=${mapsKey}`
      : null;
  const normalizedTermsMode = normalizeTermsMode(residency.terms_mode);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="space-y-2">
        <Link href="/admin/programmations" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold">{residency.name}</h1>
        <div className="text-sm text-slate-500">
          {clientName || 'Client'} •{' '}
          {residency.mode === 'DATES'
            ? `${occurrenceCount} dates (du ${fmtDateFR(residency.start_date)} au ${fmtDateFR(residency.end_date)})`
            : `${fmtDateFR(residency.start_date)} → ${fmtDateFR(residency.end_date)}`}
        </div>
      </header>

      <section className="rounded-xl border p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Lieu de la prestation</h2>
            {resolvedAddress ? (
              <div className="text-sm text-slate-600 mt-1">
                <div>{resolvedAddress}</div>
                {resolvedLine2 ? (
                  <div className="text-xs text-slate-500">{resolvedLine2}</div>
                ) : null}
              </div>
            ) : (
              <div className="text-sm text-slate-500 mt-1">Adresse non renseignée.</div>
            )}
          </div>
          {mapLink ? (
            <a
              href={mapLink}
              target="_blank"
              className="btn btn-primary"
              rel="noreferrer"
            >
              Voir sur Google Maps
            </a>
          ) : null}
        </div>
        {resolvedAddress ? (
          staticMapUrl ? (
            <img
              src={staticMapUrl}
              alt="Aperçu carte"
              loading="lazy"
              className="rounded-xl border h-48 w-full object-cover"
            />
          ) : (
            <div className="rounded-xl border bg-slate-50 text-sm text-slate-500 flex items-center justify-center h-48">
              Aperçu carte indisponible (clé Google Maps manquante)
            </div>
          )
        ) : null}
      </section>

      <section className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Conditions</h2>
          {!isEditingConditions ? (
            <button
              className="btn"
              onClick={() => setIsEditingConditions(true)}
              disabled={actionLoading}
            >
              Modifier
            </button>
          ) : null}
        </div>
        {!isEditingConditions ? (
          <>
            {normalizedTermsMode === 'SIMPLE_FEE' ? (
              <div className="text-sm text-slate-700">
                Cachet unique :{' '}
                <strong>
                  {typeof residency.fee_amount_cents === 'number'
                    ? `${(residency.fee_amount_cents / 100).toLocaleString('fr-FR')} ${residency.fee_currency ?? 'EUR'}`
                    : '—'}
                </strong>{' '}
                {residency.fee_is_net === false ? '(brut)' : '(net)'}
              </div>
            ) : null}
            {normalizedTermsMode === 'RESIDENCY_WEEKLY' ? (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-full border">
                  {residency.lodging_included ? 'Logement inclus' : 'Logement non inclus'}
                </span>
                <span className="px-2 py-1 rounded-full border">
                  {residency.meals_included ? 'Repas inclus' : 'Repas non inclus'}
                </span>
                <span className="px-2 py-1 rounded-full border">
                  {residency.companion_included ? 'Accompagnant inclus' : 'Accompagnant non inclus'}
                </span>
              </div>
            ) : null}
            {normalizedTermsMode === 'RESIDENCY_WEEKLY' ? (
              <div className="text-sm text-slate-600">
                Semaine calme: 2 prestations • 1 cachet (150€ net)
                <br />
                Semaine forte: 4 prestations • 2 cachets (300€ net)
              </div>
            ) : null}
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="text-sm font-medium">Type de conditions</label>
              <select
                className="border rounded-lg px-2 py-1 text-sm"
                value={editTermsMode}
                onChange={(e) => setEditTermsMode(e.target.value as 'SIMPLE_FEE' | 'RESIDENCY_WEEKLY')}
              >
                <option value="SIMPLE_FEE">Cachet unique</option>
                <option value="RESIDENCY_WEEKLY">Résidence (semaines calme/forte)</option>
              </select>
            </div>
            {editTermsMode === 'SIMPLE_FEE' ? (
              <div className="grid gap-3 md:grid-cols-[200px_auto] items-center">
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Montant (EUR)"
                  value={editFeeAmount}
                  onChange={(e) => setEditFeeAmount(e.target.value)}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editFeeIsNet}
                    onChange={(e) => setEditFeeIsNet(e.target.checked)}
                  />
                  Cachet net
                </label>
              </div>
            ) : null}
            {editTermsMode === 'RESIDENCY_WEEKLY' ? (
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editLodging}
                    onChange={(e) => setEditLodging(e.target.checked)}
                  />
                  Logement inclus
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editMeals}
                    onChange={(e) => setEditMeals(e.target.checked)}
                  />
                  Repas inclus
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editCompanion}
                    onChange={(e) => setEditCompanion(e.target.checked)}
                  />
                  Accompagnant inclus
                </label>
              </div>
            ) : null}
            {editTermsMode === 'RESIDENCY_WEEKLY' ? (
              <div className="text-sm text-slate-600">
                Semaine calme: 2 prestations • 1 cachet (150€ net)
                <br />
                Semaine forte: 4 prestations • 2 cachets (300€ net)
              </div>
            ) : null}
          </div>
        )}
        {success ? (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
            {success}
          </div>
        ) : null}
        {isEditingConditions ? (
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={saveConditions} disabled={actionLoading}>
              Enregistrer
            </button>
            <button className="btn" onClick={cancelEditConditions} disabled={actionLoading}>
              Annuler
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold">Parametres de la residence</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="border rounded-lg px-3 py-2"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <div className="flex flex-wrap gap-4 text-sm items-center">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editLodging}
                onChange={(e) => setEditLodging(e.target.checked)}
              />
              Logement inclus
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editMeals}
                onChange={(e) => setEditMeals(e.target.checked)}
              />
              Repas inclus
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editCompanion}
                onChange={(e) => setEditCompanion(e.target.checked)}
              />
              Accompagnant inclus
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editIsPublic}
                onChange={(e) => setEditIsPublic(e.target.checked)}
              />
              Publier la programmation
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editIsOpen}
                onChange={(e) => setEditIsOpen(e.target.checked)}
              />
              Ouvrir aux candidatures
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={saveResidency} disabled={actionLoading}>
            Enregistrer
          </button>
          <button className="btn" onClick={deleteResidency} disabled={actionLoading}>
            Supprimer la residence
          </button>
        </div>
      </section>

      {residency.mode !== 'DATES' ? (
        <section className="rounded-xl border p-4 space-y-4">
          <h2 className="font-semibold">Inviter des artistes</h2>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              className="border rounded-lg px-3 py-2"
              placeholder="Rechercher un artiste"
              value={searchArtist}
              onChange={(e) => setSearchArtist(e.target.value)}
            />
            <button className="btn btn-primary" onClick={sendInvitations} disabled={actionLoading}>
              Envoyer les demandes
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {filteredArtists.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!selectedArtists[a.id]}
                  onChange={(e) =>
                    setSelectedArtists((prev) => ({ ...prev, [a.id]: e.target.checked }))
                  }
                />
                <span>
                  {a.stage_name || a.full_name || 'Artiste'} {a.email ? `• ${a.email}` : ''}
                </span>
              </label>
            ))}
          </div>
          {invitations.length > 0 ? (
            <div className="text-sm text-slate-500">
              {invitations.length} invitation{invitations.length > 1 ? 's' : ''} envoyee{invitations.length > 1 ? 's' : ''}.
            </div>
          ) : null}
        </section>
      ) : null}

      {residency.mode !== 'DATES' ? (
        <section className="rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold">Invitations</h2>
          {invitations.length === 0 ? (
            <div className="text-sm text-slate-500">Aucune invitation pour le moment.</div>
          ) : (
            invitations.map((inv) => {
              const tf = inv.target_filter || {};
              const name = tf.artist_name || tf.artist_email || 'Artiste';
              const link = origin ? `${origin}/availability/${inv.token}` : `/availability/${inv.token}`;
              return (
                <div key={inv.id} className="flex flex-col gap-2 border rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-slate-500">{inv.status}</div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {inv.sent_at ? `Envoyee: ${fmtDateFR(inv.sent_at)}` : 'Envoyee: —'}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-xs bg-slate-50 border rounded px-2 py-1">{link}</code>
                    <button
                      className="btn"
                      onClick={() => navigator.clipboard.writeText(link)}
                    >
                      Copier le lien
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      ) : null}

      {residency.mode === 'DATES' ? (
        <section className="space-y-4">
          <h2 className="font-semibold">Dates</h2>
          {occurrences.length === 0 ? (
            <div className="text-sm text-slate-500">Aucune date enregistree.</div>
          ) : (
            <div className="rounded-xl border divide-y">
              {occurrences.map((occ) => (
                <div key={occ.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <div className="font-medium">{fmtDateFR(occ.date)}</div>
                    <div className="text-xs text-slate-500">
                      {occ.start_time || '—'} → {occ.end_time || '—'}
                      {occ.notes ? ` • ${occ.notes}` : ''}
                    </div>
                  </div>
                  <button
                    className="btn"
                    onClick={() => deleteOccurrence(occ.id)}
                    disabled={actionLoading}
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <h2 className="font-semibold">Semaines</h2>
          {weeks.map((w) => {
            const applications = toArray(w.week_applications) as WeekApplication[];
            const bookings = toArray(w.week_bookings) as WeekBooking[];
            const confirmedBooking = bookings.find((b) => b.status === 'CONFIRMED');
            const pendingCount = applications.filter((a) => a.status === 'APPLIED').length;
            const statusLabel =
              w.status === 'CONFIRMED' ? 'CONFIRMED' : pendingCount > 0 ? 'PENDING' : 'OPEN';
            return (
              <div key={w.id} className="rounded-xl border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {fmtDateFR(w.start_date_sun)} → {fmtDateFR(w.end_date_sun)}
                    </div>
                    <div className="text-sm text-slate-500">
                      {w.type === 'BUSY' ? 'Semaine forte' : 'Semaine calme'} •{' '}
                      {w.performances_count} prestations • {formatMoney(w.fee_cents)} net
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs uppercase tracking-wide text-slate-500">{statusLabel}</span>
                    <select
                      className="border rounded-lg px-2 py-1 text-sm"
                      value={w.type}
                      disabled={w.status === 'CONFIRMED' || actionLoading}
                      onChange={(e) => updateWeekType(w, e.target.value as 'CALM' | 'BUSY')}
                    >
                      <option value="CALM">CALME</option>
                      <option value="BUSY">FORTE</option>
                    </select>
                  </div>
                </div>

                {confirmedBooking ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                    Confirme avec{' '}
                    {Array.isArray(confirmedBooking.artists)
                      ? confirmedBooking.artists[0]?.stage_name
                      : confirmedBooking.artists?.stage_name || 'Artiste'}
                    .
                  </div>
                ) : null}

                <div className="space-y-2">
                  <div className="text-sm font-medium">Candidats</div>
                  {applications.length === 0 ? (
                    <div className="text-sm text-slate-500">Aucune candidature.</div>
                  ) : (
                    applications.map((a) => {
                      const artistName = Array.isArray(a.artists)
                        ? a.artists[0]?.stage_name
                        : a.artists?.stage_name;
                      return (
                        <div key={a.id} className="flex items-center justify-between text-sm">
                          <span>
                            {artistName || 'Artiste'} • {a.status}
                          </span>
                          {w.status === 'OPEN' && a.status === 'APPLIED' ? (
                            <button
                              className="btn btn-primary"
                              onClick={() => confirmWeek(w.id, a.artist_id)}
                              disabled={actionLoading}
                            >
                              Confirmer
                            </button>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>

                {w.status === 'CONFIRMED' ? (
                  <button
                    className="btn"
                    onClick={() => cancelConfirmation(w.id)}
                    disabled={actionLoading}
                  >
                    Annuler la confirmation
                  </button>
                ) : null}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
