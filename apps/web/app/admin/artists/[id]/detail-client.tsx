'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const toArray = <T,>(value: T[] | T | null | undefined) =>
  Array.isArray(value) ? value : value ? [value] : [];

type ApplicationRow = {
  id: string;
  created_at: string;
  stage_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  bio: string | null;
  instagram_url: string | null;
  formations_supported: string[] | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  admin_notes: string | null;
  artist_application_event_formats?:
    | { event_format_id: number; event_formats?: { title: string } | null }[]
    | null;
};

export default function AdminArtistApplicationDetail({ id }: { id: string }) {
  const router = useRouter();
  const [item, setItem] = useState<ApplicationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');

  async function loadItem() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/admin/artist-applications/${id}`, {
        method: 'GET',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setError(json?.error || 'Impossible de charger la candidature');
        setItem(null);
        return;
      }
      setItem(json.item as ApplicationRow);
      setNotes((json.item?.admin_notes as string | null) ?? '');
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger la candidature');
      setItem(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItem();
  }, [id]);

  const formats = useMemo(() => {
    return toArray(item?.artist_application_event_formats);
  }, [item]);

  async function updateStatus(status: 'APPROVED' | 'REJECTED') {
    try {
      setSaving(true);
      setError('');
      const res = await fetch(`/api/admin/artist-applications/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes: notes || null }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setError(json?.error || 'Action impossible');
        return;
      }
      router.push('/admin/artists');
    } catch (e: any) {
      setError(e?.message ?? 'Action impossible');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-slate-500">Chargement...</div>;
  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-red-600">{error}</p>
        <Link href="/admin/artists" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-3">
        <p className="text-slate-500">Candidature introuvable.</p>
        <Link href="/admin/artists" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{item.stage_name}</h1>
          <p className="text-slate-500 text-sm">{item.email}</p>
        </div>
        <Link href="/admin/artists" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </header>

      <section className="border rounded-xl p-4 bg-white space-y-3">
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">Telephone</div>
            <div>{item.phone || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Ville</div>
            <div>{item.city || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Instagram</div>
            {item.instagram_url ? (
              <a className="underline text-[var(--brand)]" href={item.instagram_url} target="_blank">
                {item.instagram_url}
              </a>
            ) : (
              <div>—</div>
            )}
          </div>
          <div>
            <div className="text-xs text-slate-500">Status</div>
            <div>{item.status}</div>
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Bio</div>
          <div className="text-sm whitespace-pre-wrap">{item.bio || '—'}</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Formations</div>
          {item.formations_supported?.length ? (
            <div className="flex flex-wrap gap-2">
              {item.formations_supported.map((f) => (
                <span key={f} className="text-xs px-2 py-1 rounded-full bg-slate-100">
                  {f}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm">—</div>
          )}
        </div>

        <div>
          <div className="text-xs text-slate-500">Formats</div>
          {formats.length ? (
            <div className="flex flex-wrap gap-2">
              {formats.map((f) => (
                <span
                  key={f.event_format_id}
                  className="text-xs px-2 py-1 rounded-full bg-slate-100"
                >
                  {f.event_formats?.title || `Format #${f.event_format_id}`}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm">—</div>
          )}
        </div>
      </section>

      <section className="border rounded-xl p-4 bg-white space-y-3">
        <div className="text-sm font-medium">Note admin</div>
        <textarea
          className="w-full border rounded-lg px-3 py-2 min-h-[120px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex flex-wrap gap-2">
          <button
            disabled={saving}
            onClick={() => updateStatus('APPROVED')}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-60"
          >
            Approuver
          </button>
          <button
            disabled={saving}
            onClick={() => updateStatus('REJECTED')}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-60"
          >
            Refuser
          </button>
        </div>
      </section>
    </div>
  );
}
