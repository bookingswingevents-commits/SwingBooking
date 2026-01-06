// apps/web/lib/event-formats.ts
// Source de vérité des formats + helpers d'affichage

export type EventFormat =
  | 'after_work_live'
  | 'afterski_live'
  | 'apero_concert'
  | 'blind_test_live'
  | 'brunch_musicale'
  | 'diner_chic'
  | 'dj_live_elite'
  | 'garden_party'
  | 'jazzy_lounge'
  | 'karaoke_live'
  | 'rooftop_sunset'
  | 'soiree_dansante'
  | 'soiree_premium'
  | 'swing_machine'
  | 'vin_d_honneur';

const MAP: { value: EventFormat; label: string }[] = [
  { value: 'after_work_live',   label: 'After work live' },
  { value: 'afterski_live',     label: 'Afterski live' },
  { value: 'apero_concert',     label: 'Apéro concert' },
  { value: 'blind_test_live',   label: 'Blind test live' },
  { value: 'brunch_musicale',   label: 'Brunch musicale' },
  { value: 'diner_chic',        label: 'Dîner chic' },
  { value: 'dj_live_elite',     label: 'Dj live elite' },
  { value: 'garden_party',      label: 'Garden party' },
  { value: 'jazzy_lounge',      label: 'Jazzy lounge' },
  { value: 'karaoke_live',      label: 'Karaoke live' },
  { value: 'rooftop_sunset',    label: 'Rooftop sunset' },
  { value: 'soiree_dansante',   label: 'Soirée dansante' },
  { value: 'soiree_premium',    label: 'Soirée premium' },
  { value: 'swing_machine',     label: 'Swing machine' },
  { value: 'vin_d_honneur',     label: "Vin d'honneur" },
];

/** Options prêtes pour le <select> */
export function eventFormatOptions() {
  return MAP;
}

/** Affiche le libellé FR à partir du slug */
export function labelForEventFormat(slug?: string | null): string {
  if (!slug) return '—';
  const hit = MAP.find(f => f.value === slug);
  if (hit) return hit.label;

  // Compat minimale pour vieilles données (sans polluer les labels)
  if (slug === 'dj_night') return 'Dj live elite';
  if (slug === 'brunch_musical') return 'Brunch musicale';

  // Fallback lisible si slug inconnu
  return String(slug)
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Liste brute si besoin ailleurs */
export const EVENT_FORMATS = MAP;
