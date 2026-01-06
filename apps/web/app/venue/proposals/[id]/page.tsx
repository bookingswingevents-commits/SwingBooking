'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR } from '@/lib/date';
import { labelForEventFormat } from '@/lib/event-formats';

// Petit helper pour oEmbed Instagram via une route serveur
function InstagramEmbed({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/oembed/instagram?url=' + encodeURIComponent(url));
        if (res.ok) {
          const data = await res.json();
          if (alive) setHtml(data.html || null);
        }
      } catch (_) {}
    })();
    return () => {
      alive = false;
    };
  }, [url]);

  if (!html) return null;
  return <div className="rounded-xl overflow-hidden border" dangerouslySetInnerHTML={{ __html: html }} />;
}

type Formation = 'solo' | 'duo' | 'trio' | 'quartet' | 'dj';

type BookingRequestMini = {
  id: string;
  title: string;
  event_date: string | null;
  formation?: Formation | string | null;
  event_format?: string | null;
  practical_info?: string | null;
  venue_address?: string | null;
  start_time?: string | null;
  duration_minutes?: number | null;
};

type Artist = {
  id: string;
  stage_name?: string | null;
  formations?: string[] | null;
  bio?: string | null;
  tech_needs?: string | null;
  instagram_url?: string | null;
  youtube_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  contact_phone?: string | null;
  is_active?: boolean | null;
};

type Proposal = {
  id: string;
  status: string;
  created_at: string;
  booking_requests: BookingRequestMini | null;
  artists: Artist | null;
};

function fmtMinutes(min?: number | null) {
  if (typeof min !== 'number') return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${m}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

function proposalStatusFR(s: string) {
  const map: Record<string, string> = {
    pending: 'En attente',
    proposed: 'Proposée',
    proposal_sent: 'Proposition envoyée',
    sent: 'Envoyée',
    accepted: 'Acceptée',
    declined: 'Refusée',
    changes_requested: 'Modifications demandées',
  };
  return map[s] || s;
}

function getYoutubeId(url?: string | null) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/i);
  return m ? m[1] : null;
}

