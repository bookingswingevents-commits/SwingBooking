'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseBrowser';
import Link from 'next/link';
import { getPlanConfig } from '@/lib/plan';

type Artist = {
  id: string;
  stage_name: string | null;
  genres: string[] | null;
  formations: string[] | null;
  instagram_url?: string | null;
  youtube_url?: string | null;
};

export default function ArtistsCataloguePage() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'venue' | 'artist' | 'admin' | null>(null);
  const [plan, setPlan] = useState<'free' | 'starter' | 'pro' | 'premium'>('free');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError('Vous devez être connecté pour accéder au catalogue artistes.');
        setLoading(false);
        return;
      }

      const userId = session.user.id;

      // Charger le profil pour connaître le rôle
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      setRole(profile?.role ?? null);

      // Charger le plan si venue
      if (profile?.role === 'venue') {
        const { data: venue } = await supabase
          .from('venues')
          .select('subscription_plan, is_pro')
          .eq('id', userId)
          .maybeSingle();

        // Normalisation du plan
        let detectedPlan: any =
          venue?.subscription_plan ??
          (venue?.is_pro ? 'pro' : 'free');

        if (!['free', 'starter', 'pro', 'premium'].includes(detectedPlan)) {
          detectedPlan = 'free';
        }

        setPlan(detectedPlan as any);

        const cfg = getPlanConfig(detectedPlan);

        if (!cfg.canAccessArtistCatalog) {
          setLoading(false);
          return; // On arrête là : accès interdit
        }
      }

      // Si artiste → accès refusé
      if (profile?.role === 'artist') {
        setLoading(false);
        return;
      }

      // Récupération du catalogue artistes
      const { data: artistsRes, error: artistsErr } = await supabase
        .from('artists')
        .select('id, stage_name, genres, formations, instagram_url, youtube_url')
        .order('stage_name', { ascending: true });

      if (artistsErr) {
        setError('Erreur chargement artistes : ' + artistsErr.message);
      } else {
        setArtists(artistsRes ?? []);
      }

      setLoading(false);
    })();
  }, []);

  const cfg = getPlanConfig(plan);

  /* ========================
      AFFICHAGE DES BLOQUAGES
     ======================== */

  if (loading) return <p className="text-slate-600">Chargement du catalogue…</p>;

  if (role === 'artist')
    return (
      <div className="p-5 border rounded-xl bg-white space-y-3">
        <h2 className="text-xl font-semibold">Accès réservé</h2>
        <p className="text-slate-600">
          Le catalogue artistes complet n’est pas accessible aux artistes.
        </p>
      </div>
    );

  if (!cfg.canAccessArtistCatalog)
    return (
      <div className="p-6 border rounded-2xl bg-white max-w-xl space-y-4">
        <h2 className="text-2xl font-bold">Accès réservé au Pack Premium</h2>

        <p className="text-slate-600">
          Le catalogue complet des artistes Swing Booking est une fonctionnalité
          exclusive aux comptes <strong>Premium</strong>.  
          Ce pack permet de consulter tous les artistes disponibles et de les booker
          directement, sans passer par le matching automatique.
        </p>

        <Link
          href="/subscribe"
          className="px-4 py-2 inline-flex items-center rounded-xl bg-[var(--brand)] text-white font-medium hover:opacity-90"
        >
          Découvrir le Pack Premium
        </Link>
      </div>
    );

  /* ========================
      CATALOGUE PREMIUM OK
     ======================== */

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Catalogue artistes complet</h1>
        <p className="text-slate-600">
          Vous pouvez découvrir, filtrer et sélectionner directement l’artiste de votre choix.
        </p>
      </header>

      {error && (
        <div className="p-3 border bg-red-50 text-red-700 rounded-xl">
          {error}
        </div>
      )}

      {/* Liste artistes */}
      <div className="grid md:grid-cols-3 gap-4">
        {artists.map((a) => (
          <article
            key={a.id}
            className="border rounded-2xl p-4 bg-white hover:shadow-sm transition"
          >
            <h3 className="font-semibold text-lg mb-1">
              {a.stage_name || 'Artiste sans nom'}
            </h3>

            {a.genres && a.genres.length > 0 && (
              <p className="text-sm text-slate-500">{a.genres.join(' • ')}</p>
            )}

            {a.formations && a.formations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {a.formations.map((f) => (
                  <span
                    key={f}
                    className="px-2 py-0.5 text-[10px] rounded-full border text-slate-600"
                  >
                    {f.toUpperCase()}
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-3 mt-3 text-sm">
              {a.instagram_url && (
                <a
                  href={a.instagram_url}
                  target="_blank"
                  className="underline text-slate-600"
                >
                  Instagram
                </a>
              )}
              {a.youtube_url && (
                <a
                  href={a.youtube_url}
                  target="_blank"
                  className="underline text-slate-600"
                >
                  YouTube
                </a>
              )}
            </div>

            <div className="mt-4">
              <Link
                href={`/artists/${a.id}`}
                className="text-sm underline text-[var(--brand)]"
              >
                Voir le profil
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
