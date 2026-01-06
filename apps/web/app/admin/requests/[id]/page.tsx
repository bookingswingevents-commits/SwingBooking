'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR, statusFR } from '@/lib/date';
import { labelForEventFormat } from '@/lib/event-formats';

type Formation = 'solo' | 'duo' | 'trio' | 'quartet' | 'dj';
const FORMATIONS: { value: Formation; label: string }[] = [
  { value: 'solo', label: 'Solo' },
  { value: 'duo', label: 'Duo' },
  { value: 'trio', label: 'Trio' },
  { value: 'quartet', label: 'Quartet' },
  { value: 'dj', label: 'DJ' },
];
const formationLabel = (v?: Formation | null) =>
  FORMATIONS.find(f => f.value === v)?.label ?? (v ?? '—');

type Request = {
  id: string;
  title: string;
  status: string;
  event_date: string | null;
  formation: Formation | null;
  start_time?: string | null;
  duration_minutes?: number | null;
  event_format?: string | null;

  venue_id: string | null;

  // snapshots
  venue_company_name: string | null;
  venue_address: string | null;
  venue_contact_name: string | null;
  venue_contact_email: string | null;
  venue_contact_phone: string | null;

  audience_size: number | null;
  practical_info?: string | null;
  notes: string | null;
  request_tier?: string | null;
  managed_booking?: boolean | null;
  managed_booking_status?: string | null;
};

type Occurrence = {
  id: string;
  date: string;
  start_time: string | null;
  duration_minutes: number | null;
  address_snapshot: string | null;
  audience_estimate: number | null;
};

type VenueFallback = {
  company_name: string | null;
  address_line1: string | null;
  postal_code: string | null;
  city: string | null;
  contact_name: string | null;
  billing_email: string | null;
  contact_phone: string | null;
} | null;

type Pricing = {
  request_id: string;
  client_quote: number | null;
  artist_fee: number | null;
  internal_costs: number | null;
  currency: string | null;
};

type Artist = {
  id: string;
  stage_name: string | null;
  full_name?: string | null;
  formations: Formation[] | string | null;
  is_active: boolean | null;
};

type AcceptedLink = {
  artist_id: string;
  status: 'accepted';
  artists: { id: string; stage_name: string; formations: Formation[] | null } | null;
};

type Proposal = {
  id: string;
  status: string;
  created_at: string;
  artist_id: string | null;
  artists?: { id: string; stage_name: string | null } | null;
  compensation_mode?: 'cachet' | 'facture' | null;
  compensation_amount?: number | null;
  compensation_expenses?: number | null;
  compensation_organism?: string | null;
};

/* ======= Helpers statuts (FR) ======= */
const toKey = (s?: string | null) =>
  String(s ?? '').toLowerCase().replace(/\s+/g, '_');

function proposalStatusFR(s?: string | null) {
  const map: Record<string, string> = {
    pending: 'En attente',
    sent_to_client: 'Envoyée au client',
    proposed: 'Proposée',
    sent: 'Envoyée',
    accepted: 'Acceptée',
    approved: 'Acceptée',
    client_approved: 'Acceptée',
    declined: 'Refusée',
    refused: 'Refusée',
    rejected: 'Refusée',
    changes_requested: 'Modifications demandées',
  };
  return map[toKey(s)] ?? (s ?? '—');
}

function isClientApprovedProposal(p?: Proposal | null) {
  const k = toKey(p?.status);
  return k === 'accepted' || k === 'approved' || k === 'client_approved';
}

const UUID36 = /^[0-9a-fA-F-]{36}$/;

