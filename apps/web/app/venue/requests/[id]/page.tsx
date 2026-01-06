'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR } from '@/lib/date';
import { labelForEventFormat } from '@/lib/event-formats';

/* ------------------------- Instagram oEmbed (media only) ------------------------- */
function InstagramEmbed({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const isMedia = /\/(p|reel|tv)\//i.test(url);
        if (!isMedia) {
          setFailed(true);
          return;
        }
        const res = await fetch(
          '/api/oembed/instagram?url=' + encodeURIComponent(url),
          { cache: 'no-store' }
        );
        if (!res.ok) {
          setFailed(true);
          return;
        }
        const data = await res.json();
        if (!data?.html) {
          setFailed(true);
          return;
        }
        if (alive) setHtml(data.html);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [url]);

  useEffect(() => {
    if (!html) return;
    const process = () => {
      // @ts-ignore
      if (window.instgrm?.Embeds?.process) window.instgrm.Embeds.process();
    };
    const existing =
      document.querySelector<HTMLScriptElement>(
        'script[src="https://www.instagram.com/embed.js"]'
      );
    if (existing) {
      process();
      return;
    }
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.instagram.com/embed.js';
    s.onload = process;
    document.body.appendChild(s);
  }, [html]);

  if (failed) return null;
  return html ? (
    <div
      className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : null;
}

/* ---------------------------------- Types ---------------------------------- */
type Formation = 'solo' | 'duo' | 'trio' | 'quartet' | 'dj';

type PaymentMode =
  | 'artist_invoice'
  | 'guso'
  | 'asso_un_dimanche'
  | 'other'
  | null;

type BookingRequest = {
  id: string;
  title: string;
  event_date: string | null;
  formation?: Formation | string | null;
  event_format?: string | null;
  practical_info?: string | null;
  venue_address?: string | null;
  start_time?: string | null;
  duration_minutes?: number | null;
  venue_contact_email?: string | null;
  venue_contact_name?: string | null;
  venue_company_name?: string | null;
  venue_id?: string | null;
  request_tier?: string | null;
};

type Occurrence = {
  id: string;
  date: string;
  start_time: string | null;
  duration_minutes: number | null;
  address_snapshot: string | null;
  audience_estimate: number | null;
};

type Artist = {
  id: string;
  stage_name?: string | null;
  formations?: string[] | null;
  bio?: string | null;
  tech_needs?: string | null;
  instagram_url?: string | null;
  instagram_media_url?: string | null;
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
  booking_requests: BookingRequest | null;
  artists: Artist | null;
  request_id: string;
  compensation_mode?: 'cachet' | 'facture' | null;
  compensation_amount?: number | null;
  compensation_expenses?: number | null;
  compensation_organism?: string | null;
};


type Pricing = {
  client_quote: number | null;
  artist_fee: number | null;
  internal_costs: number | null;
  currency: string | null;
};

/* --------------------------------- Utils ---------------------------------- */
const proposalStatusFR = (s: string) =>
  ({
    pending: 'En attente',
    proposed: 'Proposée',
    proposal_sent: 'Proposition envoyée',
    sent: 'Envoyée',
    accepted: 'Acceptée',
    declined: 'Refusée',
    changes_requested: 'Modifications demandées',
  }[s] || s);

function fmtMinutes(min?: number | null) {
  if (typeof min !== 'number') return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${m}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

function getYoutubeId(url?: string | null) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/i);
  return m ? m[1] : null;
}

