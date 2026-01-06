'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseBrowser';
import { eventFormatOptions } from '@/lib/event-formats';

type Formation = 'solo' | 'duo' | 'trio' | 'quartet' | 'dj';

const FORMATIONS: { value: Formation; label: string }[] = [
  { value: 'solo', label: 'Solo' },
  { value: 'duo', label: 'Duo' },
  { value: 'trio', label: 'Trio' },
  { value: 'quartet', label: 'Quartet' },
  { value: 'dj', label: 'DJ' },
];

type VenueRow = {
  id: string;
  company_name: string | null;
  address_line1: string | null;
  postal_code: string | null;
  city: string | null;
  contact_name: string | null;
  billing_email: string | null;
  contact_phone: string | null;
};

export default function AdminNewRequestPage() {
  const router = useRouter();

  // UI
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');

  // Venues
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [venueId, setVenueId] = useState<string>('');
  const [useCustomVenue, setUseCustomVenue] = useState(false);

  // Form core
  const [eventFormat, setEventFormat] = useState<string>(eventFormatOptions()[0]?.value ?? ''); // slug canonique
  const [formation, setFormation] = useState<Formation>('solo');
  const [eventDate, setEventDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [startTime, setStartTime] = useState<string>('20:00');
  const [durationHours, setDurationHours] = useState<number | ''>(2);

  const [audienceSize, setAudienceSize] = useState<number | ''>('');
  const [practicalInfo, setPracticalInfo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Custom venue snapshot
  const [venueCompanyName, setVenueCompanyName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [venueContactName, setVenueContactName] = useState('');
  const [venueContactEmail, setVenueContactEmail] = useState('');
  const [venueContactPhone, setVenueContactPhone] = useState('');

  // Pricing (optionnel)
  const [priceClient, setPriceClient] = useState<number | ''>('');
  const [artistFee, setArtistFee] = useState<number | ''>('');
  const [artistExpenses, setArtistExpenses] = useState<number | ''>('');

  // Formats (exactement ceux du catalogue)
  const formatOptions = useMemo(() => eventFormatOptions(), []);

  // Charger établissements
  useEffect(() => {
    (async () => {
      setError('');
      try {
        const { data: { session }, error: sessErr } = await supabase.auth.getSession();
        if (sessErr) throw new Error(sessErr.message);
        if (!session) { router.push('/login'); return; }

        const { data, error } = await supabase
          .from('venues')
          .select('id, company_name, address_line1, postal_code, city, contact_name, billing_email, contact_phone')
          .order('company_name', { ascending: true });
        if (error) throw new Error(error.message);
        setVenues((data ?? []) as VenueRow[]);

        const firstVenue = (data ?? [])[0];
        if (firstVenue && !venueId) {
          setVenueId(firstVenue.id);
        } else if (!firstVenue && !useCustomVenue) {
          setUseCustomVenue(true);
          setVenueContactName((session.user.email ?? '').split('@')[0] || 'Contact admin');
          setVenueContactEmail(session.user.email ?? '');
        }
      } catch (e: any) {
        setError(e?.message ?? 'Erreur de chargement');
      }
    })();
  }, [router]);

  // Bascule vers mode "nouvel établissement"
  useEffect(() => {
    if (venueId === '__custom__') { setUseCustomVenue(true); setVenueId(''); }
  }, [venueId]);

  const canSubmit = useMemo(() => {
    return (
      !!eventFormat &&
      !!formation &&
      !!eventDate &&
      !!startTime &&
      (typeof durationHours === 'number' && durationHours > 0)
    );
  }, [eventFormat, formation, eventDate, startTime, durationHours]);

  const resetCustomVenue = () => {
    setVenueCompanyName('');
    setVenueAddress('');
    setVenueContactName('');
    setVenueContactEmail('');
    setVenueContactPhone('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setError('');

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? undefined;

      const payload: any = {
        event_format: eventFormat,               // slug canonique
        formation,
        event_date: eventDate,
        start_time: startTime,
        duration_minutes: typeof durationHours === 'number' ? Math.round(durationHours * 60) : null,
        audience_size: audienceSize === '' ? null : Number(audienceSize),
        practical_info: practicalInfo.trim() || null,
        notes: notes.trim() || null,
      };

      const fallbackContactName =
        venueContactName ||
        venueCompanyName ||
        session?.user?.user_metadata?.full_name ||
        (session?.user?.email ? session.user.email.split('@')[0] : '') ||
        'Contact admin';
      const fallbackContactEmail = venueContactEmail || session?.user?.email || null;

      if (!useCustomVenue && venueId) {
        payload.venue_id = venueId;
      } else {
        payload.venue_company_name = venueCompanyName || 'Établissement à préciser';
        payload.venue_address = venueAddress || 'Adresse à préciser';
        payload.venue_contact_name = fallbackContactName;
        payload.venue_contact_email = fallbackContactEmail;
        payload.venue_contact_phone = venueContactPhone || null;
      }

      // Tarifs (optionnel)
      payload.price_client = priceClient === '' ? null : Number(priceClient);
      payload.artist_fee = artistFee === '' ? null : Number(artistFee);
      payload.artist_expenses = artistExpenses === '' ? null : Number(artistExpenses);

      const res = await fetch('/api/admin/booking-requests', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.id) throw new Error(j?.error || 'Création impossible');

      // Reste sur le formulaire après création (confirmation e2e)
      console.debug('Admin request created', j.id);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur inconnue');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Créer un événement</h1>
          <p className="text-slate-600">Renseigne les détails, choisis un établissement, puis enregistre.</p>
        </div>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">← Retour</Link>
      </header>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-8">
        {/* Détails prestation */}
        <section className="border rounded-2xl p-4 space-y-4">
          <h2 className="text-lg font-semibold">Détails de la prestation</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Format de l’événement</label>
              <select
                className="w-full border p-3 rounded-xl"
                value={eventFormat}
                onChange={(e) => setEventFormat(e.target.value)}
                required
              >
                <option value="" disabled>Choisir un format…</option>
                {formatOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Libellés identiques au catalogue (After work live, Brunch musicale, Dj live elite, ...).
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Formation</label>
              <select
                className="w-full border p-3 rounded-xl"
                value={formation}
                onChange={(e) => setFormation(e.target.value as Formation)}
                required
              >
                {FORMATIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Date de l’événement</label>
              <input
                type="date"
                className="w-full border p-3 rounded-xl"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Heure de début</label>
              <input
                type="time"
                className="w-full border p-3 rounded-xl"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Durée (en heures)</label>
              <input
                type="number" min={0.5} step={0.5}
                className="w-full border p-3 rounded-xl"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="ex: 2"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Public estimé (optionnel)</label>
              <input
                type="number" min={1}
                className="w-full border p-3 rounded-xl"
                value={audienceSize}
                onChange={(e) => setAudienceSize(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="ex: 120"
              />
            </div>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium">Infos pratiques (optionnel)</label>
              <textarea
                className="w-full border p-3 rounded-xl"
                rows={4}
                placeholder="Accès, horaires d’installation, parking, sono fournie, etc."
                value={practicalInfo}
                onChange={(e) => setPracticalInfo(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Notes (interne) (optionnel)</label>
              <textarea
                className="w-full border p-3 rounded-xl"
                rows={3}
                placeholder="Informations internes (non partagées)."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Établissement */}
        <section className="border rounded-2xl p-4 space-y-4">
          <h2 className="text-lg font-semibold">Établissement</h2>

          {!useCustomVenue && (
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Sélectionner un établissement</label>
                <select
                  className="w-full border p-3 rounded-xl"
                  value={venueId}
                  onChange={(e) => setVenueId(e.target.value)}
                >
                  <option value="">— Choisir —</option>
                  {venues.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.company_name || v.id} {v.city ? `• ${v.city}` : ''}
                    </option>
                  ))}
                  <option value="__custom__">+ Nouvel établissement…</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn"
                  onClick={() => { setUseCustomVenue(true); setVenueId(''); }}
                >
                  Renseigner un nouvel établissement
                </button>
              </div>
            </div>
          )}

          {useCustomVenue && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">Saisie rapide (snapshot)</div>
                <button
                  type="button"
                  className="text-sm underline"
                  onClick={() => { setUseCustomVenue(false); resetCustomVenue(); }}
                >
                  ← Revenir à la liste
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Nom de l’établissement</label>
                  <input
                    className="w-full border p-3 rounded-xl"
                    value={venueCompanyName}
                    onChange={(e) => setVenueCompanyName(e.target.value)}
                    placeholder="Ex : Le Toit Paris"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Contact</label>
                  <input
                    className="w-full border p-3 rounded-xl"
                    value={venueContactName}
                    onChange={(e) => setVenueContactName(e.target.value)}
                    placeholder="Nom du contact"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <input
                    type="email"
                    className="w-full border p-3 rounded-xl"
                    value={venueContactEmail}
                    onChange={(e) => setVenueContactEmail(e.target.value)}
                    placeholder="contact@exemple.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Téléphone</label>
                  <input
                    className="w-full border p-3 rounded-xl"
                    value={venueContactPhone}
                    onChange={(e) => setVenueContactPhone(e.target.value)}
                    placeholder="+33 6 12 34 56 78"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Adresse</label>
                  <input
                    className="w-full border p-3 rounded-xl"
                    value={venueAddress}
                    onChange={(e) => setVenueAddress(e.target.value)}
                    placeholder="Adresse complète"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Ces champs seront enregistrés en “snapshot” sur la demande si l’établissement n’est pas référencé.
              </p>
            </div>
          )}
        </section>

        {/* Tarification (interne) */}
        <section className="border rounded-2xl p-4 space-y-4">
          <h2 className="text-lg font-semibold">Tarification interne (optionnel)</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Montant client</label>
              <input
                type="number" step="0.01" min="0"
                className="w-full border p-3 rounded-xl"
                value={priceClient}
                onChange={(e) => setPriceClient(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="ex: 1500"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Cachet artiste</label>
              <input
                type="number" step="0.01" min="0"
                className="w-full border p-3 rounded-xl"
                value={artistFee}
                onChange={(e) => setArtistFee(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="ex: 800"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Frais internes</label>
              <input
                type="number" step="0.01" min="0"
                className="w-full border p-3 rounded-xl"
                value={artistExpenses}
                onChange={(e) => setArtistExpenses(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="ex: 150"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Les montants restent invisibles pour le client et pour l’artiste (RLS).
          </p>
        </section>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!canSubmit || saving}
            title={!canSubmit ? 'Complète les champs requis' : 'Créer la demande'}
          >
            {saving ? 'Création…' : 'Créer la demande'}
          </button>
          <Link href="/dashboard" className="btn">Annuler</Link>
        </div>
      </form>
    </div>
  );
}
