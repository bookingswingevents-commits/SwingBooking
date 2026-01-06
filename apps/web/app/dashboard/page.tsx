'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR, statusFR } from '@/lib/date';
import { labelForEventFormat } from '@/lib/event-formats';
import { getPlanConfig } from '@/lib/plan';
import { getArtistIdentity } from '@/lib/artistIdentity';
import { computeActions, DashboardAction } from '@/lib/dashboardActions';
import { QuickLinks } from '@/components/dashboard/QuickLinks';
import { ActionsRequiredList } from '@/components/dashboard/ActionsRequiredList';

/* ================== Types ================== */
type Role = 'admin' | 'venue' | 'artist';

type Profile = { id: string; role: Role; full_name?: string | null };

type Formation = 'solo' | 'duo' | 'trio' | 'quartet' | 'dj';

type BookingRequest = {
  id: string;
  title: string;
  status: string;
  event_date: string | null;
  created_at: string;
  event_format?: string | null;
  formation?: Formation | null;
};

type Invitation = {
  id: number;
  request_id: string;
  created_at: string;
  status?: string | null;
  booking_requests: {
    id: string;
    title: string;
    event_date: string | null;
    venue_address?: string | null;
    formation?: Formation | null;
    event_format?: string | null;
  } | null;
};

type ArtistMini = {
  stage_name: string | null;
  formations: Formation[] | null;
  bio: string | null;
  tech_needs: string | null;
  contact_phone: string | null;
  youtube_url: string | null;
  instagram_url: string | null;
  is_active: boolean | null;
};

type ResidencyUpcoming = {
  id: string;
  start_date_sun: string;
  end_date_sun: string;
  residencies: {
    name: string;
    clients?: { name: string } | { name: string }[] | null;
  } | null;
  week_bookings: {
    artist_id: string;
    status: string;
  } | { artist_id: string; status: string }[] | null;
};

type ResidencyInvitation = {
  id: string;
  token: string;
  status: string | null;
  sent_at: string | null;
  created_at: string;
  target_filter: any;
  residencies: {
    id: string;
    name: string;
    clients?: { name: string } | { name: string }[] | null;
  } | null;
};

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

type Proposal = {
  id: string;
  status: string;
  created_at: string;
  booking_requests: {
    id: string;
    title: string;
    event_date: string | null;
    event_format?: string | null;
    formation?: Formation | null;
  } | null;
  artists: { stage_name: string | null } | null;

  // 👇 Nouveau : réponses du client (venue) sur cette proposition
  proposal_venue_responses?: {
    decision: string;
    created_at: string;
  }[] | null;
};

