'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR } from '@/lib/date';

type Role = 'admin' | 'venue' | 'artist';
type Formation = 'solo' | 'duo' | 'trio' | 'quartet' | 'dj';

type Profile = { id: string; role: Role };

type UnlockedArtist = {
  id: number;
  artist_id: string;
  first_unlocked_at: string;
  artists: {
    id: string;
    stage_name: string | null;
    genres?: string[] | null;
    formations?: Formation[] | null;
    instagram_url?: string | null;
    youtube_url?: string | null;
  } | null;
};

const FORMATION_LABEL: Record<Formation, string> = {
  solo: 'Solo',
  duo: 'Duo',
  trio: 'Trio',
  quartet: 'Quartet',
  dj: 'DJ',
};

export default function VenueArtistsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<UnlockedArtist[]>([]);
  const [error, setError] = useState<string>('');

  const [search, setSearch] = useState('');
  const [formationFilter, setFormationFilter] = useState<Formation | 'all'>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');

      const {
        data: { session },
        error: sessErr,
      } = await supabase.auth.getSession();
      if (sessErr) {
        setError(`Erreur session : ${sessErr.message}`);
        setLoading(false);
        return;
      }
      if (!session) {
        router.push('/login');
        return;
      }
      const userId = session.user.id;

      // Récupérer le profil pour vérifier que c'est bien une venue
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', userId)
        .maybeSingle();
      if (profErr) {
        setError(`Erreur profil : ${profErr.message}`);
        setLoading(false);
        return;
      }

      if (!prof || prof.role !== 'venue') {
        setProfile(prof as Profile);
        setError("Cette page est réservée aux établissements (venues).");
        setLoading(false);
        return;
      }

      setProfile(prof as Profile);

      // Récupérer les artistes débloqués pour cette venue
      const { data, error: unlockedErr } = await supabase
        .from('venue_unlocked_artists')
        .select(
          `
          id,
          artist_id,
          first_unlocked_at,
          artists (
            id,
            stage_name,
            genres,
            formations,
            instagram_url,
            youtube_url
          )
        `
        )
        .eq('venue_id', userId)
        .order('first_unlocked_at', { ascending: false });

      if (unlockedErr) {
        setError(`Erreur chargement artistes : ${unlockedErr.message}`);
        setItems([]);
      } else {
        const normalized =
          (data ?? []).map((row: any) => ({
            ...row,
            artists: Array.isArray(row.artists) ? row.artists[0] ?? null : row.artists,
          })) as UnlockedArtist[];
        setItems(normalized);
      }

      setLoading(false);
    })();
  }, [router]);

  const filtered = useMemo(() => {
    let list = items;

    if (formationFilter !== 'all') {
      list = list.filter((ua) =>
        ua.artists?.formations?.includes(formationFilter)
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((ua) => {
        const a = ua.artists;
        if (!a) return false;
        const name = (a.stage_name || '').toLowerCase();
        const genres = (a.genres || []).join(' ').toLowerCase();
        return name.includes(q) || genres.includes(q);
      });
    }

    return list;
  }, [items, formationFilter, search]);

  if (loading) {
    return <div className="text-slate-500">Chargement du catalogue artistes…</div>;
  }

  if (error && !profile) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Mon catalogue d&apos;artistes</h1>
        <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-3xl font-bold">Mon catalogue d&apos;artistes</h1>
          <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
            ← Retour au dashboard
          </Link>
        </div>
        <p className="text-slate-600 text-sm max-w-2xl">
          Chaque artiste présent ici a déjà joué dans ton établissement via Swing Booking.
          Tu peux les recontacter facilement pour de nouvelles dates, en gardant une
          mémoire de ta programmation.
        </p>
        {error && (
          <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>
        )}
      </header>

      {/* Filtres & recherche */}
      <section className="border rounded-2xl p-4 bg-white space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-slate-500">
              Recherche
            </label>
            <input
              type="text"
              placeholder="Rechercher par nom d’artiste ou par style musical…"
              className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              Formation
            </span>
            <div className="flex flex-wrap gap-1">
              <FilterChip
                label="Toutes"
                active={formationFilter === 'all'}
                onClick={() => setFormationFilter('all')}
              />
              {(['solo', 'duo', 'trio', 'quartet', 'dj'] as Formation[]).map((f) => (
                <FilterChip
                  key={f}
                  label={FORMATION_LABEL[f]}
                  active={formationFilter === f}
                  onClick={() => setFormationFilter(f)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          {filtered.length} artiste{filtered.length > 1 ? 's' : ''} affiché
          {filtered.length > 1 ? 's' : ''} sur {items.length}
          {items.length > 1 ? '' : ''}.
        </div>
      </section>

      {/* Liste des artistes */}
      {items.length === 0 ? (
        <section className="border rounded-2xl p-6 bg-slate-50">
          <p className="text-sm text-slate-600">
            Aucun artiste débloqué pour le moment. Dès que tu valideras une proposition
            avec un artiste via Swing Booking, il apparaîtra ici.
          </p>
          <div className="mt-3">
            <Link href="/catalogue" className="text-sm underline text-[var(--brand)]">
              Créer une première demande d&apos;événement
            </Link>
          </div>
        </section>
      ) : filtered.length === 0 ? (
        <section className="border rounded-2xl p-6 bg-slate-50">
          <p className="text-sm text-slate-600">
            Aucun artiste ne correspond à ces filtres. Essaie d&apos;élargir ta recherche.
          </p>
        </section>
      ) : (
        <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((ua) => {
            const a = ua.artists;
            if (!a) return null;
            return (
              <article
                key={ua.id}
                className="rounded-2xl border p-4 flex flex-col gap-2 bg-white hover:border-[var(--brand)] hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold line-clamp-1">
                    {a.stage_name || 'Artiste'}
                  </h2>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    1ère date : {fmtDateFR(ua.first_unlocked_at)}
                  </span>
                </div>

                {a.genres && a.genres.length > 0 && (
                  <div className="text-xs text-slate-500">
                    {a.genres.join(' • ')}
                  </div>
                )}

                {a.formations && a.formations.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {a.formations.map((f) => (
                      <span
                        key={f}
                        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] text-slate-600"
                      >
                        {FORMATION_LABEL[f] ?? f.toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-1">
                  {a.instagram_url && (
                    <a
                      href={a.instagram_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline text-slate-600"
                    >
                      Instagram
                    </a>
                  )}
                  {a.youtube_url && (
                    <a
                      href={a.youtube_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline text-slate-600"
                    >
                      YouTube
                    </a>
                  )}
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  (Dans une prochaine version, tu pourras voir l&apos;historique des dates
                  jouées par cet artiste dans ton établissement.)
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'px-2 py-1 rounded-full text-xs border ' +
        (active
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-600 hover:bg-slate-50')
      }
    >
      {label}
    </button>
  );
}
