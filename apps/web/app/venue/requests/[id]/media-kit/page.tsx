'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR } from '@/lib/date';

type BookingRequest = {
  id: string;
  title: string;
  formation: string | null;
  event_format: string | null;
  venue_company_name: string | null;
  venue_address: string | null;
  venue_contact_email: string | null;
  practical_info: string | null;
};

type Occurrence = {
  id: string;
  date: string;
  start_time: string | null;
  address_snapshot: string | null;
};

type Artist = {
  stage_name: string | null;
  bio: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
};

export default function VenueMediaKitPage() {
  const { id } = useParams<{ id: string }>();
  const [req, setReq] = useState<BookingRequest | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? null;
        if (!token) {
          setError('Connectez-vous pour accéder au kit de communication.');
          setLoading(false);
          return;
        }

        const { data: reqData, error: reqErr } = await supabase
          .from('booking_requests')
          .select('id, title, formation, event_format, venue_company_name, venue_address, venue_contact_email, practical_info')
          .eq('id', id)
          .maybeSingle();
        if (reqErr || !reqData) throw new Error(reqErr?.message || 'Demande introuvable');
        setReq(reqData as BookingRequest);

        const { data: occ, error: occErr } = await supabase
          .from('booking_request_occurrences')
          .select('id, date, start_time, address_snapshot')
          .eq('request_id', id)
          .order('date', { ascending: true });
        if (!occErr && occ) setOccurrences(occ as Occurrence[]);

        // Artiste principal s'il existe
        const { data: prop } = await supabase
          .from('proposals')
          .select('artist_id, artists(stage_name,bio,instagram_url,facebook_url,youtube_url)')
          .eq('request_id', id)
          .eq('status', 'sent')
          .limit(1)
          .maybeSingle();
        const artistRow = (prop as any)?.artists
          ? Array.isArray((prop as any).artists)
            ? (prop as any).artists[0]
            : (prop as any).artists
          : null;
        if (artistRow) setArtist(artistRow as Artist);
      } catch (e: any) {
        setError(e?.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const copyText = (txt: string) => {
    try {
      navigator.clipboard.writeText(txt);
      alert('Copié dans le presse-papiers');
    } catch {
      alert('Impossible de copier automatiquement');
    }
  };

  const occSummary = useMemo(
    () =>
      occurrences.length
        ? occurrences.map((o) => `${fmtDateFR(o.date)} ${o.start_time || ''}`.trim()).join(' • ')
        : fmtDateFR((req as any)?.event_date || '') || '',
    [occurrences, (req as any)?.event_date]
  );

  const hashtags = useMemo(() => {
    const parts = [
      req?.venue_company_name,
      req?.event_format,
      req?.formation,
      'swing',
      'jazz',
    ]
      .filter(Boolean)
      .map((p) => `#${String(p).toLowerCase().replace(/\s+/g, '')}`);
    return parts.join(' ');
  }, [req]);

  const baseText = `${req?.title || 'Événement'} • ${occSummary}\n${req?.venue_company_name || ''}\n${req?.venue_address || ''}`;
  const instaPost = `${baseText}\n\nOn accueille ${artist?.stage_name || 'l’artiste'} pour une soirée exceptionnelle !\n\n${hashtags}`;
  const story = `${req?.title || 'Événement'}\n${occSummary}\n${req?.venue_company_name || ''}\n${artist?.stage_name ? `Avec ${artist.stage_name}` : ''}`;
  const fb = `${baseText}\n\n${artist?.bio || 'Venez nombreux !'}\n${hashtags}`;

  const sendCommunicationRequest = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('Connectez-vous pour envoyer la demande.');
        return;
      }
      const res = await fetch('/api/communication-requests/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ requestId: id, role: 'venue', notes }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'Erreur envoi demande');
      alert('Demande envoyée. Nous vous contactons.');
    } catch (e: any) {
      alert(e?.message || 'Erreur envoi demande');
    }
  };

  if (loading) return <div className="text-slate-500">Chargement…</div>;
  if (error || !req) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Kit de communication</h1>
        <p className="text-red-600">{error ?? 'Demande introuvable.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Kit de communication</h1>
        <p className="text-slate-600 text-sm">
          Textes prêts à publier pour votre événement.
        </p>
      </header>

      <section className="border rounded-2xl p-4 space-y-2">
        <h2 className="text-lg font-semibold">Événement</h2>
        <div className="text-sm space-y-1">
          <div className="font-medium">{req.title}</div>
          <div className="text-slate-600">{occSummary}</div>
          {req.venue_company_name && <div>{req.venue_company_name}</div>}
          {req.venue_address && <div>{req.venue_address}</div>}
          {req.practical_info && (
            <div className="text-xs text-slate-600 whitespace-pre-wrap">
              {req.practical_info}
            </div>
          )}
        </div>
        {occurrences.length > 0 && (
          <ul className="text-sm text-slate-700 space-y-1">
            {occurrences.map((o) => (
              <li key={o.id}>
                {fmtDateFR(o.date)} {o.start_time || ''} — {o.address_snapshot || req.venue_address}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border rounded-2xl p-4 space-y-2">
        <h2 className="text-lg font-semibold">Artiste</h2>
        {artist ? (
          <div className="text-sm space-y-1">
            <div className="font-medium">{artist.stage_name}</div>
            {artist.bio && <div className="text-slate-600 whitespace-pre-wrap">{artist.bio}</div>}
            <div className="flex flex-wrap gap-2 text-xs text-[var(--brand)]">
              {artist.instagram_url && <a href={artist.instagram_url}>Instagram</a>}
              {artist.facebook_url && <a href={artist.facebook_url}>Facebook</a>}
              {artist.youtube_url && <a href={artist.youtube_url}>YouTube</a>}
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-600">Artiste en cours de confirmation.</div>
        )}
      </section>

      <section className="border rounded-2xl p-4 space-y-3">
        <h2 className="text-lg font-semibold">Textes prêts à copier</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="font-medium">Post Instagram</div>
            <button className="text-xs underline" onClick={() => copyText(instaPost)}>
              Copier
            </button>
          </div>
          <pre className="bg-slate-50 border rounded-xl p-3 whitespace-pre-wrap text-sm">
            {instaPost}
          </pre>

          <div className="flex items-center justify-between">
            <div className="font-medium">Story</div>
            <button className="text-xs underline" onClick={() => copyText(story)}>
              Copier
            </button>
          </div>
          <pre className="bg-slate-50 border rounded-xl p-3 whitespace-pre-wrap text-sm">
            {story}
          </pre>

          <div className="flex items-center justify-between">
            <div className="font-medium">Facebook</div>
            <button className="text-xs underline" onClick={() => copyText(fb)}>
              Copier
            </button>
          </div>
          <pre className="bg-slate-50 border rounded-xl p-3 whitespace-pre-wrap text-sm">
            {fb}
          </pre>
        </div>
      </section>

      <section className="border rounded-2xl p-4 space-y-3 bg-amber-50 border-amber-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Besoin d’un reel / montage pro ?</h2>
          <button
            className="btn btn-primary"
            onClick={sendCommunicationRequest}
          >
            Envoyer à Tout passe par là
          </button>
        </div>
        <textarea
          className="w-full border rounded-xl p-3 min-h-[100px]"
          placeholder="Notes ou besoins spécifiques à partager"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <p className="text-xs text-amber-800">
          Nous vous contacterons sur {req.venue_contact_email || 'votre email'} pour finaliser.
        </p>
      </section>
    </div>
  );
}