/* ======= Composant page ======= */
export default function AdminRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [req, setReq] = useState<Request | null>(null);
  const [venueFb, setVenueFb] = useState<VenueFallback>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);

  const [proposal, setProposal] = useState<Proposal | null>(null);

  const [pickFormation, setPickFormation] = useState<Formation>('solo');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [artistsLoading, setArtistsLoading] = useState(false);
  const [selectedArtistIds, setSelectedArtistIds] = useState<string[]>([]);
  const [invitedArtistIds, setInvitedArtistIds] = useState<Set<string>>(new Set());
  const [savingPricing, setSavingPricing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [lastError, setLastError] = useState<string>('');
  const [acceptedLoading, setAcceptedLoading] = useState(false);

  const [acceptedArtists, setAcceptedArtists] = useState<AcceptedLink[]>([]);
  const [selectedAcceptedId, setSelectedAcceptedId] = useState<string | null>(null);

  const [proposalSentFlag, setProposalSentFlag] = useState(false);
  const [sendingRunSheets, setSendingRunSheets] = useState(false);

  // timeline
  const steps = useMemo(
    () => [
      { key: 'draft', label: 'Brouillon' },
      { key: 'reviewing', label: 'À traiter' },
      { key: 'sent_to_artists', label: 'Envoyée aux artistes' },
      { key: 'artist_accepted', label: 'Artiste disponible' },
      { key: 'proposal_pending', label: 'Proposition en préparation' },
      { key: 'proposal_sent', label: 'Proposition envoyée' },
      { key: 'client_review', label: 'En attente client' },
      { key: 'client_approved', label: 'Validée par le client' },
      { key: 'confirmed', label: 'Confirmée' },
      { key: 'cancelled', label: 'Annulée' },
      { key: 'archived', label: 'Archivée' },
    ],
    []
  );

  const currentStepIndex = useMemo(() => {
    const s = (req?.status || '').toLowerCase();
    const idx = steps.findIndex(x => x.key === s);
    return idx >= 0 ? idx : 0;
  }, [req?.status, steps]);

  /* ======= Loaders ======= */
  const loadProposal = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('proposals')
      .select(
        'id, status, created_at, artist_id, compensation_mode, compensation_amount, compensation_expenses, compensation_organism, artists:artist_id(id, stage_name)'
      )
      .eq('request_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      setProposal(null);
      return;
    }
    const normalized = data
      ? {
          ...data,
          artists: Array.isArray((data as any).artists)
            ? (data as any).artists[0] ?? null
            : (data as any).artists,
        }
      : null;
    setProposal((normalized as Proposal) ?? null);
  }, [id]);

  const loadCore = useCallback(async () => {
    setLastError('');
    try {
      const rq = await supabase
        .from('booking_requests')
        .select(`
          id, title, status, event_date, formation, start_time, duration_minutes, event_format,
          venue_id,
          venue_company_name, venue_address, venue_contact_name, venue_contact_email, venue_contact_phone,
          audience_size, practical_info, notes, request_tier, managed_booking, managed_booking_status
        `)
        .eq('id', id)
        .maybeSingle();

      if (rq.error || !rq.data) {
        throw new Error(rq.error?.message || 'Demande introuvable.');
      }
      const r = rq.data as Request;
      setReq(r);
      setPickFormation((r.formation ?? 'solo') as Formation);
      setProposalSentFlag(r.status === 'proposal_sent');

      const needVenueFb =
        !!r.venue_id &&
        !r.venue_company_name &&
        !r.venue_address &&
        !r.venue_contact_name &&
        !r.venue_contact_email &&
        !r.venue_contact_phone;

      if (needVenueFb) {
        const vq = await supabase
          .from('venues')
          .select(
            'company_name, address_line1, postal_code, city, contact_name, billing_email, contact_phone'
          )
          .eq('id', r.venue_id)
          .maybeSingle();
        if (!vq.error && vq.data) setVenueFb(vq.data as VenueFallback);
        else setVenueFb(null);
      } else {
        setVenueFb(null);
      }

      const pq = await supabase
        .from('request_pricing')
        .select('request_id, client_quote, artist_fee, internal_costs, currency')
        .eq('request_id', id)
        .maybeSingle();
      setPricing((pq.data as Pricing) ?? null);

      const occ = await supabase
        .from('booking_request_occurrences')
        .select('id, date, start_time, duration_minutes, address_snapshot, audience_estimate')
        .eq('request_id', id)
        .order('date', { ascending: true });
      if (!occ.error && occ.data) setOccurrences(occ.data as Occurrence[]);
    } catch (e: any) {
      setLastError(e?.message ?? 'Erreur inconnue');
    }
  }, [id]);

  const loadProposalsList = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('proposals')
        .select('id, artist_id')
        .eq('request_id', id);
      if (error) throw error;
      const ids = new Set(
        (data ?? [])
          .map((p: any) => p.artist_id)
          .filter((v: any): v is string => typeof v === 'string' && !!v)
      );
      setInvitedArtistIds(ids);
    } catch (e: any) {
      // on reste silencieux côté UI principale
      console.error('[admin/requests] loadProposalsList', e);
    }
  }, [id]);

  const loadAccepted = useCallback(async () => {
    if (!id) return;
    try {
      setAcceptedLoading(true);
      const { data, error } = await supabase
        .from('request_artists')
        .select('artist_id, status, artists(id, stage_name, formations)')
        .eq('request_id', id)
        .eq('status', 'accepted');

      if (error) throw new Error(error.message);

      const rows = (data ?? []).map((row: any) => ({
        ...row,
        artists: Array.isArray(row.artists) ? row.artists[0] ?? null : row.artists,
      })) as AcceptedLink[];
      setAcceptedArtists(rows);
      setSelectedAcceptedId(
        rows.length > 0 && rows[0]?.artist_id ? rows[0].artist_id : null
      );
    } catch (e: any) {
      setLastError(`Erreur lecture réponses artistes: ${e?.message ?? 'inconnue'}`);
    } finally {
      setAcceptedLoading(false);
    }
  }, [id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadCore();
      await Promise.all([loadAccepted(), loadProposal(), loadProposalsList()]);
      setLoading(false);
    })();
  }, [loadCore, loadAccepted, loadProposal, loadProposalsList]);

  /* ======= Helpers UI ======= */
  const fmtMinutes = (m?: number | null) => {
    if (m == null) return '—';
    const h = Math.floor(m / 60);
    const min = m % 60;
    return min ? `${h}h${String(min).padStart(2, '0')}` : `${h}h`;
  };

  const setPricingField = (
    field: keyof Omit<Pricing, 'request_id'>,
    val: number | null | string
  ) => {
    setPricing(
      prev =>
        ({
          ...(prev ?? {
            request_id: id as string,
            client_quote: null,
            artist_fee: null,
            internal_costs: null,
            currency: 'EUR',
          }),
          [field]: val === '' ? null : val,
        }) as Pricing
    );
  };

  const toggleArtist = (aid: string) => {
    if (invitedArtistIds.has(aid)) return;
    setSelectedArtistIds(prev =>
      prev.includes(aid) ? prev.filter(x => x !== aid) : [...prev, aid]
    );
  };

  /* ======= Chargement ARTISTES ======= */
  useEffect(() => {
    (async () => {
      if (!pickFormation) return;
      setLastError('');
      setArtists([]);
      setSelectedArtistIds([]);
      setArtistsLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token ?? null;
        const params = new URLSearchParams();
        if (pickFormation) params.set('formation', pickFormation);
        const res = await fetch(`/api/admin/artists?${params.toString()}`, {
          cache: 'no-store',
          credentials: 'include',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          setLastError(json?.error || 'Erreur lecture artistes');
          setArtists([]);
          return;
        }
        const data = (json.data ?? []) as Artist[];
        setArtists(data);
      } catch (e: any) {
        setLastError(e?.message ?? 'Erreur inconnue');
      } finally {
        setArtistsLoading(false);
      }
    })();
  }, [pickFormation]);

  /* ======= Actions ======= */
  const savePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!req) return;
    setSavingPricing(true);
    setLastError('');

    try {
      const payload: Pricing = {
        request_id: req.id,
        client_quote: pricing?.client_quote ?? null,
        artist_fee: pricing?.artist_fee ?? null,
        internal_costs: pricing?.internal_costs ?? null,
        currency: pricing?.currency ?? 'EUR',
      };

      const { error } = await supabase.from('request_pricing').upsert(payload);
      if (error) throw new Error(error.message);
      alert('Tarifs enregistrés ✅');
    } catch (e: any) {
      setLastError(`Erreur enregistrement des prix: ${e?.message ?? 'inconnue'}`);
      alert('Erreur enregistrement des prix ❌');
    } finally {
      setSavingPricing(false);
    }
  };

  const inviteSelected = async (ids?: string[]) => {
    if (!req) return;
    const list = (ids ?? selectedArtistIds).filter(id => !invitedArtistIds.has(id));
    if (list.length === 0) {
      setLastError('Aucun artiste sélectionné.');
      return;
    }

    try {
      setInviting(true);
      setLastError('');

      const { data, error } = await supabase.rpc('admin_invite_artists', {
        _request_id: req.id,
        _artist_ids: list,
      });

      if (error) throw new Error(error.message);

      await loadAccepted();
      await loadProposalsList();
      setInvitedArtistIds(prev => new Set([...prev, ...list]));
      setSelectedArtistIds([]);
      alert(`Invitations envoyées ✅ (${data ?? list.length})`);
    } catch (e: any) {
      setLastError(`Erreur invitations (RPC): ${e?.message ?? 'inconnue'}`);
    } finally {
      setInviting(false);
    }
  };

  const inviteAll = async () => {
    if (!req) return;
    const eligible = artists.filter(a => !invitedArtistIds.has(a.id));
    if (eligible.length === 0) {
      setLastError('Tous les artistes de cette formation ont déjà été invités.');
      return;
    }
    const ids = eligible.map(a => a.id);
    await inviteSelected(ids);
  };

  const sendProposal = async () => {
    if (!req) return;
    if (!selectedAcceptedId || !UUID36.test(selectedAcceptedId)) {
      alert('Sélectionne un artiste accepté valide.');
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? null;

      const res = await fetch('/api/proposals/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          request_id: req.id,
          artist_id: selectedAcceptedId,
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        throw new Error(j?.error || 'Erreur création proposition');
      }

      setProposalSentFlag(true);
      setReq(prev =>
        prev ? ({ ...prev, status: 'proposal_sent' } as Request) : prev
      );

      await loadProposal();

      alert('Proposition envoyée au client ✅');
    } catch (e: any) {
      const msg =
        e?.message ||
        'Erreur lors de l’envoi de la proposition (vérifie que la rémunération artiste est renseignée).';
      setLastError(msg);
      alert(msg);
    }
  };

  async function deleteRequest() {
    if (!req) return;
    const ok = confirm(
      'Supprimer définitivement cette demande ?\nCette action est irréversible.'
    );
    if (!ok) return;
    try {
      setDeleting(true);
      const { error } = await supabase.rpc('admin_delete_booking_request', {
        _request_id: req.id,
      });
      if (error) throw new Error(error.message);
      alert('Demande supprimée ✅');
      router.push('/dashboard');
    } catch (e: any) {
      setLastError(`Suppression impossible : ${e?.message ?? 'inconnue'}`);
    } finally {
      setDeleting(false);
    }
  }

  async function duplicateRequest() {
    if (!req) return;
    try {
      setDuplicating(true);
      setLastError('');

      const payload: any = {
        event_format: req.event_format,
        formation: req.formation,
        event_date: req.event_date,
        start_time: req.start_time,
        duration_minutes: req.duration_minutes ?? null,
        audience_size: req.audience_size ?? null,
        notes: req.notes ?? null,
        practical_info: req.practical_info ?? null,
      };

      if (pricing) {
        payload.price_client = pricing.client_quote ?? null;
        payload.artist_fee = pricing.artist_fee ?? null;
        payload.artist_expenses = pricing.internal_costs ?? null;
      }

      if (req.venue_id) {
        payload.venue_id = req.venue_id;
      } else {
        payload.venue_company_name = req.venue_company_name;
        payload.venue_address = req.venue_address;
        payload.venue_contact_name = req.venue_contact_name;
        payload.venue_contact_email = req.venue_contact_email;
        payload.venue_contact_phone = req.venue_contact_phone;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? null;

      const res = await fetch('/api/admin/booking-requests', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.error || 'Erreur duplication');
      }

      alert('Demande dupliquée ✅');
      router.push(`/admin/requests/${j.id}`);
    } catch (e: any) {
      setLastError(e?.message ?? 'Erreur inconnue');
    } finally {
      setDuplicating(false);
    }
  }

  // Envoi feuilles de route (artiste + client) – on n'empêche plus par le statut
  const sendRunSheets = async () => {
    if (!proposal?.id && !id) return;

    try {
      setSendingRunSheets(true);
      setLastError('');

      const baseArgs = proposal?.id
        ? { _proposal_id: proposal.id }
        : { _request_id: id };

      const candidates = [
        { fn: 'admin_send_runsheets', args: baseArgs },
        { fn: 'admin_send_run_sheets', args: baseArgs },
        { fn: 'admin_send_feuilles_de_route', args: baseArgs },
        { fn: 'admin_send_roadmap', args: baseArgs },
      ];

      let success = false;
      let lastErr: string | null = null;

      for (const c of candidates) {
        const { error } = await supabase.rpc(c.fn, c.args as any);
        if (!error) {
          success = true;
          // Génère/insère des feuilles de route dans itineraries si une proposition existe
          if (proposal?.id) {
            try {
              await fetch('/api/roadmaps/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proposal_id: proposal.id }),
              });
            } catch {
              /* best effort */
            }
          }
          break;
        }
        lastErr = error.message;
      }

      if (!success) throw new Error(lastErr ?? 'RPC indisponible');

      alert('Feuilles de route envoyées ✅');
      await loadCore();
      await loadProposal();
    } catch (e: any) {
      setLastError(
        `Envoi des feuilles de route impossible : ${e?.message ?? 'inconnue'}`
      );
      alert('Erreur envoi feuilles de route ❌');
    } finally {
      setSendingRunSheets(false);
    }
  };

  /* ======= Données dérivées ======= */
  const showAddress =
    req?.venue_address ||
    (venueFb
      ? `${venueFb.address_line1 ?? ''}${
          venueFb.postal_code || venueFb.city
            ? venueFb.address_line1
              ? ', '
              : ''
            : ''
        }${venueFb.postal_code ?? ''}${
          venueFb.postal_code && venueFb.city ? ' ' : ''
        }${venueFb.city ?? ''}`
      : '');
  const showCompany = req?.venue_company_name || venueFb?.company_name || null;
  const showContactName = req?.venue_contact_name || venueFb?.contact_name || null;
  const showEmail = req?.venue_contact_email || venueFb?.billing_email || null;
  const showPhone = req?.venue_contact_phone || venueFb?.contact_phone || null;

  const canInviteAll = !inviting && artists.length > 0;
  const canInviteSelected = !inviting && selectedArtistIds.length > 0;
  const canSendProposal =
    acceptedArtists.length > 0 &&
    !!selectedAcceptedId &&
    UUID36.test(selectedAcceptedId);

  // Toujours utile pour les badges / timeline
  const clientApproved =
    isClientApprovedProposal(proposal) ||
    toKey(req?.status) === 'client_approved' ||
    toKey(req?.status) === 'confirmed';

  // ✅ bouton actif dès qu'une proposition existe
  const runSheetsEnabled = !!proposal?.id && !sendingRunSheets;

  /* ======= Render ======= */
  if (loading) return <div className="text-slate-500">Chargement…</div>;
  if (!req) {
    return (
      <div className="space-y-3">
        <div className="text-slate-500">Demande introuvable.</div>
        {lastError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm whitespace-pre-wrap">
            {lastError}
          </div>
        )}
        <Link
          href="/dashboard"
          className="text-sm underline text-[var(--brand)]"
        >
          ← Retour
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Demande</h1>
            <div className="text-slate-600">
              <div className="font-medium">{req.title}</div>
              <div>
                {fmtDateFR(req.event_date)} • {statusFR(req.status)}
                {req.start_time ? ` • ${req.start_time}` : ''}
                {typeof req.duration_minutes === 'number'
                  ? ` • ${fmtMinutes(req.duration_minutes)}`
                  : ''}
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                  {labelForEventFormat(req.event_format as any)}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                  {formationLabel(req.formation)}
                </span>
                {proposal && (
                  <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                    Proposition : {proposalStatusFR(proposal.status)}
                  </span>
                )}
                {req.managed_booking && (
                  <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                    Gestion SwingBooking ({req.managed_booking_status || 'demandée'})
                  </span>
                )}
                {clientApproved && (
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                    Validée par le client
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={async () => {
                setLoading(true);
                await loadCore();
                await Promise.all([loadAccepted(), loadProposal()]);
                setLoading(false);
              }}
              className="text-sm px-3 py-2 rounded-lg border hover:bg-slate-50"
              title="Rafraîchir la demande"
            >
              Rafraîchir
            </button>

            {proposalSentFlag && (
              <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                Proposition envoyée
              </span>
            )}

            {proposal?.id && (
              <Link
                href={`/admin/proposals/${proposal.id}`}
                className="text-sm px-3 py-2 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                title="Voir la proposition"
              >
                Voir la proposition
              </Link>
            )}

            <button
              onClick={sendRunSheets}
              disabled={!runSheetsEnabled}
              className={`text-sm px-3 py-2 rounded-lg ${
                runSheetsEnabled
                  ? 'bg-emerald-600 text-white hover:opacity-90'
                  : 'bg-slate-200 text-slate-500'
              } transition`}
              title={
                proposal?.id
                  ? 'Envoyer la feuille de route (artiste + client)'
                  : 'Une proposition doit exister'
              }
            >
              {sendingRunSheets ? 'Envoi…' : 'Envoyer les feuilles de route'}
            </button>

            <button
              onClick={duplicateRequest}
              disabled={duplicating}
              className="text-sm px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              title="Dupliquer cette demande"
            >
              {duplicating ? 'Duplication…' : 'Dupliquer'}
            </button>

            <Link
              href="/dashboard"
              className="text-sm underline text-[var(--brand)]"
            >
              ← Retour
            </Link>

            <button
              onClick={deleteRequest}
              disabled={deleting}
              className="text-sm px-3 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
              title="Supprimer définitivement la demande"
            >
              {deleting ? 'Suppression…' : 'Supprimer'}
            </button>
          </div>
        </div>

        {lastError && (
          <div className="mt-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm whitespace-pre-wrap">
            {lastError}
          </div>
        )}
      </header>

      {/* TIMELINE */}
      <section className="border rounded-2xl p-4">
        <h2 className="text-lg font-semibold mb-3">Statut</h2>
        <ol className="flex flex-wrap items-center gap-2">
          {steps.map((st, idx) => {
            const active =
              idx <= currentStepIndex ||
              (st.key === 'client_approved' && clientApproved);
            return (
              <li key={st.key} className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    active ? 'bg-[var(--brand)]' : 'bg-slate-300'
                  }`}
                />
                <span
                  className={`text-sm ${
                    active ? 'text-slate-900 font-medium' : 'text-slate-500'
                  }`}
                >
                  {st.label}
                </span>
                {idx < steps.length - 1 && (
                  <span className="mx-2 h-px w-6 bg-slate-200" />
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* DÉTAILS PRESTATION */}
      <section className="border rounded-2xl p-4 space-y-2">
        <h2 className="text-lg font-semibold">Détails de la prestation</h2>
        <div className="grid sm:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-slate-500">Format</div>
            <div className="font-medium">
              {req.event_format ? labelForEventFormat(req.event_format) : '—'}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Date</div>
            <div className="font-medium">{fmtDateFR(req.event_date)}</div>
          </div>
          <div>
            <div className="text-slate-500">Heure de début</div>
            <div className="font-medium">{req.start_time ?? '—'}</div>
          </div>
          <div>
            <div className="text-slate-500">Durée</div>
            <div className="font-medium">{fmtMinutes(req.duration_minutes)}</div>
          </div>
          <div>
            <div className="text-slate-500">Formation</div>
            <div className="font-medium">{formationLabel(req.formation)}</div>
          </div>
          <div>
            <div className="text-slate-500">Public estimé</div>
            <div className="font-medium">{req.audience_size ?? '—'}</div>
          </div>
        </div>
        {req.practical_info && (
          <div className="text-sm">
            <div className="text-slate-500">Infos pratiques</div>
            <div className="font-medium whitespace-pre-wrap">
              {req.practical_info}
            </div>
          </div>
        )}
      </section>

      {/* Occurrences */}
      <section className="border rounded-2xl p-4 space-y-2">
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

      {/* ÉTABLISSEMENT */}
      <section className="border rounded-2xl p-4 space-y-2">
        <h2 className="text-lg font-semibold">Établissement</h2>
        <div className="text-sm">
          <div>
            <span className="font-medium">Nom :</span> {showCompany || '—'}
          </div>
          <div>
            <span className="font-medium">Adresse :</span> {showAddress || '—'}
          </div>
          <div>
            <span className="font-medium">Contact :</span>{' '}
            {showContactName || '—'}
          </div>
          <div>
            <span className="font-medium">Email :</span> {showEmail || '—'}
          </div>
          <div>
            <span className="font-medium">Téléphone :</span> {showPhone || '—'}
          </div>
          {req.notes ? (
            <div className="mt-2 whitespace-pre-wrap">{req.notes}</div>
          ) : null}
        </div>
      </section>

      {/* TARIFS */}
      <section className="border rounded-2xl p-4 space-y-3">
        <h2 className="text-lg font-semibold">Tarification interne (privé admin)</h2>
        <form
          onSubmit={savePricing}
          className="grid md:grid-cols-4 gap-4 items-end"
        >
          <div>
            <label className="text-sm font-medium">Montant client</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full border p-3 rounded-xl"
              value={pricing?.client_quote ?? ''}
              onChange={e =>
                setPricingField(
                  'client_quote',
                  e.target.value === '' ? '' : parseFloat(e.target.value)
                )
              }
              placeholder="ex: 1500"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Cachet artiste</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full border p-3 rounded-xl"
              value={pricing?.artist_fee ?? ''}
              onChange={e =>
                setPricingField(
                  'artist_fee',
                  e.target.value === '' ? '' : parseFloat(e.target.value)
                )
              }
              placeholder="ex: 800"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Frais internes</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full border p-3 rounded-xl"
              value={pricing?.internal_costs ?? ''}
              onChange={e =>
                setPricingField(
                  'internal_costs',
                  e.target.value === '' ? '' : parseFloat(e.target.value)
                )
              }
              placeholder="ex: 150"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn btn-primary mt-6"
              disabled={savingPricing}
            >
              {savingPricing ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
        <p className="text-xs text-slate-500">
          Ces montants restent invisibles pour le client et pour l’artiste (RLS).
        </p>

        {proposal?.compensation_amount != null && (
          <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 text-sm space-y-1">
            <div className="font-semibold">Rémunération artiste (proposition)</div>
            <div>
              Mode :{' '}
              {proposal.compensation_mode === 'cachet'
                ? 'Cachet via organisme'
                : 'Facture (artiste/structure)'}
            </div>
            <div>
              Montant :{' '}
              <strong>
                {proposal.compensation_amount.toLocaleString('fr-FR')}{' '}
                {pricing?.currency || '€'}
              </strong>
              {proposal.compensation_mode === 'cachet' && proposal.compensation_organism
                ? ` • ${proposal.compensation_organism}`
                : ''}
            </div>
            {proposal.compensation_expenses != null &&
              proposal.compensation_expenses > 0 && (
                <div>
                  Défraiement :{' '}
                  {proposal.compensation_expenses.toLocaleString('fr-FR')}{' '}
                  {pricing?.currency || '€'}
                </div>
              )}
            <div className="pt-1">
              Frais de service SwingBooking : <strong>0 €</strong> (commission supprimée)
            </div>
          </div>
        )}
      </section>

      {/* ARTISTES / INVITATIONS / PROPOSITION */}
      <section className="border rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Artistes — {artists.length} trouvé(s) • {selectedArtistIds.length}{' '}
            sélectionné(s)
          </h2>

          <div className="flex items-center gap-2">
            <label className="text-sm">Formation</label>
            <select
              className="border p-2 rounded-lg"
              value={pickFormation}
              onChange={e => setPickFormation(e.target.value as Formation)}
            >
              {FORMATIONS.map(f => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={`btn btn-accent ${
                !canInviteAll ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={inviteAll}
              disabled={!canInviteAll}
              title={
                !canInviteAll
                  ? inviting
                    ? 'Envoi en cours…'
                    : artists.length === 0
                    ? 'Aucun artiste pour cette formation'
                    : ''
                  : `Inviter tous les ${pickFormation}`
              }
            >
              Inviter tous les {pickFormation}
            </button>

            <button
              type="button"
              className={`btn btn-primary ${
                !canInviteSelected ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => inviteSelected()}
              disabled={!canInviteSelected}
              title={
                !canInviteSelected
                  ? inviting
                    ? 'Envoi en cours…'
                    : selectedArtistIds.length === 0
                    ? 'Sélectionne au moins un artiste'
                    : ''
                  : 'Envoyer des invitations aux artistes sélectionnés'
              }
            >
              Envoyer invit. sélection
            </button>
          </div>
        </div>

        {/* Liste artistes */}
        {artistsLoading ? (
          <div className="text-sm text-slate-600">Chargement des artistes…</div>
        ) : lastError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
            Erreur lors du chargement des artistes : {lastError}
          </div>
        ) : artists.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
            Aucun artiste actif trouvé pour{' '}
            <strong>{formationLabel(pickFormation)}</strong>.
          </div>
        ) : (
          <ul className="grid md:grid-cols-2 gap-3">
            {artists.map(a => {
              const alreadyInvited = invitedArtistIds.has(a.id);
              const isSelected = selectedArtistIds.includes(a.id);
              return (
                <li
                  key={a.id}
                  className={`border rounded-xl p-3 flex items-center justify-between ${
                    isSelected ? 'bg-indigo-50 border-indigo-200' : ''
                  } ${alreadyInvited ? 'opacity-80' : ''}`}
                >
                  <div className="space-y-1">
                    <div className="font-medium">
                      {a.stage_name || a.full_name || 'Artiste sans nom'}
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-1">
                      {Array.isArray(a.formations)
                        ? a.formations.map(f => {
                            const label = formationLabel(f as Formation);
                            return (
                              <span
                                key={`${a.id}-${String(f)}`}
                                className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700"
                              >
                                {label}
                              </span>
                            );
                          })
                        : <span>{String(a.formations ?? '—')}</span>}
                    </div>
                    {alreadyInvited && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                        Proposition envoyée
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={alreadyInvited}
                    onClick={() => toggleArtist(a.id)}
                    className={`text-sm px-3 py-2 rounded-lg border ${
                      alreadyInvited
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {alreadyInvited
                      ? 'Déjà invité'
                      : isSelected
                      ? 'Désélectionner'
                      : 'Sélectionner'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Acceptés → proposition */}
        <div className="mt-6 border-t pt-4">
          <div className="flex items-center justify_between gap-3">
            <h3 className="text-base font-semibold">Artistes qui ont accepté</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {acceptedArtists.length} accepté(s)
              </span>
              <button
                className="text-sm underline"
                onClick={loadAccepted}
                disabled={acceptedLoading}
                title="Rafraîchir"
              >
                {acceptedLoading ? 'Rafraîchissement…' : 'Rafraîchir'}
              </button>
            </div>
          </div>

          {acceptedArtists.length === 0 ? (
            <div className="mt-2 text-sm text-slate-600">
              Aucun artiste n’a encore confirmé sa disponibilité.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <select
                className="border p-2 rounded-lg w-full sm:w-auto"
                value={selectedAcceptedId ?? ''}
                onChange={e => setSelectedAcceptedId(e.target.value || null)}
              >
                <option value="" disabled>
                  — choisir un artiste —
                </option>
                {acceptedArtists.map(a => {
                  const fromList = artists.find(ar => ar.id === a.artist_id);
                  const displayName =
                    a.artists?.stage_name ||
                    fromList?.stage_name ||
                    fromList?.full_name ||
                    a.artist_id ||
                    'Artiste sans nom';
                  return (
                    <option key={a.artist_id} value={a.artist_id}>
                      {displayName}
                    </option>
                  );
                })}
              </select>

              <div className="grid md:grid-cols-2 gap-3">
                {acceptedArtists.map(a => {
                  const fromList = artists.find(ar => ar.id === a.artist_id);
                  const displayName =
                    a.artists?.stage_name ||
                    fromList?.stage_name ||
                    fromList?.full_name ||
                    a.artist_id ||
                    'Artiste sans nom';
                  const formations =
                    (fromList?.formations as Formation[] | null | undefined) ?? null;

                  return (
                    <div
                      key={`accepted-${a.artist_id}`}
                      className="border rounded-xl p-3 flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">{displayName}</div>
                        {formations && formations.length > 0 && (
                          <div className="text-xs text-slate-500 flex flex-wrap gap-1">
                            {formations.map(f => (
                              <span
                                key={`${a.artist_id}-${String(f)}`}
                                className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700"
                              >
                                {formationLabel(f)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setSelectedAcceptedId(a.artist_id);
                          sendProposal();
                        }}
                        disabled={!a.artist_id || inviting}
                        title="Envoyer la proposition au client"
                      >
                        {proposalSentFlag
                          ? 'Proposition (ré-envoyer)'
                          : 'Envoyer une proposition'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {proposalSentFlag && (
                <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 inline-flex">
                  Proposition envoyée
                </span>
              )}

              {proposal?.id && (
                <Link
                  href={`/admin/proposals/${proposal.id}`}
                  className="text-sm underline text-[var(--brand)]"
                  title="Ouvrir la dernière proposition"
                >
                  Voir la dernière proposition
                </Link>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
