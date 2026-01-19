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

function parseDateInput(input?: string | Date | null) {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    const [, y, m, d] = match;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(date);
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const dayLabel = day === '1' ? '1er' : day;
  return { dayLabel, month, year };
}

export function formatDateFR(input?: string | Date | null): string {
  const date = parseDateInput(input);
  if (!date) return '—';
  const { dayLabel, month, year } = formatDateParts(date);
  return `${dayLabel} ${month} ${year}`;
}

export function formatRangeFR(start?: string | Date | null, end?: string | Date | null): string {
  const startDate = parseDateInput(start);
  const endDate = parseDateInput(end);
  if (!startDate && !endDate) return '—';
  if (startDate && !endDate) return formatDateFR(startDate);
  if (!startDate && endDate) return formatDateFR(endDate);

  const startParts = formatDateParts(startDate as Date);
  const endParts = formatDateParts(endDate as Date);
  const sameYear = startParts.year === endParts.year;
  const sameMonth = startParts.month === endParts.month && sameYear;

  if (sameMonth) {
    if (startParts.dayLabel === endParts.dayLabel) {
      return formatDateFR(startDate as Date);
    }
    return `${startParts.dayLabel} → ${endParts.dayLabel} ${endParts.month} ${endParts.year}`;
  }

  if (sameYear) {
    return `${startParts.dayLabel} ${startParts.month} → ${endParts.dayLabel} ${endParts.month} ${endParts.year}`;
  }

  return `${startParts.dayLabel} ${startParts.month} ${startParts.year} → ${endParts.dayLabel} ${endParts.month} ${endParts.year}`;
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
