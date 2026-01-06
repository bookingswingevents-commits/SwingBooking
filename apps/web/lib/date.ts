// apps/web/lib/date.ts
// ------------------------------------------------------
// Formatage dates FR + mapping des statuts en français
// ------------------------------------------------------

export function fmtDateFR(input?: string | Date | null): string {
  if (!input) return '—';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (!d || isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Mapping FR “pro & sexy” pour tous les statuts connus de l’app :
 * - booking_requests.status
 * - proposals.status
 * - request_artists.status (invitation artiste)
 */
const MAP: Record<string, string> = {
  // ---- Demandes (booking_requests)
  draft: 'Brouillon',
  reviewing: 'En revue',
  sent_to_artists: 'Envoyée aux artistes',
  proposal_sent: 'Proposition envoyée',
  client_review: 'En attente client',
  client_approved: 'Validée par le client',
  client_declined: 'Refusée par le client',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
  archived: 'Archivée',

  // ---- Propositions (proposals)
  pending: 'En attente',
  sent: 'Envoyée',
  approved: 'Approuvée',
  accepted: 'Accepté',
  rejected: 'Refusée',
  needs_changes: 'Modifications demandées',

  // ---- Invitations artistes (request_artists)
  invited: 'Invité',
  unread: 'Non lu',
  declined: 'Refusé',
  expired: 'Expiré',
};

function humanizeFallback(s: string) {
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Retourne le libellé FR d’un statut (multi-domaines) */
export function statusFR(status?: string | null): string {
  if (!status) return '—';
  const key = status.toLowerCase();
  return MAP[key] ?? humanizeFallback(key);
}
