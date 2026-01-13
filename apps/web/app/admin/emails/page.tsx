'use client';

import { useMemo, useState } from 'react';

type SendResult = {
  ok: boolean;
  sent?: number;
  skipped_no_email?: number;
  skipped_already_sent?: number;
  errors?: Array<{ artist_id: string; error: string }>;
  error?: string;
};

type Formation = 'solo' | 'duo' | 'trio' | 'quartet' | 'dj';

const FORMATIONS: { value: Formation; label: string }[] = [
  { value: 'solo', label: 'Solo' },
  { value: 'duo', label: 'Duo' },
  { value: 'trio', label: 'Trio' },
  { value: 'quartet', label: 'Quartet' },
  { value: 'dj', label: 'DJ' },
];

export default function AdminEmailsPage() {
  const [formations, setFormations] = useState<Formation[]>([]);
  const [genresInput, setGenresInput] = useState('');
  const [subject, setSubject] = useState('Programmation ouverte');
  const [message, setMessage] = useState(
    'Une nouvelle programmation est ouverte. Vous pouvez proposer vos disponibilités depuis votre espace artiste.'
  );
  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const genres = useMemo(
    () =>
      genresInput
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean),
    [genresInput]
  );

  const toggleFormation = (value: Formation) => {
    setFormations((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]
    );
  };

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/emails/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PROGRAMMATION_OUVERTE',
          formations,
          genres,
          subject,
          message,
          test_mode: testMode,
        }),
      });
      const json = (await res.json()) as SendResult;
      if (!json.ok) throw new Error(json.error || 'Envoi impossible.');
      setResult(json);
    } catch (e: any) {
      setResult({ ok: false, error: e?.message ?? 'Erreur serveur.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Emails administrateur</h1>
        <p className="text-sm text-slate-600">Envoi groupé aux artistes selon vos filtres.</p>
      </header>

      <section className="rounded-xl border p-4 space-y-4">
        <div className="text-sm font-medium">Type d’envoi</div>
        <div className="text-sm text-slate-600">Programmation ouverte</div>
      </section>

      <section className="rounded-xl border p-4 space-y-4">
        <div className="text-sm font-medium">Filtres</div>
        <div className="space-y-2">
          <div className="text-xs text-slate-500">Formations</div>
          <div className="flex flex-wrap gap-2">
            {FORMATIONS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`px-3 py-1 rounded-full text-xs border ${
                  formations.includes(f.value)
                    ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
                onClick={() => toggleFormation(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-slate-500">Genres (séparés par des virgules)</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={genresInput}
            onChange={(e) => setGenresInput(e.target.value)}
            placeholder="Swing, Jazz manouche, Bossa nova"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={testMode}
            onChange={(e) => setTestMode(e.target.checked)}
          />
          Mode test (envoi à l’admin uniquement)
        </label>
        {testMode ? (
          <div className="text-xs text-slate-500">
            En mode test, aucun artiste ne reçoit l’email. Envoi uniquement à l’adresse admin.
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Sujet</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Message</label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 min-h-[140px]"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" type="button" onClick={() => setPreview((v) => !v)}>
            {preview ? 'Masquer la prévisualisation' : 'Prévisualiser'}
          </button>
          <button className="btn btn-primary" type="button" onClick={send} disabled={sending}>
            {sending ? 'Envoi en cours…' : 'Envoyer'}
          </button>
        </div>
        {preview ? (
          <div className="border rounded-lg p-3 text-sm text-slate-700 bg-slate-50">
            <div className="font-semibold mb-2">{subject}</div>
            <div className="whitespace-pre-wrap">{message}</div>
          </div>
        ) : null}
        {result ? (
          result.ok ? (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
              {result.test_mode
                ? 'Email de test envoyé à l’adresse administrateur.'
                : `Emails envoyés: ${result.sent ?? 0}. Sans email: ${result.skipped_no_email ?? 0}. Déjà envoyés: ${
                    result.skipped_already_sent ?? 0
                  }.`}
            </div>
          ) : (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
              {result.error}
            </div>
          )
        ) : null}
      </section>
    </div>
  );
}
