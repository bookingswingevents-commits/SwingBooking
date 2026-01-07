'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type EventFormat = {
  id: number;
  title: string;
};

type ArtistRow = {
  id: string;
  stage_name: string | null;
  formations: string[] | null;
  instagram_url?: string | null;
  is_active: boolean | null;
  artist_event_formats?:
    | { event_format_id: number; event_formats?: { title: string } | null }[]
    | null;
  full_name?: string | null;
  email?: string | null;
};

export default function AdminArtistsList() {
  const [formats, setFormats] = useState<EventFormat[]>([]);
  const [items, setItems] = useState<ArtistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formatId, setFormatId] = useState('');

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
    if (formatId) params.set('format_id', formatId);
    return params.toString();
  }, [formatId]);

  async function loadItems() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/admin/artists?${queryString}`, {
        method: 'GET',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setError(json?.error || 'Erreur de chargement');
        setItems([]);
        return;
      }
      setItems((json.data ?? []) as ArtistRow[]);
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
          <h1 className="text-2xl font-bold">Catalogue artistes (admin)</h1>
          <p className="text-slate-600 text-sm">Liste privee des artistes inscrits.</p>
        </div>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </header>

      <div className="rounded-xl border p-4 grid gap-3 md:grid-cols-3 bg-white">
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
      </div>

      {error && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg p-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="text-slate-500">Aucun artiste.</div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => {
            const formats = Array.isArray(item.artist_event_formats)
              ? item.artist_event_formats
              : [];
            return (
              <div key={item.id} className="border rounded-xl p-4 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">
                      {item.stage_name || item.full_name || 'Artiste'}
                    </div>
                    <div className="text-sm text-slate-500">
                      {item.email || '—'}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full border">
                    {item.is_active ? 'ACTIVE' : 'INACTIF'}
                  </span>
                </div>

                {item.instagram_url ? (
                  <div className="text-sm mt-2">
                    <a
                      className="underline text-[var(--brand)]"
                      href={item.instagram_url}
                      target="_blank"
                    >
                      Instagram
                    </a>
                  </div>
                ) : null}

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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
