export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

type StatusMap = Record<string, { label: string; tone: StatusTone }>;

const PROGRAM_STATUS_MAP: StatusMap = {
  DRAFT: { label: 'Brouillon', tone: 'neutral' },
  ACTIVE: { label: 'Active', tone: 'success' },
  ENDED: { label: 'Terminée', tone: 'neutral' },
  ARCHIVED: { label: 'Archivée', tone: 'neutral' },
};

const SLOT_STATUS_MAP: StatusMap = {
  OPEN: { label: 'À pourvoir', tone: 'warning' },
  NEGOTIATING: { label: 'En discussion', tone: 'info' },
  CONFIRMED: { label: 'Confirmé', tone: 'success' },
  CLOSED: { label: 'Fermé', tone: 'neutral' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
};

const APPLICATION_STATUS_MAP: StatusMap = {
  NEW: { label: 'Nouvelle', tone: 'warning' },
  NEGOTIATING: { label: 'En discussion', tone: 'info' },
  REJECTED: { label: 'Refusée', tone: 'danger' },
  CONFIRMED: { label: 'Confirmée', tone: 'success' },
  APPLIED: { label: 'Nouvelle', tone: 'warning' },
  PENDING: { label: 'Nouvelle', tone: 'warning' },
  ACCEPTED: { label: 'Confirmée', tone: 'success' },
};

function normalizeKey(value?: string | null) {
  if (!value) return '';
  return value.replace(/[\s-]+/g, '_').toUpperCase();
}

export function normalizeProgrammingStatus(value?: string | null) {
  const key = normalizeKey(value);
  if (['ACTIVE', 'PUBLISHED'].includes(key)) return 'ACTIVE';
  if (['ENDED', 'TERMINATED', 'FINISHED', 'COMPLETED'].includes(key)) return 'ENDED';
  if (['ARCHIVED', 'ARCHIVE'].includes(key)) return 'ARCHIVED';
  if (['DRAFT'].includes(key)) return 'DRAFT';
  return key || 'DRAFT';
}

export function getProgrammingStatusLabel(value?: string | null) {
  const key = normalizeProgrammingStatus(value);
  return PROGRAM_STATUS_MAP[key]?.label ?? 'Brouillon';
}

export function getProgrammingStatusTone(value?: string | null): StatusTone {
  const key = normalizeProgrammingStatus(value);
  return PROGRAM_STATUS_MAP[key]?.tone ?? 'neutral';
}

export function getSlotStatusLabel(value?: string | null) {
  const key = normalizeKey(value);
  return SLOT_STATUS_MAP[key]?.label ?? 'À pourvoir';
}

export function getSlotStatusTone(value?: string | null): StatusTone {
  const key = normalizeKey(value);
  return SLOT_STATUS_MAP[key]?.tone ?? 'neutral';
}

export function getApplicationStatusLabel(value?: string | null) {
  const key = normalizeKey(value);
  return APPLICATION_STATUS_MAP[key]?.label ?? 'Nouvelle';
}

export function getApplicationStatusTone(value?: string | null): StatusTone {
  const key = normalizeKey(value);
  return APPLICATION_STATUS_MAP[key]?.tone ?? 'neutral';
}
