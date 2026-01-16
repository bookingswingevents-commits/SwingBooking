'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR } from '@/lib/date';
import { DayPicker } from 'react-day-picker';
import { LEGACY_RESIDENCIES_DISABLED } from '@/lib/featureFlags';

type ClientRow = { id: string; name: string };

type ResidencyRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  client_id: string;
  mode?: 'RANGE' | 'DATES' | null;
  event_address_line1?: string | null;
  event_address_line2?: string | null;
  event_address_zip?: string | null;
  event_address_city?: string | null;
  event_address_country?: string | null;
  clients?: { name: string } | { name: string }[] | null;
  residency_occurrences?: { count: number }[] | { count: number } | null;
  clients_default_event_address_line1?: string | null;
  clients_default_event_address_line2?: string | null;
  clients_default_event_zip?: string | null;
  clients_default_event_city?: string | null;
  clients_default_event_country?: string | null;
};

export default function AdminResidenciesPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [residencies, setResidencies] = useState<ResidencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'RANGE' | 'DATES'>('RANGE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [lodgingIncluded, setLodgingIncluded] = useState(true);
  const [mealsIncluded, setMealsIncluded] = useState(true);
  const [companionIncluded, setCompanionIncluded] = useState(true);
  const [showClientModal, setShowClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);
      if (LEGACY_RESIDENCIES_DISABLED) {
        setError('Module de programmation indisponible.');
        return;
      }
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

      const [clientsRes, residenciesRes] = await Promise.all([
        supabase.from('clients').select('id, name').order('name', { ascending: true }),
        supabase
          .from('residencies')
          .select(
            'id, name, start_date, end_date, client_id, mode, event_address_line1, event_address_line2, event_address_zip, event_address_city, event_address_country, clients(name, default_event_address_line1, default_event_address_line2, default_event_zip, default_event_city, default_event_country), residency_occurrences(count)'
          )
          .order('start_date', { ascending: false }),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (residenciesRes.error) throw residenciesRes.error;
      setClients((clientsRes.data as ClientRow[]) ?? []);
      setResidencies((residenciesRes.data as ResidencyRow[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const safeClients = Array.isArray(clients) ? clients : [];
  const safeResidencies = Array.isArray(residencies) ? residencies : [];

  const clientOptions = useMemo(() => {
    return safeClients.map((c) => (
      <option key={c.id} value={c.id}>
        {c.name}
      </option>
    ));
  }, [safeClients]);

  function formatDateISO(date: Date) {
    const normalized = new Date(date);
    normalized.setHours(12, 0, 0, 0);
    const year = normalized.getFullYear();
    const month = `${normalized.getMonth() + 1}`.padStart(2, '0');
    const day = `${normalized.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async function createResidency(e: React.FormEvent) {
    e.preventDefault();
    if (LEGACY_RESIDENCIES_DISABLED) {
      setError('Module de programmation indisponible.');
      return;
    }
    if (!clientId || !name) {
      setError('Merci de renseigner tous les champs.');
      return;
    }
    const datesList = mode === 'DATES' ? selectedDates.map(formatDateISO).sort() : [];
    if (mode === 'RANGE' && (!startDate || !endDate)) {
      setError('Merci de renseigner les dates.');
      return;
    }
    if (mode === 'DATES' && datesList.length === 0) {
      setError('Merci de renseigner au moins une date.');
      return;
    }
    try {
      setCreating(true);
      setError(null);
      const res = await fetch('/api/admin/residencies', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          name,
          mode,
          start_date: mode === 'RANGE' ? startDate : undefined,
          end_date: mode === 'RANGE' ? endDate : undefined,
          dates: mode === 'DATES' ? datesList : undefined,
          lodging_included: lodgingIncluded,
          meals_included: mealsIncluded,
          companion_included: companionIncluded,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Creation impossible');
      setName('');
      setStartDate('');
      setEndDate('');
      setSelectedDates([]);
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la creation');
    } finally {
      setCreating(false);
    }
  }

  async function createClient() {
    if (newClientName.trim().length < 2) {
      setClientError('Nom requis (2 caracteres min).');
      return;
    }
    try {
      setCreating(true);
      setClientError(null);
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClientName.trim() }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Creation impossible');
      setNewClientName('');
      setShowClientModal(false);
      await loadAll();
      if (json.client?.id) {
        setClientId(json.client.id);
      }
    } catch (e: any) {
      setClientError(e?.message ?? 'Erreur lors de la creation');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="text-slate-500">Chargement…</div>;
  if (error) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Programmations</h1>
        <p className="text-red-600">{error}</p>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const buildAddress = (r: ResidencyRow) => {
    const client = Array.isArray(r.clients) ? r.clients[0] : (r.clients as any);
    const parts = [
      r.event_address_line1,
      r.event_address_line2,
      r.event_address_zip,
      r.event_address_city,
      r.event_address_country,
    ].filter(Boolean);
    if (parts.length) return parts.join(', ');
    const fallback = [
      client?.default_event_address_line1,
      client?.default_event_address_line2,
      client?.default_event_zip,
      client?.default_event_city,
      client?.default_event_country,
    ].filter(Boolean);
    return fallback.join(', ');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Programmations</h1>
          <p className="text-slate-600 text-sm">Agendas saisonniers dim→dim pour les clients.</p>
        </div>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </header>

      <form onSubmit={createResidency} className="rounded-xl border p-4 space-y-4">
        <h2 className="font-semibold">Nouvelle programmation</h2>
        {clients.length === 0 ? (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            Aucun client. Creez d'abord un client dans <Link href="/admin/clients" className="underline">/admin/clients</Link>.
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex gap-2">
            <select
              className="border rounded-lg px-3 py-2 flex-1"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Choisir un client</option>
              {clientOptions}
            </select>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setClientError(null);
                setShowClientModal(true);
              }}
            >
              + Ajouter
            </button>
          </div>
          <select
            className="border rounded-lg px-3 py-2"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'RANGE' | 'DATES')}
          >
            <option value="RANGE">Residence (periode)</option>
            <option value="DATES">Dates multiples</option>
          </select>
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Nom de la programmation"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {mode === 'RANGE' ? (
            <>
              <input
                className="border rounded-lg px-3 py-2"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <input
                className="border rounded-lg px-3 py-2"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </>
          ) : (
            <div className="md:col-span-2 space-y-2">
              <div className="rounded-lg border p-3 bg-white">
                <DayPicker
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={(dates) => setSelectedDates(dates ?? [])}
                />
              </div>
              <div className="text-sm text-slate-600">
                {selectedDates.length} date{selectedDates.length > 1 ? 's' : ''} selectionnee{selectedDates.length > 1 ? 's' : ''}.
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={lodgingIncluded}
              onChange={(e) => setLodgingIncluded(e.target.checked)}
            />
            Logement inclus
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mealsIncluded}
              onChange={(e) => setMealsIncluded(e.target.checked)}
            />
            Repas inclus
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={companionIncluded}
              onChange={(e) => setCompanionIncluded(e.target.checked)}
            />
            Accompagnant inclus
          </label>
        </div>
        <button
          className="btn btn-primary"
          disabled={creating || (mode === 'DATES' && selectedDates.length === 0)}
        >
          {creating ? 'Creation…' : 'Creer la programmation'}
        </button>
      </form>

      {showClientModal ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Nouveau client</h3>
            <input
              className="border rounded-lg px-3 py-2 w-full"
              placeholder="Nom du client"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
            />
            {clientError ? (
              <div className="text-sm text-red-600">{clientError}</div>
            ) : null}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn"
                onClick={() => setShowClientModal(false)}
                disabled={creating}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={createClient}
                disabled={creating}
              >
                {creating ? 'Creation…' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {safeResidencies.length === 0 ? (
          <div className="text-sm text-slate-500">Aucune programmation pour le moment.</div>
        ) : null}
        {safeResidencies.map((r) => {
          const clientName = Array.isArray(r.clients)
            ? r.clients[0]?.name
            : (r.clients as any)?.name;
          const occCount = Array.isArray(r.residency_occurrences)
            ? r.residency_occurrences[0]?.count
            : (r.residency_occurrences as any)?.count;
          const modeLabel =
            r.mode === 'DATES'
              ? occCount == null
                ? '• Dates multiples'
                : `• ${occCount} dates (du ${fmtDateFR(r.start_date)} au ${fmtDateFR(r.end_date)})`
              : `• ${fmtDateFR(r.start_date)} → ${fmtDateFR(r.end_date)}`;
          const address = buildAddress(r);
          const mapLink = address
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
            : null;
          const staticMapUrl =
            mapsKey && address
              ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=13&size=360x200&maptype=roadmap&markers=color:red%7C${encodeURIComponent(address)}&key=${mapsKey}`
              : null;
          return (
            <div key={r.id} className="rounded-xl border p-4 grid md:grid-cols-[1fr_200px] gap-4 bg-white">
              <div>
                <div className="font-semibold">{r.name}</div>
                <div className="text-sm text-slate-500">
                  {clientName || 'Client'} {modeLabel}
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  {address || 'Adresse non renseignée'}
                </div>
                {mapLink ? (
                  <a
                    href={mapLink}
                    target="_blank"
                    className="text-xs underline text-[var(--brand)]"
                  >
                    Voir sur Google Maps
                  </a>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                {staticMapUrl ? (
                  <img
                    src={staticMapUrl}
                    alt="Carte"
                    className="rounded-lg border object-cover w-full h-[120px]"
                  />
                ) : (
                  <div className="rounded-lg border bg-slate-50 text-xs text-slate-500 flex items-center justify-center h-[120px]">
                    Carte indisponible
                  </div>
                )}
                <Link href={`/admin/programming/${r.id}`} className="btn btn-primary">
                  Ouvrir l'agenda
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