export default function VenueProposalPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [pricing, setPricing] = useState<{ client_quote: number | null; currency: string | null } | null>(null);

  const [changeMsg, setChangeMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const statusKey = proposal?.status || '';
  const friendlyError = (msg?: string | null) => {
    if (!msg) return null;
    const lower = msg.toLowerCase();
    if (lower.includes('permission')) return 'Accès refusé — veuillez vous connecter.';
    return msg;
  };

  const actionable = useMemo(() => {
    // Plus permissif pour éviter les boutons grisés à tort
    if (!statusKey) return true;
    return ['pending', 'sent_to_client', 'proposed', 'sent', 'proposal_sent'].includes(statusKey);
  }, [statusKey]);

  const ytId = useMemo(() => getYoutubeId(proposal?.artists?.youtube_url), [proposal?.artists?.youtube_url]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const { data, error } = await supabase
          .from('proposals')
          .select(`
            id, status, created_at,
            booking_requests(
              id, title, event_date, formation, event_format, practical_info, venue_address, start_time, duration_minutes
            ),
            artists:artist_id(
              id, stage_name, formations, bio, tech_needs, instagram_url, youtube_url, facebook_url, tiktok_url, contact_phone, is_active
            )
          `)
          .eq('id', id)
          .maybeSingle();

        if (error) {
          setErr(friendlyError(error.message));
          setLoading(false);
          return;
        }

        if (data) {
          const raw: any = data;
          const unwrap = <T,>(val: any): T | null =>
            Array.isArray(val) ? (val[0] ?? null) : (val ?? null);
          const normalized = {
            ...raw,
            booking_requests: unwrap<BookingRequestMini>(raw.booking_requests),
            artists: unwrap<Artist>(raw.artists),
          } as Proposal;
          setProposal(normalized ?? null);
          setArtist((normalized as any)?.artists ?? null);

          // Charger le tarif public (client_quote) par API serveur (bypass RLS)
          try {
            const br = (normalized as any)?.booking_requests;
            const rid = Array.isArray(br) ? br[0]?.id : br?.id;
            if (rid) {
              const res = await fetch(`/api/pricing/by-request?request_id=${encodeURIComponent(rid)}`, {
                cache: 'no-store',
              });
              const json = await res.json();
              if (json?.ok) {
                const d = json.data as { client_quote: number | null; currency: string | null } | null;
                setPricing(d ?? null);
              }
            }
          } catch (_) {
            // silencieux
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // action avec RPC + fallback update direct
  const act = async (action: 'accept' | 'decline' | 'changes') => {
    if (!proposal) return;
    try {
      setSending(true);
      setError('');

      // 1) essai RPC
      let rpcOk = false;
      try {
        const { error: rpcErr } = await supabase.rpc('venue_update_proposal', {
          _proposal_id: proposal.id,
          _action: action,
          _message: action === 'changes' ? (changeMsg?.trim() || null) : null,
        });
        if (!rpcErr) rpcOk = true;
      } catch (_) {}

      // 2) fallback si RPC absente
      if (!rpcOk) {
        let newStatus: string | null = null;
        if (action === 'accept') newStatus = 'accepted';
        if (action === 'decline') newStatus = 'declined';
        if (action === 'changes') newStatus = 'changes_requested';
        if (!newStatus) throw new Error('Action inconnue');

        const { error: upErr } = await supabase
          .from('proposals')
          .update({ status: newStatus })
          .eq('id', proposal.id);

        if (upErr) throw new Error(upErr.message);
      }

      // Reload data
      const { data, error: reloadErr } = await supabase
        .from('proposals')
        .select(`
          id, status, created_at,
          booking_requests(id, title, event_date, formation, event_format, practical_info, venue_address, start_time, duration_minutes),
          artists:artist_id(id, stage_name, formations, bio, tech_needs, instagram_url, youtube_url, facebook_url, tiktok_url, contact_phone, is_active)
        `)
        .eq('id', proposal.id)
        .maybeSingle();

      if (reloadErr) throw new Error(reloadErr.message);

      // Déclencher emails côté serveur (facultatif si tu as cette route)
      try {
        if (action === 'accept' || action === 'decline') {
          await fetch('/api/proposals/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              request_id: (data as any)?.booking_requests?.id,
              accept: action === 'accept',
            }),
          });
        }
      } catch (_) {
        // non bloquant
      }

      const unwrap = <T,>(val: any): T | null =>
        Array.isArray(val) ? (val[0] ?? null) : (val ?? null);
      const normalizedReload = data
        ? ({
            ...data,
            booking_requests: unwrap<BookingRequestMini>((data as any)?.booking_requests),
            artists: unwrap<Artist>((data as any)?.artists),
          } as Proposal)
        : null;
      setProposal(normalizedReload ?? null);
      if (action === 'accept') alert('Proposition acceptée ✅');
      if (action === 'decline') alert('Proposition refusée ❌');
      if (action === 'changes') alert('Demande de modification envoyée ✏️');

      setChangeMsg('');
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Action impossible');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="text-slate-500">Chargement…</div>;
  if (err) return <div className="text-red-600">Erreur : {err}</div>;
  if (!proposal) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Proposition</h1>
        <p className="text-slate-600">Proposition introuvable.</p>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const br = proposal.booking_requests;
  const a = proposal.artists;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Proposition</h1>
          <div className="text-slate-600 text-sm">
            {a?.stage_name || 'Artiste'} • {proposalStatusFR(proposal.status)} • Reçue le {fmtDateFR(proposal.created_at)}
          </div>
        </div>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </header>

      {/* Événement */}
      <section className="border rounded-2xl p-4 space-y-2">
        <h2 className="text-lg font-semibold">Événement</h2>
        <div className="text-sm">
          <div className="font-medium">{br?.title}</div>
          <div className="text-slate-600">
            {fmtDateFR(br?.event_date)}
            {br?.start_time ? ` • ${br.start_time}` : ''}
            {typeof br?.duration_minutes === 'number' ? ` • ${fmtMinutes(br.duration_minutes)}` : ''}
            {br?.formation ? ` • ${String(br.formation).toUpperCase()}` : ''}
            {br?.event_format ? ` • ${labelForEventFormat(String(br.event_format))}` : ''}
          </div>
          {br?.venue_address ? <div className="text-slate-600">{br.venue_address}</div> : null}
          {br?.practical_info ? <p className="text-slate-600 mt-2 whitespace-pre-line">{br.practical_info}</p> : null}
        </div>
      </section>

      {/* Section TARIF (visible client) */}
      <section className="border rounded-2xl p-4 space-y-2" aria-label="Section TARIF">
        <h2 className="text-lg font-semibold">Tarif</h2>
        <p className="text-sm text-slate-600">
          Montant de la prestation proposé au client{pricing?.currency ? ' (' + pricing.currency + ')' : ''}
        </p>
        <div className="text-2xl font-bold">
          {pricing?.client_quote != null
            ? pricing.client_quote.toLocaleString('fr-FR') + (pricing?.currency ? ' ' + pricing.currency : ' €')
            : '—'}
        </div>
        <p className="text-xs text-slate-500">Détails internes (cachet artiste, frais) non communiqués au client.</p>
      </section>

      {/* ARTISTE */}
      <section className="border rounded-2xl p-4 space-y-3">
        <h2 className="text-lg font-semibold">Artiste</h2>

        <div className="flex items-start gap-4">
          <div className="grow">
            <div className="font-medium text-lg">{a?.stage_name || 'Nom de scène'}</div>
            {a?.formations?.length ? (
              <div className="text-xs text-slate-600 mt-1">
                Formations : {a.formations.map((f) => String(f).toUpperCase()).join(' • ')}
              </div>
            ) : null}
          </div>
          {a?.contact_phone ? <a href={`tel:${a.contact_phone}`} className="btn btn-accent">Contacter</a> : null}
        </div>

        {a?.bio ? <p className="text-slate-700 whitespace-pre-line">{a.bio}</p> : <p className="text-slate-500 text-sm">Aucune biographie renseignée.</p>}

        {a?.tech_needs ? (
          <div className="rounded-xl bg-slate-50 border p-3 text-sm">
            <div className="font-medium mb-1">Besoins techniques</div>
            <pre className="whitespace-pre-line text-slate-700">{a.tech_needs}</pre>
          </div>
        ) : null}
      </section>

      {/* Galerie réseaux – pro & sexy */}
      <section className="border rounded-2xl p-4 space-y-3">
        <h2 className="text-lg font-semibold">Réseaux</h2>
        {a?.instagram_url ? (
          <div className="mt-2">
            <InstagramEmbed url={a.instagram_url} />
          </div>
        ) : null}

        <div className="grid md:grid-cols-3 gap-4">
          {/* YouTube preview */}
          {ytId ? (
            <div className="aspect-video rounded-xl overflow-hidden border">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${ytId}`}
                title="YouTube preview"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : null}

          {/* Instagram avatar card */}
          {a?.instagram_url ? (
            <a
              href={a.instagram_url}
              target="_blank"
              rel="noreferrer"
              className="border rounded-xl p-3 flex items-center gap-3 hover:bg-slate-50 transition"
            >
              <img
                src={`https://unavatar.io/instagram/${a.instagram_url.split('/').filter(Boolean).pop()}`}
                alt="Instagram"
                className="w-12 h-12 rounded-full border"
              />
              <div>
                <div className="font-medium">Instagram</div>
                <div className="text-xs text-slate-600 truncate">{a.instagram_url}</div>
              </div>
            </a>
          ) : null}

          {/* Facebook */}
          {a?.facebook_url ? (
            <a
              href={a.facebook_url}
              target="_blank"
              rel="noreferrer"
              className="border rounded-xl p-3 flex items-center gap-3 hover:bg-slate-50 transition"
            >
              <img src="https://unavatar.io/facebook" alt="Facebook" className="w-12 h-12 rounded-full border" />
              <div>
                <div className="font-medium">Facebook</div>
                <div className="text-xs text-slate-600 truncate">{a.facebook_url}</div>
              </div>
            </a>
          ) : null}

          {/* TikTok */}
          {a?.tiktok_url ? (
            <a
              href={a.tiktok_url}
              target="_blank"
              rel="noreferrer"
              className="border rounded-xl p-3 flex items-center gap-3 hover:bg-slate-50 transition"
            >
              <img src="https://unavatar.io/tiktok" alt="TikTok" className="w-12 h-12 rounded-full border" />
              <div>
                <div className="font-medium">TikTok</div>
                <div className="text-xs text-slate-600 truncate">{a.tiktok_url}</div>
              </div>
            </a>
          ) : null}
        </div>

        <p className="text-xs text-slate-500">Clique pour ouvrir le réseau dans un nouvel onglet.</p>
      </section>

      {/* Actions */}
      <section className="border rounded-2xl p-4 space-y-3">
        <h2 className="text-lg font-semibold">Actions</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <button
            className={`btn btn-primary ${!actionable ? 'opacity-50' : ''}`}
            onClick={() => act('accept')}
            disabled={sending}
            title="Accepter la proposition"
          >
            {sending ? 'Traitement…' : 'Accepter'}
          </button>
        <button
            className={`btn ${!actionable ? 'opacity-50' : ''}`}
            onClick={() => act('decline')}
            disabled={sending}
            title="Refuser la proposition"
          >
            Refuser
          </button>
        </div>

        <div className="mt-2 space-y-2">
          <label className="text-sm font-medium">Demander une modification</label>
          <textarea
            className="w-full border rounded-xl p-3"
            placeholder="Précise ce que tu souhaites modifier (horaire, durée, logistique, etc.)"
            rows={4}
            value={changeMsg}
            onChange={(e) => setChangeMsg(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button
              className="btn btn-accent"
              onClick={() => act('changes')}
              disabled={sending || !changeMsg.trim()}
              title="Envoyer une demande de modification à l’admin"
            >
              Envoyer la demande de modif
            </button>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
