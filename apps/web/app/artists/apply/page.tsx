'use client';

import { useEffect, useMemo, useState } from 'react';

type EventFormat = {
  id: number;
  title: string;
};

type FormErrors = {
  stage_name?: string;
  email?: string;
  event_formats?: string;
  submit?: string;
};

const formationsList = [
  { id: 'solo', label: 'Solo' },
  { id: 'duo', label: 'Duo' },
  { id: 'trio', label: 'Trio' },
  { id: 'band', label: 'Band' },
  { id: 'dj', label: 'DJ' },
];

export default function ArtistApplyPage() {
  const [formats, setFormats] = useState<EventFormat[]>([]);
  const [loadingFormats, setLoadingFormats] = useState(true);
  const [formatsError, setFormatsError] = useState('');

  const [stageName, setStageName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [bio, setBio] = useState('');
  const [formations, setFormations] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<number[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingFormats(true);
        setFormatsError('');
        const res = await fetch('/api/formats');
        const data = await res.json();
        if (!alive) return;
        if (!res.ok) {
          setFormatsError('Impossible de charger les formats.');
          setFormats([]);
          return;
        }
        setFormats((data ?? []) as EventFormat[]);
      } catch (e: any) {
        if (!alive) return;
        setFormatsError(e?.message ?? 'Erreur de chargement des formats.');
      } finally {
        if (alive) setLoadingFormats(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const canSubmit = useMemo(() => {
    return stageName.trim().length > 0 && email.includes('@') && selectedFormats.length > 0;
  }, [stageName, email, selectedFormats]);

  function toggleFormation(id: string) {
    setFormations((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }

  function toggleFormat(id: number) {
    setSelectedFormats((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: FormErrors = {};
    if (!stageName.trim()) nextErrors.stage_name = 'Nom de scene requis.';
    if (!email.includes('@')) nextErrors.email = 'Email invalide.';
    if (selectedFormats.length === 0) nextErrors.event_formats = 'Choisissez au moins un format.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      setSubmitting(true);
      setErrors({});
      const res = await fetch('/api/artists/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage_name: stageName,
          email,
          phone: phone || null,
          city: city || null,
          bio: bio || null,
          instagram_url: instagramUrl || null,
          formations_supported: formations,
          event_format_ids_supported: selectedFormats,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setErrors({ submit: json?.error || 'Erreur lors de la candidature.' });
        return;
      }
      setSubmitted(true);
    } catch (e: any) {
      setErrors({ submit: e?.message ?? 'Erreur lors de la candidature.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-10 space-y-4">
        <h1 className="text-2xl font-bold">Merci, on te contacte rapidement.</h1>
        <p className="text-slate-600">
          Ta candidature a bien ete envoyee. L'equipe Swing Booking reviendra vers toi des que possible.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Candidature artiste</h1>
        <p className="text-slate-600">
          Deviens disponible pour les programmations Swing Booking. Remplis les infos ci-dessous.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nom de scene *</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
            />
            {errors.stage_name && (
              <div className="text-xs text-red-600">{errors.stage_name}</div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Email *</label>
            <input
              type="email"
              className="w-full border rounded-lg px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && (
              <div className="text-xs text-red-600">{errors.email}</div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Telephone</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Ville</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium">Instagram URL</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium">Bio</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 min-h-[120px]"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Formations</div>
          <div className="flex flex-wrap gap-2">
            {formationsList.map((f) => (
              <label key={f.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formations.includes(f.id)}
                  onChange={() => toggleFormation(f.id)}
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Formats supportes *</div>
          {loadingFormats ? (
            <div className="text-sm text-slate-500">Chargement des formats...</div>
          ) : formatsError ? (
            <div className="text-sm text-red-600">{formatsError}</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {formats.map((f) => (
                <label key={f.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedFormats.includes(f.id)}
                    onChange={() => toggleFormat(f.id)}
                  />
                  {f.title}
                </label>
              ))}
            </div>
          )}
          {errors.event_formats && (
            <div className="text-xs text-red-600">{errors.event_formats}</div>
          )}
        </div>

        {errors.submit && (
          <div className="text-sm text-red-600">{errors.submit}</div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-[var(--brand)] text-white disabled:opacity-60"
        >
          {submitting ? 'Envoi en cours...' : 'Envoyer ma candidature'}
        </button>
      </form>
    </div>
  );
}
