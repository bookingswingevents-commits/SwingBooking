'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { fmtDateFR } from '@/lib/date';
import { supabase } from '@/lib/supabaseBrowser';

type Format = { id: number; title: string; slug?: string; description?: string; image_url?: string };

const FORMATIONS = [
  { value: 'solo', label: 'Solo' },
  { value: 'duo', label: 'Duo' },
  { value: 'trio', label: 'Trio' },
  { value: 'quartet', label: 'Quartet' },
  { value: 'dj', label: 'DJ' },
];

type Role = 'artist' | 'venue' | 'admin' | null;

const buildAddress = (line1?: string | null, line2?: string | null, zip?: string | null, city?: string | null) => {
  const parts = [
    line1?.trim() || '',
    line2?.trim() || '',
    [zip?.trim() || '', city?.trim() || ''].filter(Boolean).join(' '),
  ].filter(Boolean);
  return parts.join(', ');
};

function NewRequestInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const formatId = Number(sp.get('format'));

  const [formats, setFormats] = useState<Format[]>([]);
  const [loadingFormats, setLoadingFormats] = useState(true);

  // Session / rôle
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<Role>(null);

  // Champs du formulaire
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('20:00');
  const [formation, setFormation] = useState<string>('solo');
  const [occurrences, setOccurrences] = useState<
    { date: string; start_time: string; duration_minutes: number | null; address_snapshot: string; audience_estimate: number | null }[]
  >([{ date: '', start_time: '20:00', duration_minutes: null, address_snapshot: '', audience_estimate: null }]);

  const [venueCompanyName, setVenueCompanyName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [defaultVenueAddress, setDefaultVenueAddress] = useState('');
  const [useDifferentAddress, setUseDifferentAddress] = useState(true);
  const [location, setLocation] = useState(''); // précision lieu
  const [venueContactName, setVenueContactName] = useState('');
  const [venueContactPhone, setVenueContactPhone] = useState('');
  const [venueContactEmail, setVenueContactEmail] = useState('');

  const [audience, setAudience] = useState<number>(100);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [managedBooking, setManagedBooking] = useState(false);
  const [travelCovered, setTravelCovered] = useState(false);
  const [travelModes, setTravelModes] = useState<string[]>([]);
  const [travelNotes, setTravelNotes] = useState('');
  const [accommodationProvided, setAccommodationProvided] = useState(false);
  const [accommodationType, setAccommodationType] = useState('');
  const [accommodationNotes, setAccommodationNotes] = useState('');
  const [mealProvided, setMealProvided] = useState(false);
  const [mealNotes, setMealNotes] = useState('');

  // Succès + id de la demande créée
  const [success, setSuccess] = useState(false);
  const [successRequestId, setSuccessRequestId] = useState<string | null>(null);

  // 1) Charger la session + rôle
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.user) return;

      setUserId(session.user.id);

      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (prof?.role) {
        setUserRole(prof.role as Role);
      }

      if (prof?.role === 'venue') {
        const { data: venue } = await supabase
          .from('venues')
          .select(
            'company_name, contact_name, contact_phone, billing_email, address_line1, address_line2, postal_code, city'
          )
          .eq('id', session.user.id)
          .maybeSingle();
        if (venue) {
          if (!venueCompanyName) setVenueCompanyName(venue.company_name ?? '');
          if (!venueContactName) setVenueContactName(venue.contact_name ?? '');
          if (!venueContactPhone) setVenueContactPhone(venue.contact_phone ?? '');
          if (!venueContactEmail) setVenueContactEmail(venue.billing_email ?? (session.user.email ?? ''));
          const addr = buildAddress(
            venue.address_line1,
            venue.address_line2,
            venue.postal_code,
            venue.city
          );
          if (addr) {
            setDefaultVenueAddress(addr);
            setUseDifferentAddress(false);
          } else {
            setDefaultVenueAddress('');
            setUseDifferentAddress(true);
          }
        } else if (session.user.email && !venueContactEmail) {
          setVenueContactEmail(session.user.email);
        }
      } else {
        setUseDifferentAddress(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Charger les formats pour l’affichage
  useEffect(() => {
    (async () => {
      setLoadingFormats(true);
      try {
        const res = await fetch('/api/formats', { cache: 'no-store' });
        const data = await res.json();
        setFormats(data ?? []);
      } catch (e) {
        console.error('formats load error', e);
      } finally {
        setLoadingFormats(false);
      }
    })();
  }, []);

  const selected = useMemo(
    () => formats.find((f) => f.id === formatId),
    [formats, formatId]
  );

  const updateOccurrence = (
    idx: number,
    field: keyof (typeof occurrences)[number],
    value: any
  ) => {
    setOccurrences((prev) =>
      prev.map((o, i) => (i === idx ? { ...o, [field]: value } : o))
    );
  };

  const addOccurrence = () => {
    setOccurrences((prev) => [
      ...prev,
      { date: '', start_time: '20:00', duration_minutes: null, address_snapshot: '', audience_estimate: null },
    ]);
  };

  const removeOccurrence = (idx: number) => {
    setOccurrences((prev) => prev.filter((_, i) => i !== idx));
  };

  // Synchronise la première occurrence avec les champs principaux (pour compatibilité)
  useEffect(() => {
    setOccurrences((prev) => {
      if (!prev.length) return [{ date: eventDate, start_time: startTime, duration_minutes: null, address_snapshot: '', audience_estimate: audience }];
      const [first, ...rest] = prev;
      return [
        {
          ...first,
          date: eventDate,
          start_time: startTime,
          audience_estimate: audience ?? first.audience_estimate,
        },
        ...rest,
      ];
    });
  }, [eventDate, startTime, audience]);

  const resolvedVenueAddress = useMemo(
    () => (useDifferentAddress ? venueAddress.trim() : defaultVenueAddress.trim()),
    [useDifferentAddress, venueAddress, defaultVenueAddress]
  );

  // 3) Envoi via API SERVEUR
  async function create(e: React.FormEvent) {
    e.preventDefault();

    if (!selected) return alert('Format introuvable.');
    if (!eventDate) return alert("Merci d’indiquer la date de l’événement.");
    if (!resolvedVenueAddress) return alert("Merci d’indiquer l’adresse de l’établissement.");
    if (!venueContactName) return alert('Merci d’indiquer un contact.');

    const normalizedEmail = venueContactEmail.trim().toLowerCase();
    if (!normalizedEmail) return alert('Merci d’indiquer un email de contact.');

    const occPayload = occurrences
      .filter((o) => o.date)
      .map((o) => ({
        date: o.date,
        start_time: o.start_time || null,
        duration_minutes: o.duration_minutes ?? null,
        address_snapshot: o.address_snapshot || resolvedVenueAddress || null,
        audience_estimate: o.audience_estimate ?? audience ?? null,
      }));

    const mainDate = occPayload[0]?.date || eventDate;
    if (!mainDate) {
      return alert("Merci d'ajouter au moins une date d'occurrence.");
    }

    setSubmitting(true);
    try {
      const autoTitle = `${selected.title} — ${fmtDateFR(mainDate)} — ${formation.toUpperCase()}`;
      const combinedNotes = [
        startTime ? `Heure souhaitée: ${startTime}` : null,
        location ? `Précision lieu: ${location}` : null,
        notes?.trim() ? notes.trim() : null,
      ]
        .filter(Boolean)
        .join('\n');

      // Si l’utilisateur est connecté comme établissement, on rattache la demande à son compte
      const venue_id = userRole === 'venue' ? userId : null;

      const res = await fetch('/api/requests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_format_id: selected.id,
          event_format: selected.slug ?? null,
          title: autoTitle,
          event_date: mainDate,
          start_time: startTime || null,
          duration_minutes: null,
          location,
          audience_size: audience,
          notes: combinedNotes,
          formation,
          // snapshots établissement
          venue_company_name: venueCompanyName || null,
          venue_address: resolvedVenueAddress,
          venue_contact_name: venueContactName,
          venue_contact_phone: venueContactPhone || null,
          venue_contact_email: normalizedEmail,
          venue_id, // 🟦 nouvelle clé pour lier à l’établissement connecté
          travel_covered: travelCovered,
          travel_modes: travelModes,
          travel_notes: travelNotes || null,
          accommodation_provided: accommodationProvided,
          accommodation_type: accommodationType || null,
          accommodation_notes: accommodationNotes || null,
          meal_provided: mealProvided,
          meal_notes: mealNotes || null,
          managed_booking: managedBooking,
          occurrences: occPayload,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Échec de la demande');

      // L’API renvoie { ok: true, id, venue_id }
      const rid =
        json.id ??
        json.request_id ??
        json.data?.id ??
        json.data?.request_id ??
        null;

      setSuccessRequestId(rid ?? null);
      setSuccess(true);
    } catch (e: any) {
      alert("Impossible d'envoyer la demande : " + (e?.message ?? 'Erreur inconnue'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingFormats) return <div className="text-slate-500">Chargement…</div>;
  if (!selected) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Demande de prestation</h1>
        <p className="text-slate-600">
          Format introuvable. Retour au{' '}
          <a className="text-[var(--brand)] underline" href="/catalogue">
            catalogue
          </a>
          .
        </p>
      </div>
    );
  }

  // ✅ Vue de confirmation après succès
  if (success) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <h1 className="text-xl font-semibold">Merci, votre demande a bien été envoyée ✅</h1>
          <p className="text-sm mt-2">
            Nous avons bien reçu votre demande pour&nbsp;
            <strong>{selected.title}</strong>
            {eventDate ? <> le <strong>{fmtDateFR(eventDate)}</strong></> : null}.<br />
            Vous recevrez prochainement une <strong>proposition d’artiste</strong> par email,
            avec tous les détails de la prestation.
          </p>
          <p className="text-xs mt-3 text-emerald-800">
            {userRole === 'venue'
              ? 'Votre demande est déjà visible dans votre tableau de bord établissement.'
              : 'Si vous disposez d’un compte établissement Swing Booking, vous pourrez suivre cette demande depuis votre tableau de bord.'}
          </p>
        </div>

        <div className="rounded-xl border p-4 bg-white space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Et maintenant ?</h2>
          <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
            <li>Nous analysons votre demande et sélectionnons un artiste adapté.</li>
            <li>Vous recevez une proposition avec bio, liens, tarif et conditions.</li>
            <li>Vous pourrez accepter, refuser ou demander une modification.</li>
          </ul>

          <div className="flex flex-wrap gap-3 mt-3">
            {successRequestId && (
              <button
                type="button"
                onClick={() => router.push(`/venue/requests/${successRequestId}`)}
                className="btn btn-primary"
              >
                Voir la demande
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push('/catalogue')}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
            >
              Retour au catalogue
            </button>
            {!userId && (
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
              >
                Se connecter / créer un compte
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 📝 Vue formulaire (avant envoi)
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {userRole === 'venue' ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 text-sm">
          Vous êtes connecté : la demande sera automatiquement rattachée à votre établissement.
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">
          Pas besoin de compte : remplis les infos ci-dessous et envoie ta demande.
        </div>
      )}

      {/* En-tête format */}
      <div className="rounded-2xl overflow-hidden border shadow-sm">
        {selected.image_url ? (
          <img
            src={selected.image_url}
            alt={selected.title}
            className="w-full h-56 object-cover"
          />
        ) : null}
        <div className="p-6">
          <h1 className="text-2xl font-extrabold">{selected.title}</h1>
          {selected.description ? (
            <p className="text-slate-600 mt-1">{selected.description}</p>
          ) : null}
        </div>
      </div>

      {/* Formulaire */}
      <form onSubmit={create} className="space-y-6">
        <fieldset className="grid md:grid-cols-2 gap-4" disabled={submitting}>
          {/* Date & heure */}
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="request-date">
              Date de l’événement
            </label>
            <input
              id="request-date"
              className="w-full border p-3 rounded-xl"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="request-start-time">
              Heure souhaitée
            </label>
            <input
              id="request-start-time"
              className="w-full border p-3 rounded-xl"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          {/* Occurrences multiples */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Dates & lieux (occurrences)</h3>
              <button
                type="button"
                className="text-xs underline text-[var(--brand)]"
                onClick={addOccurrence}
              >
                Ajouter une date
              </button>
            </div>
            <div className="space-y-3">
              {occurrences.map((occ, idx) => (
                <div
                  key={`occ-${idx}`}
                  className="grid md:grid-cols-5 gap-3 p-3 rounded-xl border bg-white"
                >
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Date</label>
                    <input
                      type="date"
                      className="w-full border rounded-xl p-3"
                      value={occ.date}
                      onChange={(e) => updateOccurrence(idx, 'date', e.target.value)}
                      required={idx === 0}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Heure</label>
                    <input
                      type="time"
                      className="w-full border rounded-xl p-3"
                      value={occ.start_time}
                      onChange={(e) => updateOccurrence(idx, 'start_time', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Durée (min)</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded-xl p-3"
                      value={occ.duration_minutes ?? ''}
                      onChange={(e) =>
                        updateOccurrence(
                          idx,
                          'duration_minutes',
                          e.target.value === '' ? null : Number(e.target.value)
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Adresse</label>
                    <input
                      className="w-full border rounded-xl p-3"
                      value={occ.address_snapshot}
                      onChange={(e) =>
                        updateOccurrence(idx, 'address_snapshot', e.target.value)
                      }
                      placeholder="Laisser vide si même adresse"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Public estimé</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded-xl p-3"
                      value={occ.audience_estimate ?? ''}
                      onChange={(e) =>
                        updateOccurrence(
                          idx,
                          'audience_estimate',
                          e.target.value === '' ? null : Number(e.target.value)
                        )
                      }
                    />
                  </div>
                  {idx > 0 && (
                    <div className="md:col-span-5 flex justify-end">
                      <button
                        type="button"
                        className="text-xs text-red-600 underline"
                        onClick={() => removeOccurrence(idx)}
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Formation */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Formation souhaitée</label>
            <select
              className="w-full border p-3 rounded-xl"
              value={formation}
              onChange={(e) => setFormation(e.target.value)}
              required
            >
              {FORMATIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Taille public */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Taille du public (approx.)</label>
            <div className="flex items-center gap-3">
              <input
                className="flex-1 accent-[var(--accent)]"
                type="range"
                min={20}
                max={500}
                step={10}
                value={audience}
                onChange={(e) => setAudience(parseInt(e.target.value))}
              />
              <div className="w-16 text-right font-medium">{audience}</div>
            </div>
          </div>

          {/* Établissement */}
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">
              Nom de l’établissement (optionnel)
            </label>
            <input
              className="w-full border p-3 rounded-xl"
              placeholder="Nom établissement"
              value={venueCompanyName}
              onChange={(e) => setVenueCompanyName(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="request-venue-address">
              Adresse de l’établissement
            </label>
            {defaultVenueAddress ? (
              <div className="text-sm text-slate-600">
                Adresse par défaut : <span className="font-medium">{defaultVenueAddress}</span>
              </div>
            ) : (
              <div className="text-sm text-slate-500">
                Adresse par défaut non renseignée.
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useDifferentAddress}
                onChange={(e) => setUseDifferentAddress(e.target.checked)}
              />
              Adresse différente
            </label>
            {useDifferentAddress ? (
              <input
                id="request-venue-address"
                className="w-full border p-3 rounded-xl"
                placeholder="Adresse complète"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                required
              />
            ) : null}
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Précision lieu (optionnel)</label>
            <input
              className="w-full border p-3 rounded-xl"
              placeholder="Salle, étage, accès, parking…"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* Contact établissement */}
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="request-contact-name">
              Contact établissement
            </label>
            <input
              id="request-contact-name"
              className="w-full border p-3 rounded-xl"
              placeholder="Nom et prénom"
              value={venueContactName}
              onChange={(e) => setVenueContactName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="request-contact-phone">
              Téléphone (optionnel)
            </label>
            <input
              id="request-contact-phone"
              className="w-full border p-3 rounded-xl"
              placeholder="+33 6 12 34 56 78"
              value={venueContactPhone}
              onChange={(e) => setVenueContactPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="request-contact-email">
              Email
            </label>
            <input
              id="request-contact-email"
              className="w-full border p-3 rounded-xl"
              type="email"
              placeholder="contact@etablissement.fr"
              value={venueContactEmail}
              onChange={(e) => setVenueContactEmail(e.target.value)}
              required
            />
          </div>
        </fieldset>

        {/* Mode de rémunération souhaité */}
        {/* Mode de rémunération retiré côté client (décidé plus tard avec l'artiste) */}

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Notes (optionnel)</label>
          <textarea
            className="w-full border p-3 rounded-xl min-h-[120px]"
            placeholder="Ambiance souhaitée, contraintes techniques, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <p className="text-xs text-slate-500">
            Titre généré : <strong>{selected.title}</strong>
            {occurrences[0]?.date ? ` — ${fmtDateFR(occurrences[0].date)}` : ''} — {formation.toUpperCase()}.
          </p>
        </div>

        {/* VHR */}
        <section className="border rounded-2xl p-4 space-y-3 bg-white">
          <h3 className="text-lg font-semibold">Voyage / Hébergement / Restauration</h3>

          <div className="flex flex-wrap gap-4 items-center">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={travelCovered}
                onChange={(e) => setTravelCovered(e.target.checked)}
              />
              Voyage / défraiement pris en charge
            </label>
            <div className="flex flex-wrap gap-2 text-xs">
              {['car', 'train', 'flight'].map((mode) => (
                <label key={mode} className="flex items-center gap-1 border rounded-full px-2 py-1 text-xs">
                  <input
                    type="checkbox"
                    checked={travelModes.includes(mode)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setTravelModes((prev) =>
                        checked ? Array.from(new Set([...prev, mode])) : prev.filter((m) => m !== mode)
                      );
                    }}
                  />
                  {mode === 'car' ? 'Voiture' : mode === 'train' ? 'Train' : 'Vol'}
                </label>
              ))}
            </div>
          </div>
          <textarea
            className="w-full border rounded-xl p-3 min-h-[80px]"
            value={travelNotes}
            onChange={(e) => setTravelNotes(e.target.value)}
            placeholder="Précisions voyage (horaires souhaités, ville de départ, etc.)"
          />

          <div className="flex flex-wrap gap-4 items-center">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={accommodationProvided}
                onChange={(e) => setAccommodationProvided(e.target.checked)}
              />
              Hébergement proposé
            </label>
            <select
              className="border rounded-xl p-2 text-sm"
              value={accommodationType}
              onChange={(e) => setAccommodationType(e.target.value)}
              disabled={!accommodationProvided}
            >
              <option value="">Type d’hébergement</option>
              <option value="hotel">Hôtel</option>
              <option value="private">Logement privé</option>
              <option value="other">Autre</option>
            </select>
          </div>
          <textarea
            className="w-full border rounded-xl p-3 min-h-[80px]"
            value={accommodationNotes}
            onChange={(e) => setAccommodationNotes(e.target.value)}
            placeholder="Précisions hébergement (adresse, check-in, etc.)"
            disabled={!accommodationProvided}
          />

          <div className="flex flex-wrap gap-4 items-center">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mealProvided}
                onChange={(e) => setMealProvided(e.target.checked)}
              />
              Repas prévus pour l’artiste
            </label>
          </div>
          <textarea
            className="w-full border rounded-xl p-3 min-h-[80px]"
            value={mealNotes}
            onChange={(e) => setMealNotes(e.target.value)}
            placeholder="Précisions repas (catering, tickets resto, horaires…) "
            disabled={!mealProvided}
          />
        </section>

        <div className="flex items-center justify-end gap-3">
          <a
            href="/catalogue"
            className="px-4 py-2 rounded-xl border border-slate-200"
          >
            Retour
          </a>
          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Envoi…' : 'Envoyer la demande'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewRequest() {
  return (
    <Suspense fallback={<div className="text-slate-500">Chargement…</div>}>
      <NewRequestInner />
    </Suspense>
  );
}