/* ----------------------------- Brand SVG Icons ----------------------------- */
function IconWrap({ children }: { children: JSX.Element }) {
  return (
    <div className="w-11 h-11 rounded-xl border border-slate-200 bg-white grid place-items-center">
      {children}
    </div>
  );
}
const IconInstagram = () => (
  <IconWrap>
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <defs>
        <linearGradient id="ig" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f58529" />
          <stop offset="50%" stopColor="#dd2a7b" />
          <stop offset="100%" stopColor="#515bd4" />
        </linearGradient>
      </defs>
      <path
        fill="url(#ig)"
        d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.9.2 2.4.4.6.2 1 .4 1.5.8.5.4.8.9 1 1.5.2.5.3 1.2.4 2.4.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.9-.4 2.4-.2.6-.4 1-0.8 1.5-.4.5-.9.8-1.5 1-.5.2-1.2.3-2.4.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.9-.2-2.4-.4-.6-.2-1-.4-1.5-.8-.5-.4-.8-.9-1-1.5-.2-.5-.3-1.2-.4-2.4C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.9.4-2.4.2-.6.4-1 .8-1.5.4-.5.9-.8 1.5-1 .5-.2 1.2-.3 2.4-.4C8.4 2.2 8.8 2.2 12 2.2z"
      />
      <path
        fill="#fff"
        d="M12 5.8A6.2 6.2 0 1 0 12 18.2 6.2 6.2 0 1 0 12 5.8zm0 10.3A4.1 4.1 0 1 1 12 7.9a4.1 4.1 0 0 1 0 8.2zm6.5-10.9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"
      />
    </svg>
  </IconWrap>
);
const IconYouTube = () => (
  <IconWrap>
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="#FF0000"
        d="M23 7.6a4 4 0 0 0-2.8-2.8C18.6 4.3 12 4.3 12 4.3s-6.6 0-8.2.5A4 4 0 0 0 1 7.6C.5 9.2.5 12 .5 12s0 2.8.5 4.4a4 4 0 0 0 2.8 2.8c1.6.5 8.2.5 8.2.5s6.6 0 8.2-.5A4 4 0 0 0 23 16.4c.5-1.6.5-4.4.5-4.4s0-2.8-.5-4.4Z"
      />
      <path fill="#fff" d="M9.8 15.5V8.5L15.8 12l-6 3.5z" />
    </svg>
  </IconWrap>
);
const IconTikTok = () => (
  <IconWrap>
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="#000"
        d="M14.5 2h2.3c.3 1.8 1.7 3.4 3.6 3.8v2.3c-1.5 0-3-.5-4.3-1.3v6.9a6.7 6.7 0 1 1-2.3-5.1v2.8a3.9 3.9 0 1 0 1.3 2.9V2z"
      />
      <path
        fill="#25F4EE"
        d="M9.5 19.1a4 4 0 0 1 0-8c.5 0 1 .1 1.4.3v2.3a2.2 2.2 0 1 0 0 4.5v2.3c-.5.2-1 .3-1.4.3z"
      />
      <path
        fill="#FE2C55"
        d="M20.4 8.1V6c-1.9-.5-3.3-2-3.6-3.8h-2.1v10.4a3.9 3.9 0 0 1-1.3 2.9v-8A6.7 6.7 0 0 0 7.8 9V6.7a8.9 8.9 0 0 1 4.4.9c1.2.8 2.7 1.3 4.2 1.3z"
      />
    </svg>
  </IconWrap>
);
const IconFacebook = () => (
  <IconWrap>
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="#1877F2"
        d="M22 12A10 10 0 1 0 10 21.9V14.5H7.5V12h2.5V9.9c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.3.2 2.3.2v2.5H15c-1.2 0-1.6.8-1.6 1.5V12h2.8l-.4 2.5h-2.4v7.4A10 10 0 0 0 22 12z"
      />
    </svg>
  </IconWrap>
);

