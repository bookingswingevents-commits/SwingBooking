'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type EventFormat = {
  id: number;
  title: string;
};

type ApplicationRow = {
  id: string;
  created_at: string;
  stage_name: string;
  email: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  formations_supported: string[] | null;
  artist_application_event_formats?:
    | { event_format_id: number; event_formats?: { title: string } | null }[]
    | null;
};

const statusOptions = [
  { id: 'PENDING', label: 'PENDING' },
  { id: 'APPROVED', label: 'APPROVED' },
  { id: 'REJECTED', label: 'REJECTED' },
];

export default function AdminArtistApplicationsList() {
  const [formats, setFormats] = useState<EventFormat[]>([]);
  const [items, setItems] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [status, setStatus] = useState('PENDING');
  const [formatId, setFormatId] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/formats');
        const data = await res.json();
        if (!alive) return;
        setFormats((data ?? []) as EventFormat[]);
      } catch (_e) {
        if (!alive) return;
        setFormats([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (formatId) params.set('event_format_id', formatId);
    if (query.trim()) params.set('q', query.trim());
    return params.toString();
  }, [status, formatId, query]);

  async function loadItems() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/admin/artist-applications?${queryString}`, {
        method: 'GET',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setError(json?.error || 'Erreur de chargement');
        setItems([]);
        return;
      }
      setItems((json.items ?? []) as ApplicationRow[]);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur de chargement');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, [queryString]);

  const formatOptions = formats.map((f) => (
    <option key={f.id} value={String(f.id)}>
      {f.title}
    </option>
  ));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Candidatures artistes</h1>
          <p className="text-slate-600 text-sm">Onboarding admin-operate.</p>
        </div>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </header>

      <div className="rounded-xl border p-4 grid gap-3 md:grid-cols-3 bg-white">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Status</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {statusOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">Format</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={formatId}
            onChange={(e) => setFormatId(e.target.value)}
          >
            <option value="">Tous les formats</option>
            {formatOptions}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">Recherche</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Stage name ou email"
          />
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg p-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="text-slate-500">Aucune candidature.</div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => {
            const formats = Array.isArray(item.artist_application_event_formats)
              ? item.artist_application_event_formats
              : [];
            return (
              <Link
                key={item.id}
                href={`/admin/artists/${item.id}`}
                className="border rounded-xl p-4 bg-white hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{item.stage_name}</div>
                    <div className="text-sm text-slate-500">{item.email}</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full border">
                    {item.status}
                  </span>
                </div>

                {formats.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formats.map((f) => (
                      <span
                        key={f.event_format_id}
                        className="text-[11px] px-2 py-1 rounded-full bg-slate-100"
                      >
                        {f.event_formats?.title || `Format #${f.event_format_id}`}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