/* ================== Page ================== */
export default function DashboardPage() {
  const router = useRouter();

  const unwrap = <T,>(val: T | T[] | null | undefined): T | null =>
    Array.isArray(val) ? (val[0] ?? null) : (val ?? null);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lastError, setLastError] = useState<string>('');

  // VENUE
  const [venueRequests, setVenueRequests] = useState<BookingRequest[]>([]);
  const [venueProposals, setVenueProposals] = useState<Proposal[]>([]);
  const [venueUnlockedArtists, setVenueUnlockedArtists] = useState<UnlockedArtist[]>([]);

  // ARTIST
  const [artist, setArtist] = useState<ArtistMini | null>(null);
  const [artistInvites, setArtistInvites] = useState<Invitation[]>([]);
  const [artistUpcoming, setArtistUpcoming] = useState<BookingRequest[]>([]);
  const [artistResidencyUpcoming, setArtistResidencyUpcoming] = useState<ResidencyUpcoming[]>([]);
  const [artistResidencyCount, setArtistResidencyCount] = useState(0);
  const [artistResidencyInvites, setArtistResidencyInvites] = useState<ResidencyInvitation[]>([]);

  // ADMIN
  const [adminRecentRequests, setAdminRecentRequests] = useState<BookingRequest[]>([]);
  const [adminRecentProposals, setAdminRecentProposals] = useState<Proposal[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLastError('');

      const {
        data: { session },
        error: sessErr,
      } = await supabase.auth.getSession();
      if (sessErr) {
        setLastError(`Erreur session : ${sessErr.message}`);
        setLoading(false);
        return;
      }
      if (!session) {
        router.push('/login');
        return;
      }
      const userId = session.user.id;
      const accessToken = session.access_token ?? undefined;

      // Profil / rôle
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', userId)
        .maybeSingle();
      if (profErr) {
        setLastError(`Erreur profil : ${profErr.message}`);
        setLoading(false);
        return;
      }
      setProfile(prof as Profile);

      // Relier automatiquement les demandes anonymes créées avec le même email
      if (prof?.role === 'venue' && session.user.email) {
        try {
          await fetch('/api/requests/link-anonymous', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify({ email: session.user.email }),
          });
        } catch (e) {
          console.warn('[dashboard] link-anonymous failed', e);
        }
      }

      /* ====== VENUE (client) ====== */
      if (prof?.role === 'venue') {
        const [reqs, props, unlocked] = await Promise.all([
          supabase
            .from('booking_requests')
            .select('id, title, status, event_date, created_at, event_format, formation')
            .eq('venue_id', userId)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('proposals')
            .select(
              'id, status, created_at, booking_requests(id, title, event_date, event_format, formation), artists(stage_name)'
            )
            .eq('booking_requests.venue_id', userId)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
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
            .order('first_unlocked_at', { ascending: false })
            .limit(50),
        ]);
        if (reqs?.data) setVenueRequests(reqs.data as BookingRequest[]);
        if (props?.data)
          setVenueProposals(
            (props.data as any[]).map((p) => ({
              ...p,
              booking_requests: unwrap(p.booking_requests),
              artists: unwrap(p.artists),
            })) as Proposal[]
          );
        if (unlocked?.data)
          setVenueUnlockedArtists(
            (unlocked.data as any[]).map((row) => ({
              ...row,
              artists: unwrap(row.artists),
            })) as UnlockedArtist[]
          );
      }

      /* ====== ARTIST ====== */
      if (prof?.role === 'artist') {
        const identity = await getArtistIdentity(supabase);
        const artistId = identity.artistId;
        if (!artistId) {
          setLastError('Compte artiste non lié.');
          setArtist(null);
          setArtistInvites([]);
          setArtistUpcoming([]);
          setArtistResidencyUpcoming([]);
          setArtistResidencyCount(0);
          setArtistResidencyInvites([]);
          setLoading(false);
          return;
        }

        const { data: a } = await supabase
          .from('artists')
          .select(
            'stage_name, formations, bio, tech_needs, contact_phone, youtube_url, instagram_url, is_active'
          )
          .eq('id', artistId)
          .maybeSingle();
        setArtist((a as ArtistMini) ?? null);

        const { data: inv } = await supabase
          .from('request_artists')
          .select(
            `
            id, request_id, status, created_at,
            booking_requests(id, title, event_date, venue_address, formation, event_format)
          `
          )
          .eq('artist_id', artistId)
          .order('created_at', { ascending: false })
          .limit(20);
        setArtistInvites(
          (inv ?? []).map((row: any) => ({
            ...row,
            booking_requests: unwrap(row.booking_requests),
          })) as Invitation[]
        );

        const { data: upc } = await supabase
          .from('booking_requests')
          .select('id, title, status, event_date, created_at, event_format, formation')
          .gte('event_date', new Date().toISOString().slice(0, 10))
          .order('event_date', { ascending: true })
          .limit(6);
        setArtistUpcoming((upc ?? []) as BookingRequest[]);

        const todayStr = new Date().toISOString().slice(0, 10);
        const { data: resBookings, error: resErr } = await supabase
          .from('residency_weeks')
          .select(
            'id, start_date_sun, end_date_sun, residencies(name, clients(name)), week_bookings!inner(artist_id, status)'
          )
          .gte('end_date_sun', todayStr)
          .eq('week_bookings.artist_id', artistId)
          .eq('week_bookings.status', 'CONFIRMED')
          .order('start_date_sun', { ascending: true })
          .limit(5);
        if (resErr) {
          setLastError(resErr.message);
        }
        setArtistResidencyUpcoming((resBookings ?? []) as unknown as ResidencyUpcoming[]);

        const { count } = await supabase
          .from('residency_weeks')
          .select('id, week_bookings!inner(artist_id, status)', { count: 'exact', head: true })
          .gte('end_date_sun', todayStr)
          .eq('week_bookings.artist_id', artistId)
          .eq('week_bookings.status', 'CONFIRMED');
        setArtistResidencyCount(count ?? (resBookings?.length ?? 0));

        const inviteFilters = [`target_filter->>artist_id.eq.${artistId}`];
        if (identity.email) {
          inviteFilters.push(`target_filter->>artist_email.eq.${identity.email}`);
        }
        const { data: resInvites } = await supabase
          .from('residency_invitations')
          .select('id, token, status, sent_at, created_at, target_filter, residencies(id, name, clients(name))')
          .or(inviteFilters.join(','))
          .order('created_at', { ascending: false })
          .limit(10);
        setArtistResidencyInvites((resInvites ?? []) as unknown as ResidencyInvitation[]);
      }

      /* ====== ADMIN ====== */
      if (prof?.role === 'admin') {
        const [reqs, props] = await Promise.all([
          supabase
            .from('booking_requests')
            .select('id, title, status, event_date, created_at, event_format, formation')
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('proposals')
            .select(
              `
              id,
              status,
              created_at,
              booking_requests(id, title, event_date, event_format, formation),
              artists(id, stage_name),
              proposal_venue_responses(decision, created_at)
            `
            )
            .order('created_at', { ascending: false })
            .limit(20),
        ]);
        if (reqs?.data) setAdminRecentRequests(reqs.data as BookingRequest[]);
        if (props?.data)
          setAdminRecentProposals(
            (props.data as any[]).map((p) => ({
              ...p,
              booking_requests: unwrap(p.booking_requests),
              artists: unwrap(p.artists),
            })) as Proposal[]
          );
      }

      setLoading(false);
    })();
  }, [router]);

  const role = profile?.role;

  if (loading)
    return <div className="text-slate-500">Chargement du tableau de bord…</div>;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">
          Plateforme Swing Booking – mise en relation établissements & artistes
        </h1>
        <p className="text-slate-600">
          Vue d&apos;ensemble de votre activité : demandes, propositions, artistes débloqués
          et prochains événements.
        </p>
        {lastError && (
          <div className="mt-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm whitespace-pre-wrap">
            {lastError}
          </div>
        )}
      </header>

      {/* ======== VENUE (CLIENT) ======== */}
      {role === 'venue' && (
        <VenueDashboard
          requests={venueRequests}
          proposals={venueProposals}
          unlocked={venueUnlockedArtists}
          actions={computeActions({
            role: 'venue',
            proposals: venueProposals,
          })}
        />
      )}

      {/* ======== ARTIST ======== */}
      {role === 'artist' && (
        <section className="grid md:grid-cols-[2fr_1fr] gap-4">
          <div className="space-y-6">
            {lastError && lastError.includes('Compte artiste non lié') ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
                Compte artiste non lié. Contactez l’admin pour activer votre accès.
                <div className="mt-2">
                  <a href="mailto:contact@swingbooking.fr" className="underline">
                    Contacter l’admin
                  </a>
                </div>
              </div>
            ) : null}
            <ArtistHeaderStats
              invites={artistInvites}
              upcoming={artistUpcoming}
              residencyUpcomingCount={artistResidencyCount}
            />
            <div className="flex flex-wrap gap-2">
              <Link href="/artist/calendar" className="btn">
                Agenda
              </Link>
              <Link href="/artist/roadmaps" className="btn">
                Feuilles de route
              </Link>
            </div>

            {/* Profil + prochains bookings */}
            <section className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2 border rounded-2xl p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Mon profil artiste</h2>
                  <Link href="/artist/profile" className="btn btn-primary">
                    Modifier mon profil
                  </Link>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="font-medium">
                      {artist?.stage_name || 'Nom de scène non renseigné'}
                    </div>
                    {artist?.is_active ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                        Actif
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                        Inactif
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-slate-600">
                    Formations :{' '}
                    {artist?.formations?.length ? artist.formations.join(', ') : '—'}
                  </div>

                  <ProfileProgress artist={artist} />
                </div>
              </div>

              {/* Prochains bookings */}
              <div className="border rounded-2xl p-4 space-y-2 bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Prochains bookings</h3>
                  <Link
                    href="/artist/roadmaps"
                    className="text-sm underline text-[var(--brand)]"
                  >
                    Feuilles de route
                  </Link>
                </div>
                {artistUpcoming.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucun booking à venir.</p>
                ) : (
                  <ul className="space-y-2">
                    {artistUpcoming.map((b) => (
                      <li key={b.id} className="text-sm">
                        <div className="font-medium">{b.title}</div>
                        <div className="text-slate-600">
                          {fmtDateFR(b.event_date)} • {labelForEventFormat(b.event_format)} •{' '}
                          {statusFR(b.status)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="text-xs text-slate-500">
                  (Affichera les prestations confirmées une fois le flux de propositions
                  validé.)
                </div>
              </div>
            </section>

            <section className="rounded-2xl border p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Prochaines résidences</h3>
                <Link href="/artist/programmations" className="text-sm underline text-[var(--brand)]">
                  Voir toutes
                </Link>
              </div>
              {artistResidencyUpcoming.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune résidence confirmée à venir.</p>
              ) : (
                <ul className="space-y-2">
                  {artistResidencyUpcoming.map((b) => {
                    const res = b.residencies;
                    const clientName = Array.isArray(res?.clients)
                      ? res?.clients[0]?.name
                      : (res as any)?.clients?.name ?? null;
                    const resId = (res as any)?.id as string | undefined;
                    return (
                      <li key={b.id} className="text-sm flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">
                            {res?.name || 'Résidence'} • ✅ Confirmé
                          </div>
                          <div className="text-slate-600">
                            {fmtDateFR(b.start_date_sun)} → {fmtDateFR(b.end_date_sun)}{' '}
                            {clientName ? `• ${clientName}` : ''}
                          </div>
                        </div>
                        {resId ? (
                          <Link href={`/artist/programmations/${resId}`} className="btn">
                            Voir
                          </Link>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-3 border rounded-2xl p-4 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Invitations reçues</h2>
                <div className="text-sm text-slate-500">
                  Réponds présent ou non aux demandes.
                </div>
              </div>

              {artistInvites.length === 0 ? (
                <p className="text-slate-500">Aucune invitation reçue.</p>
              ) : (
                <ul className="grid md:grid-cols-2 gap-4">
                  {artistInvites.map((it) => {
                    const req = it.booking_requests;
                    return (
                      <li
                        key={it.id}
                        className="border rounded-2xl p-4 space-y-2 hover:shadow-sm bg-white"
                      >
                        <Link
                          href={`/artist/requests/${it.request_id}`}
                          className="block group"
                          title="Voir le détail de la demande"
                        >
                          <div className="font-medium group-hover:underline">
                            {req?.title ?? 'Demande sans titre'}
                          </div>
                          <div className="text-sm text-slate-600">
                            {fmtDateFR(req?.event_date)} •{' '}
                            {labelForEventFormat(req?.event_format)} •{' '}
                            {statusFR(it.status ?? 'invited')}
                          </div>
                          {req?.venue_address ? (
                            <div className="text-xs text-slate-500">
                              <span className="font-medium">Lieu :</span> {req.venue_address}
                            </div>
                          ) : null}
                        </Link>

                        <div className="flex gap-2 pt-1">
                          <Link
                            href={`/artist/requests/${it.request_id}`}
                            className="px-3 py-1 rounded-lg border text-sm hover:bg-slate-50"
                            title="Voir la demande complète"
                          >
                            Voir la demande
                          </Link>
                          <Link
                            href={`/artist/requests/${it.request_id}#repondre`}
                            className="px-3 py-1 rounded-lg border text-sm hover:bg-emerald-50"
                            title="Répondre à l’invitation"
                          >
                            Répondre
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-3 border rounded-2xl p-4 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Invitations résidences</h2>
                <div className="text-sm text-slate-500">Disponibilités en attente.</div>
              </div>

              {artistResidencyInvites.length === 0 ? (
                <p className="text-slate-500">Aucune invitation résidence.</p>
              ) : (
                <ul className="grid md:grid-cols-2 gap-4">
                  {artistResidencyInvites.map((inv) => {
                    const res = inv.residencies;
                    const tf = inv.target_filter || {};
                    const clientName = Array.isArray(res?.clients)
                      ? res?.clients[0]?.name
                      : (res as any)?.clients?.name ?? null;
                    return (
                      <li key={inv.id} className="border rounded-2xl p-4 space-y-2 bg-white">
                        <div className="font-medium">
                          {res?.name || 'Résidence'} {clientName ? `• ${clientName}` : ''}
                        </div>
                        <div className="text-sm text-slate-600">
                          Statut: {inv.status ?? 'sent'} • {tf.artist_email ?? '—'}
                        </div>
                        <Link
                          href={`/availability/${inv.token}`}
                          className="px-3 py-1 rounded-lg border text-sm hover:bg-slate-50 inline-flex"
                        >
                          Voir l’agenda
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <div className="space-y-4 md:sticky md:top-4 self-start z-0">
            <ActionsRequired
              actions={computeActions({
                role: 'artist',
                invites: artistInvites as any,
              })}
            />
            <NotesWidget />
          </div>
        </section>
      )}

      {/* ======== ADMIN ======== */}
      {role === 'admin' && (
        <section className="space-y-6">
          <AdminHeaderStats
            requests={adminRecentRequests}
            proposals={adminRecentProposals}
          />
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/calendar" className="btn">
              Agenda
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <ActionsRequired
                actions={computeActions({
                  role: 'admin',
                  requests: adminRecentRequests,
                  proposals: adminRecentProposals,
                })}
              />
              <AdminActivity
                requests={adminRecentRequests}
                proposals={adminRecentProposals}
              />
            </div>
            <div className="md:col-span-1">
              <NotesWidget />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/* ================== Sous-composants ================== */

/** Dashboard refondu — CLIENT (VENUE) */
function VenueDashboard({
  requests,
  proposals,
  unlocked,
  actions,
}: {
  requests: BookingRequest[];
  proposals: Proposal[];
  unlocked: UnlockedArtist[];
  actions: DashboardAction[];
}) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const proposalByRequest = useMemo(() => {
    const map = new Map<string, Proposal>();
    proposals.forEach((p) => {
      const rid = p.booking_requests?.id;
      if (rid && !map.has(rid)) map.set(rid, p);
    });
    return map;
  }, [proposals]);

  const kpis = useMemo(() => {
    const total = requests.length;
    const awaitingProposal = requests.filter((r) => !proposalByRequest.has(r.id)).length;
    const awaitingClient = proposals.filter((p) =>
      ['proposal_sent', 'waiting_client', 'pending_client'].includes(p.status)
    ).length;
    const confirmed =
      requests.filter((r) =>
        ['confirmed', 'accepted', 'booked', 'validated'].includes(r.status)
      ).length +
      proposals.filter((p) =>
        ['confirmed', 'accepted', 'booked', 'validated'].includes(p.status)
      ).length;
    const finished = requests.filter((r) =>
      ['done', 'archived', 'completed', 'cancelled'].includes(r.status)
    ).length;
    return { total, awaitingProposal, awaitingClient, confirmed, finished };
  }, [proposalByRequest, proposals, requests]);

  const upcoming = useMemo(() => {
    return requests
      .filter((r) => r.event_date && r.event_date >= todayStr)
      .sort((a, b) => (a.event_date && b.event_date && a.event_date > b.event_date ? 1 : -1))
      .slice(0, 5);
  }, [requests, todayStr]);

  const [tab, setTab] = useState<'active' | 'history'>('active');
  const filteredRequests = useMemo(() => {
    const historyStatuses = ['done', 'archived', 'completed', 'cancelled'];
    return requests.filter((r) =>
      tab === 'active' ? !historyStatuses.includes(r.status) : historyStatuses.includes(r.status)
    );
  }, [requests, tab]);

  return (
    <section className="space-y-6">
      {/* Header + raccourcis */}
      <div className="rounded-2xl border bg-white p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Tableau de bord</h2>
          <p className="text-slate-600 text-sm">
            Suivez vos demandes, vos propositions et vos événements à venir.
          </p>
        </div>
        <QuickLinks
          items={[
            { href: '/venue/calendar', label: 'Agenda' },
            { href: '/venue/roadmaps', label: 'Feuilles de route' },
            { href: '/venue/communication', label: 'Communication' },
          ]}
        />
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-5 gap-3">
        <KpiCard label="En cours" value={kpis.total - kpis.finished} />
        <KpiCard label="En attente de proposition" value={kpis.awaitingProposal} />
        <KpiCard label="En attente de votre réponse" value={kpis.awaitingClient} />
        <KpiCard label="Confirmés / À venir" value={kpis.confirmed} />
        <KpiCard label="Terminés" value={kpis.finished} />
      </div>

      {/* Actions requises */}
      <ActionsRequiredList actions={actions} />

      {/* Prochains événements */}
      <section className="rounded-2xl border bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Prochains événements</h3>
          <Link href="/venue/calendar" className="text-sm underline text-[var(--brand)]">
            Voir l’agenda
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-600">Aucun événement à venir pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border px-3 py-2 flex flex-col gap-1 hover:border-[var(--brand)] transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/venue/requests/${r.id}`} className="font-medium hover:underline">
                    {r.title || 'Demande'}
                  </Link>
                  <span className="text-xs text-slate-500">{fmtDateFR(r.event_date)}</span>
                </div>
                <div className="text-xs text-slate-600">
                  {labelForEventFormat(r.event_format) || 'Format non renseigné'} •{' '}
                  {statusFR(r.status)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Mes demandes */}
      <section className="rounded-2xl border bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Mes demandes</h3>
          <div className="flex items-center gap-2 text-sm">
            <button
              className={`px-3 py-1 rounded-lg border ${
                tab === 'active' ? 'bg-slate-900 text-white' : 'bg-white'
              }`}
              onClick={() => setTab('active')}
            >
              En cours
            </button>
            <button
              className={`px-3 py-1 rounded-lg border ${
                tab === 'history' ? 'bg-slate-900 text-white' : 'bg-white'
              }`}
              onClick={() => setTab('history')}
            >
              Historique
            </button>
          </div>
        </div>
        {filteredRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed p-4 text-sm text-slate-600 bg-slate-50">
            Aucune demande dans cette section.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {filteredRequests.slice(0, 8).map((r) => (
              <article
                key={r.id}
                className="rounded-xl border p-4 space-y-2 hover:shadow-sm transition bg-white"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold line-clamp-1">{r.title || 'Demande'}</h4>
                  <Badge status={r.status} />
                </div>
                <div className="text-sm text-slate-600">
                  {fmtDateFR(r.event_date)} • {labelForEventFormat(r.event_format)}
                </div>
                <div className="text-xs text-slate-500">
                  Formation : {r.formation ? r.formation.toUpperCase() : '—'}
                </div>
                <Link
                  href={`/venue/requests/${r.id}`}
                  className="btn btn-primary w-full text-center mt-2"
                >
                  Ouvrir
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Catalogue artistes débloqués */}
      <VenueUnlockedArtistsSection items={unlocked} />
    </section>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-white p-4 space-y-1">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-3xl font-semibold">{value}</div>
    </div>
  );
}

function Badge({ status }: { status?: string | null }) {
  const map: Record<string, string> = {
    proposal_sent: 'bg-blue-100 text-blue-700',
    waiting_client: 'bg-amber-100 text-amber-700',
    pending_client: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-emerald-100 text-emerald-700',
    accepted: 'bg-emerald-100 text-emerald-700',
    booked: 'bg-emerald-100 text-emerald-700',
    done: 'bg-slate-200 text-slate-700',
    archived: 'bg-slate-200 text-slate-700',
    cancelled: 'bg-slate-200 text-slate-700',
  };
  const cls = map[status ?? ''] ?? 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${cls}`}>
      {statusFR(status ?? 'en_cours')}
    </span>
  );
}

/** Header stats — VENUE (client) */
function VenueHeaderStats({
  requests,
  proposals,
  unlocked,
}: {
  requests: BookingRequest[];
  proposals: Proposal[];
  unlocked: UnlockedArtist[];
}) {
  const stats = useMemo(() => {
    const totalRequests = requests.length;
    const totalProposals = proposals.length;
    const totalUnlocked = unlocked.length;

    const todayStr = new Date().toISOString().slice(0, 10);
    const upcoming = requests.filter(
      (r) => r.event_date && r.event_date >= todayStr
    ).length;

    return { totalRequests, totalProposals, totalUnlocked, upcoming };
  }, [requests, proposals, unlocked]);

  return (
    <div className="border rounded-2xl p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white">
      <div>
        <h2 className="text-2xl font-bold">Tableau de bord établissement</h2>
        <p className="text-slate-600 text-sm">
          Crée des demandes, suis les propositions et garde une base d&apos;artistes
          déjà joués chez toi.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
          <span>
            Demandes : <strong>{stats.totalRequests}</strong>
          </span>
          <span>•</span>
          <span>
            Propositions : <strong>{stats.totalProposals}</strong>
          </span>
          <span>•</span>
          <span>
            Prochains événements : <strong>{stats.upcoming}</strong>
          </span>
          <span>•</span>
          <span>
            Artistes débloqués : <strong>{stats.totalUnlocked}</strong>
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/catalogue" className="btn btn-accent">
          ➕ Créer une demande
        </Link>
        <Link href="/catalogue" className="btn">
          Voir le catalogue
        </Link>
        <Link href="/venue/calendar" className="btn">
          Calendrier
        </Link>
        <Link href="/venue/roadmaps" className="btn">
          Feuilles de route
        </Link>
        <Link href="/subscribe" className="btn">
          Packs &amp; offres
        </Link>
      </div>
    </div>
  );
}

/** Header stats — ARTISTE */
function ArtistHeaderStats({
  invites,
  upcoming,
  residencyUpcomingCount,
}: {
  invites: Invitation[];
  upcoming: BookingRequest[];
  residencyUpcomingCount: number;
}) {
  const stats = useMemo(() => {
    const totalInvites = invites.length;
    const totalUpcoming = upcoming.length + residencyUpcomingCount;
    const todayStr = new Date().toISOString().slice(0, 10);
    const soon = upcoming.filter(
      (r) => r.event_date && r.event_date >= todayStr
    ).length;

    return { totalInvites, totalUpcoming, soon };
  }, [invites, upcoming, residencyUpcomingCount]);

  return (
    <div className="border rounded-2xl p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white">
      <div>
        <h2 className="text-2xl font-bold">Tableau de bord artiste</h2>
        <p className="text-slate-600 text-sm">
          Centralise tes invitations, tes prochains bookings et l&apos;état de ton
          profil Swing Booking.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
          <span>
            Invitations : <strong>{stats.totalInvites}</strong>
          </span>
          <span>•</span>
          <span>
            Bookings à venir : <strong>{stats.totalUpcoming}</strong>
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/artist/profile" className="btn">
          Mettre à jour mon profil
        </Link>
        <Link href="/artist/programmations" className="btn">
          📅 Programmations
        </Link>
        <Link href="/artist/roadmaps" className="btn">
          Voir mes feuilles de route
        </Link>
      </div>
    </div>
  );
}

/** Header stats — ADMIN */
function AdminHeaderStats({
  requests,
  proposals,
}: {
  requests: BookingRequest[];
  proposals: Proposal[];
}) {
  const [showCreate, setShowCreate] = useState(false);
  const stats = useMemo(() => {
    const totalRequests = requests.length;
    const totalProposals = proposals.length;

    const todayStr = new Date().toISOString().slice(0, 10);
    const upcoming = requests.filter(
      (r) => r.event_date && r.event_date >= todayStr
    ).length;

    return { totalRequests, totalProposals, upcoming };
  }, [requests, proposals]);

  return (
    <div className="border rounded-2xl p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white">
      <div>
        <h2 className="text-2xl font-bold">Tableau de bord admin</h2>
        <p className="text-slate-600 text-sm">
          Suis les demandes, les propositions et les événements à venir sur la plateforme.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
          <span>
            Demandes : <strong>{stats.totalRequests}</strong>
          </span>
          <span>•</span>
          <span>
            Propositions : <strong>{stats.totalProposals}</strong>
          </span>
          <span>•</span>
          <span>
            Événements (futurs) : <strong>{stats.upcoming}</strong>
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 relative">
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-[var(--brand)] text-white font-medium hover:opacity-90 transition"
          onClick={() => setShowCreate((v) => !v)}
        >
          ➕ Créer
        </button>
        {showCreate ? (
          <div className="absolute right-0 top-12 z-10 w-64 rounded-xl border bg-white shadow-lg p-2 text-sm">
            <Link href="/admin/requests/new" className="block px-3 py-2 rounded-lg hover:bg-slate-50">
              Demande ponctuelle
            </Link>
            <Link href="/admin/programmations" className="block px-3 py-2 rounded-lg hover:bg-slate-50">
              Programmation / Résidence
            </Link>
          </div>
        ) : null}
        <Link href="/admin/requests" className="btn">
          Voir toutes les demandes
        </Link>
        <Link href="/admin/programmations" className="btn">
          📅 Programmations
        </Link>
      </div>
    </div>
  );
}

/** Agenda des prochains événements — CLIENT (VENUE) */
function VenueAgenda({ requests }: { requests: BookingRequest[] }) {
  const upcoming = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return requests
      .filter((r) => r.event_date && r.event_date >= todayStr)
      .sort((a, b) => {
        if (!a.event_date || !b.event_date) return 0;
        return a.event_date < b.event_date ? -1 : 1;
      })
      .slice(0, 6);
  }, [requests]);

  return (
    <section className="border rounded-2xl p-4 bg-white space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Agenda à venir</h2>
        {upcoming.length > 0 && (
          <span className="text-[11px] text-slate-500">
            {upcoming.length} prochain{upcoming.length > 1 ? 's' : ''} événement
            {upcoming.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {upcoming.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucun événement planifié pour le moment. Valide une proposition pour remplir
          ton agenda.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {upcoming.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border px-3 py-2 flex flex-col gap-0.5 hover:border-[var(--brand)] transition"
            >
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/venue/requests/${r.id}`}
                  className="font-medium truncate hover:underline"
                >
                  {r.title}
                </Link>
                <span className="text-xs text-slate-500">
                  {fmtDateFR(r.event_date)}
                </span>
              </div>
              <div className="text-xs text-slate-600">
                {labelForEventFormat(r.event_format) || 'Format non renseigné'} •{' '}
                {statusFR(r.status)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Timeline fusionnée — CLIENT (VENUE) */
function VenueActivity({
  requests,
  proposals,
}: {
  requests: BookingRequest[];
  proposals: Proposal[];
}) {
  const [tab, setTab] = useState<'all' | 'requests' | 'proposals'>('all');

  const items = useMemo(() => {
    const proposalByReqId = new Map<string, Proposal>();
    for (const p of proposals) {
      const rid = p.booking_requests?.id;
      if (!rid) continue;
      if (!proposalByReqId.has(rid)) {
        proposalByReqId.set(rid, p);
      }
    }

    const R = requests
      .filter((r) => !proposalByReqId.has(r.id))
      .map((r) => ({
        type: 'request' as const,
        id: r.id,
        title: r.title,
        when: r.created_at,
        date: r.event_date,
        status: r.status,
        subtitle: labelForEventFormat(r.event_format),
        href: `/venue/requests/${r.id}`,
      }));

    const P = Array.from(proposalByReqId.values()).map((p) => ({
      type: 'proposal' as const,
      id: p.id,
      title: p.booking_requests?.title ?? 'Proposition',
      when: p.created_at,
      date: p.booking_requests?.event_date ?? null,
      status: p.status,
      subtitle: p.artists?.stage_name ?? 'Artiste',
      href: p.booking_requests
        ? `/venue/requests/${p.booking_requests.id}`
        : `/venue/requests`,
    }));

    return [...R, ...P].sort((a, b) => (a.when < b.when ? 1 : -1));
  }, [requests, proposals]);

  const filtered = items.filter((i) =>
    tab === 'all'
      ? true
      : tab === 'requests'
      ? i.type === 'request'
      : i.type === 'proposal'
  );

  return (
    <section className="space-y-4 border rounded-2xl p-4 bg-white">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Demandes &amp; propositions</h2>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <span>{items.length} activité(s)</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className={`px-3 py-1 rounded-lg border text-sm ${
            tab === 'all' ? 'bg-slate-900 text-white' : 'bg-white'
          }`}
          onClick={() => setTab('all')}
        >
          Tous ({items.length})
        </button>
        <button
          className={`px-3 py-1 rounded-lg border text-sm ${
            tab === 'requests' ? 'bg-slate-900 text-white' : 'bg-white'
          }`}
          onClick={() => setTab('requests')}
        >
          Demandes ({items.filter((i) => i.type === 'request').length})
        </button>
        <button
          className={`px-3 py-1 rounded-lg border text-sm ${
            tab === 'proposals' ? 'bg-slate-900 text-white' : 'bg-white'
          }`}
          onClick={() => setTab('proposals')}
        >
          Propositions ({items.filter((i) => i.type === 'proposal').length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border p-6 bg-slate-50">
          <p className="text-slate-600">
            Rien pour l’instant. Commence par{' '}
            <Link href="/catalogue" className="underline text-[var(--brand)]">
              créer une demande
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((it) => (
            <li key={`${it.type}_${it.id}`}>
              <Link
                href={it.href}
                className="block border rounded-2xl p-4 hover:bg-slate-50 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        it.type === 'request'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      {it.type === 'request' ? 'Demande' : 'Proposition'}
                    </span>
                    <div className="font-medium">{it.title}</div>
                  </div>
                  <div className="text-xs text-slate-500">{fmtDateFR(it.when)}</div>
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {it.subtitle ? <span>{it.subtitle} • </span> : null}
                  {statusFR(it.status)}
                  {it.date ? <> • {fmtDateFR(it.date)}</> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Timeline fusionnée — ADMIN */
function AdminActivity({
  requests,
  proposals,
}: {
  requests: BookingRequest[];
  proposals: Proposal[];
}) {
  const [tab, setTab] = useState<'all' | 'requests' | 'proposals'>('all');

  const items = useMemo(() => {
    const proposalByReqId = new Map<string, Proposal>();
    for (const p of proposals) {
      const rid = p.booking_requests?.id;
      if (!rid) continue;
      if (!proposalByReqId.has(rid)) {
        proposalByReqId.set(rid, p);
      }
    }

    const R = requests
      .filter((r) => !proposalByReqId.has(r.id))
      .map((r) => ({
        type: 'request' as const,
        id: r.id,
        title: r.title,
        when: r.created_at,
        date: r.event_date,
        status: r.status,
        subtitle: labelForEventFormat(r.event_format),
        href: `/admin/requests/${r.id}`,
      }));

    const P = Array.from(proposalByReqId.values()).map((p) => {
      // 👇 on prend la décision du client si elle existe
      const resp = p.proposal_venue_responses?.[0] || null;
      const finalStatus = resp?.decision ?? p.status;

      return {
        type: 'proposal' as const,
        id: p.id,
        title: p.booking_requests?.title ?? 'Proposition',
        when: p.created_at,
        date: p.booking_requests?.event_date ?? null,
        status: finalStatus,
        subtitle: p.artists?.stage_name ?? 'Artiste',
        href: p.booking_requests
          ? `/admin/requests/${p.booking_requests.id}`
          : '/admin/requests',
      };
    });

    return [...R, ...P].sort((a, b) => (a.when < b.when ? 1 : -1));
  }, [requests, proposals]);

  const filtered = items.filter((i) =>
    tab === 'all'
      ? true
      : tab === 'requests'
      ? i.type === 'request'
      : i.type === 'proposal'
  );

  return (
    <div className="space-y-4 border rounded-2xl p-4 bg-white">
      <div className="flex items-center gap-2">
        <button
          className={`px-3 py-1 rounded-lg border ${
            tab === 'all' ? 'bg-slate-900 text-white' : 'bg-white'
          }`}
          onClick={() => setTab('all')}
        >
          Tous ({items.length})
        </button>
        <button
          className={`px-3 py-1 rounded-lg border ${
            tab === 'requests' ? 'bg-slate-900 text-white' : 'bg-white'
          }`}
          onClick={() => setTab('requests')}
        >
          Demandes ({items.filter((i) => i.type === 'request').length})
        </button>
        <button
          className={`px-3 py-1 rounded-lg border ${
            tab === 'proposals' ? 'bg-slate-900 text-white' : 'bg-white'
          }`}
          onClick={() => setTab('proposals')}
        >
          Propositions ({items.filter((i) => i.type === 'proposal').length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border p-6 bg-slate-50">
          <p className="text-slate-600">
            Rien pour l’instant ici. Commence par{' '}
            <Link href="/admin/requests/new" className="underline text-[var(--brand)]">
              créer une demande
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((it) => (
            <li key={`${it.type}_${it.id}`}>
              <Link
                href={it.href}
                className="block border rounded-2xl p-4 hover:bg-slate-50 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        it.type === 'request'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      {it.type === 'request' ? 'Demande' : 'Proposition'}
                    </span>
                    <div className="font-medium">{it.title}</div>
                  </div>
                  <div className="text-xs text-slate-500">{fmtDateFR(it.when)}</div>
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {it.subtitle ? <span>{it.subtitle} • </span> : null}
                  {statusFR(it.status)}
                  {it.date ? <> • {fmtDateFR(it.date)}</> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Petite carte de progression de profil (artiste) */
function ProfileProgress({ artist }: { artist: ArtistMini | null }) {
  const { percent } = useMemo(() => {
    if (!artist)
      return { percent: 0, missing: ['Nom de scène', 'Formations'] };
    const checks: { label: string; ok: boolean }[] = [
      { label: 'Nom de scène', ok: !!artist.stage_name?.trim() },
      {
        label: 'Formations',
        ok: !!(artist.formations && artist.formations.length > 0),
      },
      { label: 'Présentation', ok: !!artist.bio?.trim() },
      { label: 'Besoins techniques', ok: !!artist.tech_needs?.trim() },
      { label: 'Téléphone', ok: !!artist.contact_phone?.trim() },
      {
        label: 'Instagram ou YouTube',
        ok: !!(artist.instagram_url || artist.youtube_url),
      },
      { label: 'Profil actif', ok: artist.is_active === true },
    ];
    const okCount = checks.filter((c) => c.ok).length;
    const percent = Math.round((okCount / checks.length) * 100);
    return { percent };
  }, [artist]);

  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-600">Complétion du profil</div>
        <div className="font-semibold">{percent}%</div>
      </div>
      <div className="w-full h-2 rounded bg-slate-100 overflow-hidden">
        <div
          className="h-2 bg-[var(--accent)]"
          style={{ width: `${percent}%`, transition: 'width .4s ease' }}
        />
      </div>
    </div>
  );
}

/** Liste des artistes débloqués pour un établissement */
function VenueUnlockedArtistsSection({ items }: { items: UnlockedArtist[] }) {
  if (!items || items.length === 0) {
    return (
      <section className="border rounded-2xl p-4 bg-white">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Mon catalogue d&apos;artistes débloqués</h2>
            <p className="text-sm text-slate-600">
              Dès qu&apos;un artiste est confirmé sur une demande, son profil complet est
              débloqué pour ton établissement. Tu pourras le rebooker en 2 clics.
            </p>
          </div>
          <Link
            href="/venue/artists"
            className="text-xs underline text-[var(--brand)]"
          >
            Voir le catalogue
          </Link>
        </div>
        <div className="mt-3">
          <Link href="/catalogue" className="text-sm underline text-[var(--brand)]">
            Parcourir les formats d&apos;événements
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="border rounded-2xl p-4 bg-white space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Mon catalogue d&apos;artistes débloqués</h2>
          <p className="text-xs text-slate-500">
            Ces artistes ont déjà joué chez toi via Swing Booking. Tu peux les recontacter
            facilement pour d&apos;autres dates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-slate-600">
            {items.length} talent{items.length > 1 ? 's' : ''} débloqué
            {items.length > 1 ? 's' : ''}
          </span>
          <Link
            href="/venue/artists"
            className="text-xs underline text-[var(--brand)]"
          >
            Voir tout
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {items.slice(0, 6).map((ua) => {
          const a = ua.artists;
          if (!a) return null;
          return (
            <article
              key={ua.id}
              className="rounded-xl border p-3 flex flex-col gap-2 hover:border-[var(--brand)] transition"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold line-clamp-1">
                  {a.stage_name || 'Artiste'}
                </h3>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  Débloqué le {fmtDateFR(ua.first_unlocked_at)}
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
                      {f.toUpperCase()}
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
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ActionsRequired({ actions }: { actions: DashboardAction[] }) {
  return (
    <section className="border rounded-2xl p-4 bg-white space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Actions requises</h3>
        <span className="text-xs text-slate-500">
          {actions.length} action{actions.length > 1 ? 's' : ''} à traiter
        </span>
      </div>
      {actions.length === 0 ? (
        <div className="rounded-xl border border-dashed p-3 text-sm text-slate-600 bg-slate-50">
          Aucune action requise pour le moment.
        </div>
      ) : (
        <ul className="space-y-2">
          {actions.slice(0, 5).map((a) => (
            <li key={`${a.type}-${a.requestId ?? a.proposalId ?? a.title}`}>
              <Link
                href={a.href}
                className="block rounded-xl border p-3 hover:border-[var(--brand)] hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{a.title}</div>
                  <span className="text-[10px] uppercase text-slate-500">Priorité {a.priority}</span>
                </div>
                {a.description ? (
                  <div className="text-sm text-slate-600 mt-1">{a.description}</div>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Aperçu du profil établissement (venue) avec barre de progression + bouton édition + pack */
function VenueProfilePreview() {
  const [loading, setLoading] = useState(true);
  const [v, setV] = useState<any>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      const uid = session.user.id;
      const { data } = await supabase
        .from('venues')
        .select(
          `
          company_name,
          billing_email,
          address_line1,
          postal_code,
          city,
          contact_name,
          contact_phone,
          is_active,
          subscription_plan,
          is_pro
        `
        )
        .eq('id', uid)
        .maybeSingle();
      setV(data ?? null);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-slate-500 text-sm">Chargement…</div>;

  const checks = [
    !!v?.company_name,
    !!v?.billing_email,
    !!v?.address_line1,
    !!v?.postal_code,
    !!v?.city,
    !!v?.contact_name,
    !!v?.contact_phone,
  ];
  const percent = Math.round(
    (checks.filter(Boolean).length / checks.length) * 100
  );

  // Détermination du plan
  let rawPlan: string | null =
    (v?.subscription_plan as string | null) ?? null;
  const isProFlag = v?.is_pro === true;

  if (!rawPlan) {
    if (isProFlag) rawPlan = 'pro';
    else rawPlan = 'free';
  }

  const planCfg = getPlanConfig(rawPlan);

  const planLabelMap: Record<string, string> = {
    free: 'Sans abonnement',
    starter: 'Starter',
    pro: 'Pro',
    premium: 'Premium',
  };

  const planLabel = planLabelMap[planCfg.id] ?? 'Sans abonnement';

  return (
    <div className="space-y-4">
      {/* Infos établissement + complétion */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          <div className="font-medium">
            {v?.company_name || 'Établissement non renseigné'}
          </div>
          <div className="text-slate-600">
            {v?.address_line1 || '—'} {v?.postal_code || ''} {v?.city || ''}
          </div>
          <div className="text-slate-600">
            {v?.billing_email || '—'} • {v?.contact_phone || '—'}
          </div>
        </div>
        <Link href="/venue/profile" className="btn btn-primary">
          Modifier mon profil
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {/* Complétion profil */}
        <div className="md:col-span-2 rounded-xl border p-3 bg-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-600">Complétion du profil</div>
            <div className="font-semibold">{percent}%</div>
          </div>
          <div className="w-full h-2 rounded bg-slate-100 overflow-hidden">
            <div
              className="h-2 bg-[var(--accent)]"
              style={{ width: `${percent}%`, transition: 'width .4s ease' }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Un profil complet facilite le traitement de vos demandes et la
            communication avec les artistes.
          </p>
        </div>

        {/* Carte pack */}
        <div className="rounded-xl border p-3 bg-white space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Mon pack Swing Booking
              </div>
              <div className="font-semibold">{planLabel}</div>
            </div>
            {planCfg.id !== 'premium' && (
              <Link
                href="/subscribe"
                className="text-xs underline text-[var(--brand)]"
              >
                Voir les packs
              </Link>
            )}
          </div>

          <ul className="text-xs text-slate-600 space-y-1">
            {planCfg.id === 'free' && (
              <>
                <li>• Mode découverte : 1ère demande offerte</li>
                <li>• Pas de changement d’artiste sur la demande gratuite</li>
                <li>• Accès aux formats d’événements & propositions</li>
              </>
            )}
            {planCfg.id === 'starter' && (
              <>
                <li>• Événements confirmés jusqu’à 2/mois</li>
                <li>• Jusqu’à 2 événements confirmés par mois</li>
                <li>• Jusqu’à 2 modifications par événement</li>
              </>
            )}
            {planCfg.id === 'pro' && (
              <>
                <li>• Événements et modifications illimités</li>
                <li>• Outils de suivi & catalogue artistes débloqués</li>
              </>
            )}
            {planCfg.id === 'premium' && (
              <>
                <li>• Tout le pack Pro</li>
                <li>• Accès au catalogue artistes complet</li>
                <li>• Choix direct des artistes à booker</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Bloc-notes simple (localStorage) pour tous les rôles */
function NotesWidget() {
  const [value, setValue] = useState('');
  const storageKey = 'swing_booking_notes';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) setValue(stored);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // ignore
    }
  }, [value]);

  return (
    <section className="border rounded-2xl p-4 bg-white flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Bloc-notes</h2>
        <span className="text-[10px] text-slate-400">Enregistré sur cet appareil</span>
      </div>
      <p className="text-xs text-slate-500">
        Note ici des idées de programmation, des contacts, des retours ou des choses à ne
        pas oublier. Ce bloc-notes reste privé et stocké en local sur ton navigateur.
      </p>
      <textarea
        className="mt-1 flex-1 min-h-[120px] text-sm border rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
        placeholder="Ex : idées de soirées, artistes à tester, points à débriefer..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </section>
  );
}
