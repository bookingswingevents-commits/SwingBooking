export type DashboardAction = {
  id?: string;
  type: string;
  title: string;
  description?: string;
  href: string;
  requestId?: string;
  proposalId?: string;
  priority: number;
};

type Formation = 'solo' | 'duo' | 'trio' | 'quartet' | 'dj' | string;

type BookingRequest = {
  id: string;
  title?: string | null;
  status?: string | null;
  formation?: Formation | null;
};

type Proposal = {
  id: string;
  request_id?: string;
  status?: string | null;
  booking_requests?: BookingRequest | null;
  artists?: { stage_name?: string | null } | null;
};

type Invite = {
  request_id: string;
  status?: string | null;
  booking_requests?: BookingRequest | null;
};

const SENT_STATUSES = ['sent', 'proposal_sent', 'waiting_client', 'pending_client'];
const ADMIN_TODO = ['to_process', 'new', 'pending', 'draft'];
const ARTIST_INVITE = ['invited', 'pending', 'waiting_artist', 'awaiting_artist'];

export function computeActions(params: {
  role: 'venue' | 'artist' | 'admin';
  requests?: BookingRequest[];
  proposals?: Proposal[];
  invites?: Invite[];
}): DashboardAction[] {
  const { role } = params;
  const list =
    role === 'venue'
      ? actionsVenue(params.proposals ?? [])
      : role === 'artist'
      ? actionsArtist(params.invites ?? [], params.proposals ?? [])
      : actionsAdmin(params.requests ?? [], params.proposals ?? []);

  return list.map((a, idx) => ({
    ...a,
    id:
      a.id ||
      `${role}:${a.type}:${a.requestId ?? 'na'}:${a.proposalId ?? 'na'}:${idx}`,
  }));
}

function actionsVenue(proposals: Proposal[]): DashboardAction[] {
  const actions: DashboardAction[] = [];
  for (const p of proposals) {
    const status = (p.status || '').toLowerCase();
    if (SENT_STATUSES.some((s) => status.includes(s))) {
      const req = p.booking_requests;
      actions.push({
        type: 'proposal',
        title: req?.title || 'Proposition envoyée',
        description: 'Répondre à la proposition',
        href: req ? `/venue/requests/${req.id}` : '/venue/requests',
        requestId: req?.id,
        proposalId: p.id,
        priority: 1,
        id: `venue:proposal:${req?.id ?? p.id}`,
      });
    }
  }
  return actions;
}

function actionsArtist(invites: Invite[], proposals: Proposal[]): DashboardAction[] {
  const actions: DashboardAction[] = [];
  for (const inv of invites) {
    const status = (inv.status || '').toLowerCase();
    if (ARTIST_INVITE.some((s) => status.includes(s))) {
      actions.push({
        type: 'invite',
        title: inv.booking_requests?.title || 'Invitation reçue',
        description: 'Confirmer ta disponibilité',
        href: `/artist/requests/${inv.request_id}`,
        requestId: inv.request_id,
        priority: 1,
        id: `artist:invite:${inv.request_id}`,
      });
    }
  }
  for (const p of proposals) {
    const status = (p.status || '').toLowerCase();
    if (status.includes('pending') || status.includes('draft')) {
      actions.push({
        type: 'proposal_comp',
        title: p.booking_requests?.title || 'Renseigner la rémunération',
        description: 'Compléter ta rémunération',
        href: p.request_id ? `/artist/requests/${p.request_id}` : '/artist/requests',
        requestId: p.request_id,
        proposalId: p.id,
        priority: 2,
        id: `artist:comp:${p.request_id ?? p.id}`,
      });
    }
  }
  return actions;
}

function actionsAdmin(requests: BookingRequest[], proposals: Proposal[]): DashboardAction[] {
  const actions: DashboardAction[] = [];
  for (const r of requests) {
    const status = (r.status || '').toLowerCase();
    if (ADMIN_TODO.some((s) => status.includes(s))) {
      actions.push({
        type: 'request',
        title: r.title || 'Demande à traiter',
        description: 'Analyser la demande et inviter des artistes',
        href: `/admin/requests/${r.id}`,
        requestId: r.id,
        priority: 1,
        id: `admin:req:${r.id}`,
      });
    }
  }

  for (const p of proposals) {
    const status = (p.status || '').toLowerCase();
    if (status.includes('accepted') || status.includes('artist_ok') || status.includes('ready')) {
      actions.push({
        type: 'proposal',
        title: p.booking_requests?.title || 'Proposition à envoyer au client',
        description: 'Envoyer la proposition',
        href: p.booking_requests ? `/admin/requests/${p.booking_requests.id}` : '/admin/requests',
        requestId: p.booking_requests?.id,
        proposalId: p.id,
        priority: 2,
        id: `admin:proposal:${p.request_id ?? p.id}`,
      });
    }
  }
  return actions;
}
