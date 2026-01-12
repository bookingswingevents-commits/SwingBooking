const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmé',
  CONFIRMED_FR: 'Confirmé',
  PENDING: 'En attente',
  DECLINED: 'Refusé',
  OPEN: 'Ouvert',
  CANCELLED: 'Annulé',
  ACCEPTED: 'Accepté',
  REJECTED: 'Refusé',
  EMPTY: 'Aucun artiste',
};

const ERROR_LABELS: Record<string, string> = {
  NO_USER: 'Connexion requise.',
  NOT_ADMIN: 'Accès réservé aux administrateurs.',
  INVALID_ID: 'Identifiant invalide.',
  INVALID_DATE: 'Date invalide.',
  INVALID_EMAIL: 'Email invalide.',
  INVALID_NAME: 'Nom invalide.',
  INVALID_FEE: 'Montant invalide.',
  MISSING_ID: 'Identifiant manquant.',
  MISSING_RESIDENCY_ID: 'Programmation manquante.',
  MISSING_REQUEST_ID: 'Demande manquante.',
  SERVER_ERROR: 'Erreur serveur.',
};

export function labelForStatus(code?: string | null) {
  if (!code) return '—';
  return STATUS_LABELS[code] ?? STATUS_LABELS[code.toUpperCase()] ?? code;
}

export function labelForError(codeOrMessage?: string | null) {
  if (!codeOrMessage) return 'Erreur inconnue.';
  return ERROR_LABELS[codeOrMessage] ?? codeOrMessage;
}
