'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseBrowser';

type Formation = 'solo' | 'duo' | 'trio' | 'quartet' | 'dj';

type Artist = {
  stage_name: string | null;
  formations: Formation[] | null;
  bio: string | null;
  tech_needs: string | null;
  contact_phone: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  website_url: string | null;
  is_active: boolean | null;
};

type EventFormat = {
  id: number;
  title: string;
  description: string | null;
};

export default function ArtistProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [artist, setArtist] = useState<Artist | null>(null);
  const [eventFormats, setEventFormats] = useState<EventFormat[]>([]);
  const [selectedFormatIds, setSelectedFormatIds] = useState<number[]>([]);

  const [stageName, setStageName] = useState('');
  const [formations, setFormations] = useState<Formation[]>([]);
  const [bio, setBio] = useState('');
  const [techNeeds, setTechNeeds] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [tiktokUrl, setTikTokUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isActive, setIsActive] = useState(false);
  const successRef = useRef<HTMLDivElement | null>(null);

  // Formations possibles
  const FORMATIONS: { value: Formation; label: string }[] = [
    { value: 'solo', label: 'Solo' },
    { value: 'duo', label: 'Duo' },
    { value: 'trio', label: 'Trio' },
    { value: 'quartet', label: 'Quartet' },
    { value: 'dj', label: 'DJ' },
  ];

  // Charger profil artiste + formats
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Session
        const { data: sessData, error: sessErr } = await supabase.auth.getSession();
        if (sessErr) throw sessErr;
        const session = sessData.session;
        if (!session) {
          router.push('/login');
          return;
        }
        const uid = session.user.id;

        // Profil artiste
        const { data: artistData, error: artistErr } = await supabase
          .from('artists')
          .select(
            'stage_name, formations, bio, tech_needs, contact_phone, instagram_url, youtube_url, facebook_url, tiktok_url, website_url, is_active'
          )
          .eq('id', uid)
          .maybeSingle();

        if (artistErr) throw artistErr;

        // Formats disponibles
        const { data: formatsData, error: formatsErr } = await supabase
          .from('event_formats')
          .select('id, title, description')
          .order('title', { ascending: true });

        if (formatsErr) throw formatsErr;

        // Formats déjà cochés par l'artiste
        const { data: linkData, error: linkErr } = await supabase
          .from('artist_event_formats')
          .select('event_format_id')
          .eq('artist_id', uid);

        if (linkErr) throw linkErr;

        const a = artistData as Artist | null;
        setArtist(a);
        setEventFormats((formatsData as EventFormat[]) ?? []);

        const initialSelected = (linkData ?? []).map((l: any) => l.event_format_id as number);
        setSelectedFormatIds(initialSelected);

        // Pré-remplir les champs
        setStageName(a?.stage_name ?? '');
        setFormations((a?.formations ?? []) as Formation[]);
        setBio(a?.bio ?? '');
        setTechNeeds(a?.tech_needs ?? '');
        setContactPhone(a?.contact_phone ?? '');
        setInstagramUrl(a?.instagram_url ?? '');
        setYoutubeUrl(a?.youtube_url ?? '');
        setFacebookUrl(a?.facebook_url ?? '');
        setTikTokUrl(a?.tiktok_url ?? '');
        setWebsiteUrl(a?.website_url ?? '');
        setIsActive(a?.is_active ?? false);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? 'Erreur de chargement du profil artiste');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const { data: sessData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;
      const session = sessData.session;
      if (!session) throw new Error('Session expirée. Merci de vous reconnecter.');
      const uid = session.user.id;

      let normalizedWebsite = websiteUrl.trim();
      if (normalizedWebsite.startsWith('www.')) {
        normalizedWebsite = `https://${normalizedWebsite}`;
      }
      if (!normalizedWebsite) normalizedWebsite = '';

      // 1) Update table artists
      const { error: upErr } = await supabase
        .from('artists')
        .update({
          stage_name: stageName || null,
          formations: formations.length ? formations : null,
          bio: bio || null,
          tech_needs: techNeeds || null,
          contact_phone: contactPhone || null,
          instagram_url: instagramUrl || null,
          youtube_url: youtubeUrl || null,
          facebook_url: facebookUrl || null,
          tiktok_url: tiktokUrl || null,
          website_url: normalizedWebsite || null,
          is_active: isActive,
        })
        .eq('id', uid);

      if (upErr) throw upErr;

      // 2) Update table artist_event_formats : on remplace tout pour cet artiste
      const { error: delErr } = await supabase
        .from('artist_event_formats')
        .delete()
        .eq('artist_id', uid);

      if (delErr) throw delErr;

      if (selectedFormatIds.length > 0) {
        const rows = selectedFormatIds.map((fid) => ({
          artist_id: uid,
          event_format_id: fid,
        }));

        const { error: insErr } = await supabase
          .from('artist_event_formats')
          .insert(rows);

        if (insErr) throw insErr;
      }

      setSuccessMsg('Profil artiste mis à jour ✅');
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? 'Erreur lors de la sauvegarde du profil');
    } finally {
      setSaving(false);
    }
  }

  function toggleFormation(value: Formation) {
    setFormations((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]
    );
  }

  function toggleFormat(id: number) {
    setSelectedFormatIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  useEffect(() => {
    if (successMsg) {
      if (successRef.current) {
        successRef.current.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [successMsg, successRef]);

  if (loading) {
    return <div className="text-slate-500">Chargement du profil artiste…</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Mon profil artiste</h1>
        <p className="text-slate-600 text-sm">
          Complète ton profil pour que les établissements et l’équipe Swing Booking puissent
          te proposer les bons événements.
        </p>
      </header>

      {error && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}

      {successMsg && (
        <div
          ref={successRef}
          className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm whitespace-pre-wrap"
        >
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Bloc identité & formations */}
        <section className="border rounded-2xl p-4 space-y-4 bg-white">
          <h2 className="text-lg font-semibold">Identité</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nom de scène</label>
              <input
                className="w-full border rounded-xl p-3"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="Ex : Duo Swing Paris"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Téléphone</label>
              <input
                className="w-full border rounded-xl p-3"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+33 6 …"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Formations possibles</label>
            <div className="flex flex-wrap gap-2">
              {FORMATIONS.map((f) => (
                <button
                  type="button"
                  key={f.value}
                  onClick={() => toggleFormation(f.value)}
                  className={`px-3 py-1 rounded-full text-xs border ${
                    formations.includes(f.value)
                      ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="is_active"
              type="checkbox"
              className="w-4 h-4"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="is_active" className="text-sm text-slate-700">
              Profil actif (éligible aux propositions)
            </label>
          </div>
        </section>

        {/* Bloc bio & technique */}
        <section className="border rounded-2xl p-4 space-y-4 bg-white">
          <h2 className="text-lg font-semibold">Description & technique</h2>

          <div className="space-y-2">
            <label className="text-sm font-medium">Présentation / bio</label>
            <textarea
              className="w-full border rounded-xl p-3 min-h-[120px]"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Parle de ton projet, ton style, ton expérience…"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Besoins techniques</label>
            <textarea
              className="w-full border rounded-xl p-3 min-h-[100px]"
              value={techNeeds}
              onChange={(e) => setTechNeeds(e.target.value)}
              placeholder="Ex : 2 prises électriques, 2x XLR, table haute, etc."
            />
          </div>
        </section>

        {/* Bloc formats d'événements */}
        <section className="border rounded-2xl p-4 space-y-4 bg-white">
          <h2 className="text-lg font-semibold">
            Formats d’événements que tu peux assurer
          </h2>
          <p className="text-sm text-slate-600">
            Coche tous les formats pour lesquels tu es à l’aise. Cela permet à Swing Booking
            de te proposer les bons événements automatiquement.
          </p>

          {eventFormats.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucun format configuré pour le moment.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {eventFormats.map((f) => (
                <label
                  key={f.id}
                  className="flex items-start gap-2 rounded-xl border p-3 text-sm hover:border-[var(--brand)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedFormatIds.includes(f.id)}
                    onChange={() => toggleFormat(f.id)}
                  />
                  <div>
                    <div className="font-medium">{f.title}</div>
                    {f.description && (
                      <p className="text-xs text-slate-500 mt-1">{f.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* Bloc réseaux */}
        <section className="border rounded-2xl p-4 space-y-4 bg-white">
          <h2 className="text-lg font-semibold">Réseaux & liens</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Site internet (optionnel)</label>
              <input
                className="w-full border rounded-xl p-3"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://monsite.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Instagram</label>
              <input
                className="w-full border rounded-xl p-3"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/…"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">YouTube</label>
              <input
                className="w-full border rounded-xl p-3"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/…"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Facebook</label>
              <input
                className="w-full border rounded-xl p-3"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                placeholder="https://facebook.com/…"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">TikTok</label>
              <input
                className="w-full border rounded-xl p-3"
                value={tiktokUrl}
                onChange={(e) => setTikTokUrl(e.target.value)}
                placeholder="https://www.tiktok.com/@…"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 rounded-xl border border-slate-300 text-sm"
            onClick={() => router.push('/dashboard')}
          >
            Annuler
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer mon profil'}
          </button>
        </div>
      </form>
    </div>
  );
}