/* ---------------------------------- Page ---------------------------------- */
export default function VenueRequestPage() {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [req, setReq] = useState<BookingRequest | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);

  const [changeMsg, setChangeMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState('');

  // Résultat d’action pour bannière + lock UI
  const [actionOutcome, setActionOutcome] = useState<
    'accepted' | 'declined' | 'changes_requested' | null
  >(null);

  const ytId = useMemo(
    () => getYoutubeId(artist?.youtube_url),
    [artist?.youtube_url]
  );

  // Scroll vers le haut dès qu'une action réussie définit un message/banner
  useEffect(() => {
    if (actionOutcome) {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        /* ignore */
      }
    }
  }, [actionOutcome]);

  // Charger données
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // Tente de relier la demande à un compte connecté (si session présente)
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const headers =
            session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : undefined;
          await fetch('/api/requests/link-anonymous', {
            method: 'POST',
            headers,
          });
        } catch {
          /* silencieux */
        }

        const res = await fetch(`/api/requests/public/${id}`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json?.ok || !json?.data?.request) {
          if (res.status === 401 || res.status === 403) {
            setErr('Connectez-vous avec l’email utilisé pour cette demande pour la retrouver.');
          } else if (res.status === 404) {
            setErr('Demande introuvable.');
          } else {
            setErr(json?.error || 'Erreur de chargement de la demande.');
          }
          return;
        }

        setReq(json.data.request as BookingRequest);
        const p = json.data.proposal as Proposal | null;
        setProposal(p ?? null);
        setArtist((p as any)?.artists ?? null);
        setOccurrences((json?.data?.occurrences as Occurrence[]) ?? []);
        const initialOwner = json?.viewer_is_owner === true;
        setIsOwner(initialOwner);

        // Email session pour fallback propriétaire par email
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          setUserEmail(session?.user?.email ?? null);

          // Fallback propriétaire par email si non flagué
          const reqEmail = (json?.data?.request?.venue_contact_email || '').toLowerCase();
          const sessEmail = (session?.user?.email || '').toLowerCase();
          if (!initialOwner && reqEmail && sessEmail && reqEmail === sessEmail) {
            setIsOwner(true);
          } else if (initialOwner) {
            setIsOwner(true);
          }
        } catch {
          /* ignore */
        }

        // 3) Tarif — API côté serveur
        try {
          const resPricing = await fetch(
            `/api/pricing/by-request?request_id=${encodeURIComponent(id)}`,
            { cache: 'no-store' }
          );
          const j = await resPricing.json();
          if (j?.ok && j?.data) {
            setPricing({
              client_quote: j.data.client_quote ?? null,
              artist_fee: j.data.artist_fee ?? null,
              internal_costs: j.data.internal_costs ?? null,
              currency: j.data.currency ?? '€',
            });
          } else {
            setPricing(null);
          }
        } catch {
          setPricing(null);
        }
      } catch (e: any) {
        setErr(e?.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // 🔒 Lire une éventuelle décision déjà prise depuis localStorage
  useEffect(() => {
    if (!id) return;
    try {
      const stored = localStorage.getItem(`sb_proposal_decision_${id}`);
      if (
        stored === 'accepted' ||
        stored === 'declined' ||
        stored === 'changes_requested'
      ) {
        setActionOutcome(stored);
      }
    } catch {
      // ignore
    }
  }, [id]);

  // ----- Actions proposition (front only + persistance locale)
  const act = async (action: 'accept' | 'decline' | 'changes') => {
    if (!proposal) return;

    setSending(true);
    setActionError('');

    try {
      const newStatus =
        action === 'accept'
          ? 'accepted'
          : action === 'decline'
          ? 'declined'
          : 'changes_requested';

      // Mise à jour locale
      setProposal((prev) => (prev ? { ...prev, status: newStatus } : prev));
      setActionOutcome(newStatus);

      // Persistance locale (empêche de recliquer depuis ce navigateur)
      try {
        localStorage.setItem(`sb_proposal_decision_${id}`, newStatus);
      } catch {
        // ignore
      }

      if (action === 'changes') {
        setChangeMsg('');
      }

      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        // ignore
      }
    } catch (e: any) {
      setActionError(e?.message || 'Action impossible');
    } finally {
      setSending(false);
    }
  };

  const locked =
    actionOutcome !== null ||
    (!!proposal && (proposal.status === 'accepted' || proposal.status === 'declined'));
  const canAct = isOwner && !locked;

  /* ------------------------------ UI helpers ------------------------------ */
  const SocialCard = ({
    href,
    title,
    subtitle,
    icon,
  }: {
    href: string;
    title: string;
    subtitle?: string;
    icon: JSX.Element;
  }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-all"
    >
      {icon}
      <div className="min-w-0">
        <div className="font-medium leading-tight">{title}</div>
        {subtitle ? (
          <div className="text-xs text-slate-600 truncate group-hover:text-slate-800 transition-colors">
            {subtitle}
          </div>
        ) : null}
      </div>
    </a>
  );

  const Banner = () => {
    const status = actionOutcome ?? proposal?.status;
    if (!status) return null;

    if (status === 'accepted') {
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <div className="font-semibold">
            Merci ! La proposition est confirmée ✅
          </div>
          <p className="text-sm mt-1">
            La <strong>feuille de route</strong> est en préparation. Vous
            recevrez un e-mail récapitulatif avec les prochaines étapes
            (logistique, horaires, contacts) et pourrez la consulter depuis
            votre tableau de bord.
          </p>
        </div>
      );
    }
    if (status === 'declined') {
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
          <div className="font-semibold">Proposition refusée</div>
          <p className="text-sm mt-1">
            Merci pour votre retour. Nous en prenons note et pourrons vous
            proposer d’autres artistes ou formats. Vous pouvez également{' '}
            <Link href="/dashboard" className="underline">
              ouvrir une nouvelle demande
            </Link>
            .
          </p>
        </div>
      );
    }
    if (status === 'changes_requested') {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="font-semibold">
            Demande de modification envoyée ✏️
          </div>
          <p className="text-sm mt-1">
            Merci pour vos précisions. Notre équipe revient vers vous rapidement
            avec une proposition mise à jour.
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) return <div className="text-slate-500">Chargement…</div>;
  if (err)
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Traitement de la demande</h1>
        <p className="text-red-600">{err}</p>
        <Link
          href="/dashboard"
          className="text-sm underline text-[var(--brand)]"
        >
          ← Retour
        </Link>
      </div>
    );
  if (!req)
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Traitement de la demande</h1>
        <p className="text-slate-600">Demande introuvable.</p>
        <Link
          href="/dashboard"
          className="text-sm underline text-[var(--brand)]"
        >
          ← Retour
        </Link>
      </div>
    );

  const a = artist;
  const br = req;
  const hasProposal = !!proposal;
  const statusLabel = hasProposal
    ? proposalStatusFR(proposal?.status || 'proposal_sent')
    : 'Aucune proposition';
  const serviceFeeRate = isOwner ? 0 : 0; // calcul côté admin uniquement
  const amountDisplayed =
    proposal?.compensation_amount ?? pricing?.client_quote ?? null;
  const currencyDisplayed = pricing?.currency || '€';
  const compMode = proposal?.compensation_mode;
  const isDiscovery = (req?.request_tier || '').toLowerCase() === 'discovery';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Bandeau de confirmation pro */}
      <Banner />

      {!isOwner && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 text-sm">
          Lecture seule : connectez-vous avec l’email utilisé pour cette demande pour suivre son traitement dans votre tableau de bord.
        </div>
      )}

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Traitement de la demande</h1>
          <div className="text-slate-600 text-sm">
            {hasProposal ? 'Proposition envoyée' : 'En attente de proposition'}
            {hasProposal ? ` • Statut : ${statusLabel}` : ''}
            {isDiscovery ? ' • Mode découverte (1ère demande)' : ''}
          </div>
        </div>
        <Link
          href="/dashboard"
          className="text-sm underline text-[var(--brand)]"
        >
          ← Retour
        </Link>
      </header>

      {/* Événement */}
      <section className="border rounded-2xl p-5 space-y-2">
        <h2 className="text-lg font-semibold">Événement</h2>
        <div className="text-sm">
          <div className="font-medium">{br.title}</div>
          <div className="text-slate-600">
            {fmtDateFR(br.event_date)}
            {br.start_time ? ` • ${br.start_time}` : ''}
            {typeof br.duration_minutes === 'number'
              ? ` • ${fmtMinutes(br.duration_minutes)}`
              : ''}
            {br.formation ? ` • ${String(br.formation).toUpperCase()}` : ''}
            {br.event_format
              ? ` • ${labelForEventFormat(String(br.event_format))}`
              : ''}
          </div>

          {br.venue_address ? (
            <div className="text-slate-600">{br.venue_address}</div>
          ) : null}
          {br.practical_info ? (
            <p className="text-slate-600 mt-2 whitespace-pre-line">
              {br.practical_info}
            </p>
          ) : null}
        </div>
      </section>

      {/* Occurrences */}
      <section className="border rounded-2xl p-5 space-y-2">
        <h2 className="text-lg font-semibold">Dates & lieux</h2>
        {occurrences.length === 0 ? (
          <div className="text-sm text-slate-600">Aucune occurrence enregistrée.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {occurrences.map(o => (
              <li key={o.id} className="border rounded-xl p-3 bg-white">
                <div className="font-medium">{fmtDateFR(o.date)}</div>
                <div className="text-slate-600">
                  {o.start_time || '—'}
                  {typeof o.duration_minutes === 'number'
                    ? ` • ${fmtMinutes(o.duration_minutes)}`
                    : ''}
                </div>
                {o.address_snapshot ? (
                  <div className="text-slate-600">{o.address_snapshot}</div>
                ) : null}
                {o.audience_estimate != null ? (
                  <div className="text-slate-600">Public estimé : {o.audience_estimate}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tarif – plus discret */}
      <section className="rounded-2xl border p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-white p-5 border-b">
          <h2 className="text-lg font-semibold">Tarif</h2>
          <p className="text-sm text-slate-600">
            Montant de la prestation proposé au client
            {currencyDisplayed ? ` (${currencyDisplayed})` : ''}
          </p>
        </div>
        <div className="p-6 space-y-2">
          <div className="inline-flex items-baseline gap-2">
            <div className="text-2xl font-bold tracking-tight">
              {amountDisplayed != null
                ? amountDisplayed.toLocaleString('fr-FR') +
                  (currencyDisplayed ? ` ${currencyDisplayed}` : ' €')
                : '—'}
            </div>
            {amountDisplayed != null && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                Tarif proposé
              </span>
            )}
          </div>
          {proposal?.compensation_expenses != null &&
            proposal.compensation_expenses > 0 && (
              <div className="text-xs text-slate-600">
                Défraiement prévu :{' '}
                {proposal.compensation_expenses.toLocaleString('fr-FR')}{' '}
                {currencyDisplayed}
              </div>
            )}
          <p className="text-xs text-slate-500">
            Les détails de cachet/facture et frais internes restent gérés avec l’équipe Swing Booking.
          </p>
        </div>
      </section>

      {/* Mode de rémunération issu de la proposition */}
      <section className="border rounded-2xl p-5 space-y-2">
        <h2 className="text-lg font-semibold">Mode de rémunération</h2>
        {proposal ? (
          <div className="text-sm text-slate-700 space-y-1">
            {compMode === 'cachet' && (
              <>
                <div>Cachet géré via {proposal.compensation_organism || 'organisme à préciser'}.</div>
                <div className="text-xs text-slate-500">
                  Les charges et frais liés au cachet seront précisés par l’organisme employeur.
                </div>
              </>
            )}
            {compMode === 'facture' && (
              <div>Facture émise par l’artiste ou sa structure.</div>
            )}
            {!compMode && (
              <div>À préciser avec l’artiste.</div>
            )}
          </div>
        ) : (
          <div className="text-sm text-slate-600">À préciser lorsque la proposition sera prête.</div>
        )}
      </section>

      {/* Artiste proposé */}
      {a && (
        <section className="border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {a.stage_name || 'Artiste'}
            </h2>
            <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              Artiste proposé
            </span>
          </div>

          {a.formations?.length ? (
            <div className="text-xs text-slate-600">
              Formations :{' '}
              {a.formations.map((f) => String(f).toUpperCase()).join(' • ')}
            </div>
          ) : null}

          {a.bio ? (
            <p className="text-slate-700 whitespace-pre-line leading-relaxed">
              {a.bio}
            </p>
          ) : (
            <p className="text-slate-500 text-sm">
              Aucune biographie renseignée.
            </p>
          )}

          {a.tech_needs ? (
            <div className="rounded-xl bg-slate-50 border p-3 text-sm">
              <div className="font-medium mb-1">Besoins techniques</div>
              <pre className="whitespace-pre-line text-slate-700">
                {a.tech_needs}
              </pre>
            </div>
          ) : null}
        </section>
      )}

      {/* Réseaux */}
      {a && (
        <section className="border rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold">Réseaux</h2>

          {a.instagram_media_url && <InstagramEmbed url={a.instagram_media_url} />}

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {a.instagram_url && (
              <SocialCard
                href={a.instagram_url}
                title="Instagram"
                subtitle={a.instagram_url}
                icon={<IconInstagram />}
              />
            )}

            {(a.youtube_url || ytId) &&
              (ytId ? (
                <a
                  href={a.youtube_url || `https://youtu.be/${ytId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all"
                  title="YouTube"
                >
                  <div className="aspect-video">
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube.com/embed/${ytId}`}
                      title="YouTube preview"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                  <div className="px-3 py-2 text-sm font-medium flex items-center gap-2">
                    <IconYouTube /> <span>YouTube</span>
                  </div>
                </a>
              ) : (
                <SocialCard
                  href={a.youtube_url!}
                  title="YouTube"
                  subtitle={a.youtube_url!}
                  icon={<IconYouTube />}
                />
              ))}

            {a.tiktok_url && (
              <SocialCard
                href={a.tiktok_url}
                title="TikTok"
                subtitle={a.tiktok_url}
                icon={<IconTikTok />}
              />
            )}

            {a.facebook_url && (
              <SocialCard
                href={a.facebook_url}
                title="Facebook"
                subtitle={a.facebook_url}
                icon={<IconFacebook />}
              />
            )}
          </div>

          <p className="text-xs text-slate-500">
            Clique pour ouvrir le réseau dans un nouvel onglet.
          </p>
        </section>
      )}

      {/* Actions — avec lock après action */}
      {hasProposal ? (
        <section className="border rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold">Actions</h2>

          <div className="grid sm:grid-cols-2 gap-3">
            <button
              className="inline-flex items-center justify-center rounded-xl px-4 py-3 bg-[var(--brand,#0a3440)] text-white font-medium shadow-sm hover:brightness-110 active:brightness-95 transition disabled:opacity-60"
              onClick={() => act('accept')}
              disabled={sending || !canAct}
              title={
                !isOwner
                  ? 'Connectez-vous avec le bon email pour répondre'
                  : locked
                  ? 'Action déjà effectuée'
                  : 'Accepter la proposition'
              }
            >
              {sending ? 'Traitement…' : 'Accepter'}
            </button>

            <button
              className="inline-flex items-center justify-center rounded-xl px-4 py-3 border border-slate-300 bg-white text-slate-800 font-medium hover:bg-slate-50 active:bg-slate-100 transition disabled:opacity-60"
              onClick={() => act('decline')}
              disabled={sending || !canAct}
              title={
                !isOwner
                  ? 'Connectez-vous avec le bon email pour répondre'
                  : locked
                  ? 'Action déjà effectuée'
                  : 'Refuser la proposition'
              }
            >
              Refuser
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Demander une modification
            </label>
            {isDiscovery && (
              <p className="text-xs text-amber-700">
                Mode découverte (1ère demande offerte) : la modification d’artiste n’est pas disponible. Cette option s’active avec un pack.
              </p>
            )}
            <textarea
              className="w-full border border-slate-300 rounded-2xl p-3 min-h-[120px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand,#0a3440)]/30 disabled:opacity-60"
              placeholder="Précisez ce que vous souhaitez modifier (horaire, durée, logistique, etc.)"
              value={changeMsg}
              onChange={(e) => setChangeMsg(e.target.value)}
              disabled={!isOwner || locked || isDiscovery}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="inline-flex items-center justify-center rounded-xl px-4 py-3 bg-amber-600 text-white font-medium shadow-sm hover:brightness-110 active:brightness-95 transition disabled:opacity-50"
                onClick={() => act('changes')}
                disabled={sending || !changeMsg.trim() || !canAct || isDiscovery}
                title={
                  !isOwner
                    ? 'Connectez-vous avec le bon email pour répondre'
                    : locked
                    ? 'Action déjà effectuée'
                    : isDiscovery
                    ? 'Option disponible à partir d’un pack'
                    : 'Envoyer la demande de modification'
                }
              >
                Envoyer la demande de modif
              </button>
              {actionError ? (
                <p className="text-sm text-red-600">{actionError}</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <section className="border rounded-2xl p-5">
          <div className="text-sm text-slate-600">
            Aucune proposition n’a encore été envoyée pour cette demande.
          </div>
        </section>
      )}
    </div>
  );
}
