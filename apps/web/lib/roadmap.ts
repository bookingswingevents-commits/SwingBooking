export type RoadmapEntry = { label: string; value: string };
export type RoadmapScheduleEntry = { day: string; time: string; place: string; notes?: string };

export type RemunerationOption = { label: string; amount_cents?: number };

export type ConditionsJson = {
  remuneration?: {
    mode?: 'PER_DATE' | 'PER_WEEK';
    currency?: string;
    is_net?: boolean;
    per_date?: {
      amount_cents?: number;
      artist_choice?: boolean;
      options?: RemunerationOption[];
    };
    per_week?: {
      calm?: { fee_cents?: number; performances_count?: number };
      peak?: { fee_cents?: number; performances_count?: number };
    };
  };
  lodging?: {
    included?: boolean;
    companion_included?: boolean;
    details?: string;
  };
  meals?: {
    included?: boolean;
    details?: string;
  };
  defraiement?: {
    details?: string;
  };
  locations?: {
    items?: RoadmapEntry[];
  };
  contacts?: {
    items?: RoadmapEntry[];
  };
  access?: {
    items?: RoadmapEntry[];
  };
  logistics?: {
    items?: RoadmapEntry[];
  };
  planning?: {
    items?: RoadmapScheduleEntry[];
  };
  notes?: string;
};

export type RoadmapOverrides = {
  notes?: string;
};

export type RoadmapSection = {
  id: string;
  title: string;
  kind: 'list' | 'schedule' | 'text';
  items?: RoadmapEntry[];
  schedule?: RoadmapScheduleEntry[];
  text?: string;
};

export type RoadmapData = {
  title: string;
  subtitle?: string;
  intro?: string;
  sections: RoadmapSection[];
  notes?: string;
};

export type RoadmapContext = {
  residencyName: string;
  contextLabel?: string;
  programType?: 'MULTI_DATES' | 'WEEKLY_RESIDENCY';
  weekType?: 'CALM' | 'PEAK' | null;
  conditions: ConditionsJson;
  overrides?: RoadmapOverrides | null;
};

export function formatMoney(cents?: number, currency = 'EUR') {
  if (typeof cents !== 'number') return '';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);
}

function pushListSection(
  sections: RoadmapSection[],
  id: string,
  title: string,
  items?: RoadmapEntry[]
) {
  if (!items || items.length === 0) return;
  sections.push({ id, title, kind: 'list', items });
}

function normalizeEntry(value: RoadmapEntry[]) {
  return value
    .map((it) => ({ label: (it.label || '').trim(), value: (it.value || '').trim() }))
    .filter((it) => it.label || it.value);
}

export function buildRoadmapData(context: RoadmapContext): RoadmapData {
  const { residencyName, contextLabel, conditions, overrides, weekType } = context;
  const sections: RoadmapSection[] = [];

  const remuneration = conditions.remuneration;
  if (remuneration?.mode === 'PER_DATE') {
    const items: RoadmapEntry[] = [];
    const currency = remuneration.currency ?? 'EUR';
    const suffix = remuneration.is_net === false ? 'brut' : 'net';
    if (remuneration.per_date?.artist_choice && remuneration.per_date?.options?.length) {
      remuneration.per_date.options.forEach((opt) => {
        if (!opt.label) return;
        items.push({
          label: opt.label,
          value: opt.amount_cents
            ? `${formatMoney(opt.amount_cents, currency)} ${suffix}`
            : 'Montant a definir',
        });
      });
    } else if (typeof remuneration.per_date?.amount_cents === 'number') {
      items.push({
        label: 'Cachet par date',
        value: `${formatMoney(remuneration.per_date.amount_cents, currency)} ${suffix}`,
      });
    }
    pushListSection(sections, 'remuneration', 'Remuneration', items);
  }

  if (remuneration?.mode === 'PER_WEEK') {
    const items: RoadmapEntry[] = [];
    const currency = remuneration.currency ?? 'EUR';
    const suffix = remuneration.is_net === false ? 'brut' : 'net';
    const calm = remuneration.per_week?.calm;
    const peak = remuneration.per_week?.peak;
    const formatWeek = (label: string, data?: { fee_cents?: number; performances_count?: number }) => {
      if (!data) return;
      const fee = formatMoney(data.fee_cents, currency);
      const perfs = typeof data.performances_count === 'number' ? `${data.performances_count} prestation(s)` : '';
      const parts = [perfs, fee ? `${fee} ${suffix}` : ''].filter(Boolean).join(' • ');
      if (parts) items.push({ label, value: parts });
    };
    if (weekType === 'CALM') {
      formatWeek('Semaine calme', calm);
    } else if (weekType === 'PEAK') {
      formatWeek('Semaine forte', peak);
    } else {
      formatWeek('Semaine calme', calm);
      formatWeek('Semaine forte', peak);
    }
    pushListSection(sections, 'remuneration', 'Remuneration', items);
  }

  if (conditions.lodging) {
    const items: RoadmapEntry[] = [];
    if (typeof conditions.lodging.included === 'boolean') {
      items.push({
        label: 'Logement',
        value: conditions.lodging.included ? 'Inclus' : 'Non inclus',
      });
    }
    if (typeof conditions.lodging.companion_included === 'boolean') {
      items.push({
        label: 'Accompagnant',
        value: conditions.lodging.companion_included ? 'Inclus' : 'Non inclus',
      });
    }
    if (conditions.lodging.details?.trim()) {
      items.push({ label: 'Details', value: conditions.lodging.details.trim() });
    }
    pushListSection(sections, 'lodging', 'Logement', items);
  }

  if (conditions.meals) {
    const items: RoadmapEntry[] = [];
    if (typeof conditions.meals.included === 'boolean') {
      items.push({
        label: 'Repas',
        value: conditions.meals.included ? 'Inclus' : 'Non inclus',
      });
    }
    if (conditions.meals.details?.trim()) {
      items.push({ label: 'Details', value: conditions.meals.details.trim() });
    }
    pushListSection(sections, 'meals', 'Repas', items);
  }

  if (conditions.defraiement?.details?.trim()) {
    sections.push({
      id: 'defraiement',
      title: 'Defraiement',
      kind: 'text',
      text: conditions.defraiement.details.trim(),
    });
  }

  pushListSection(
    sections,
    'locations',
    'Lieux',
    normalizeEntry(conditions.locations?.items ?? [])
  );
  pushListSection(
    sections,
    'contacts',
    'Contacts',
    normalizeEntry(conditions.contacts?.items ?? [])
  );
  pushListSection(
    sections,
    'access',
    'Acces',
    normalizeEntry(conditions.access?.items ?? [])
  );
  pushListSection(
    sections,
    'logistics',
    'Logistique',
    normalizeEntry(conditions.logistics?.items ?? [])
  );

  const schedule = (conditions.planning?.items ?? []).filter(
    (it) => it.day || it.time || it.place || it.notes
  );
  if (schedule.length > 0) {
    sections.push({ id: 'planning', title: 'Planning', kind: 'schedule', schedule });
  }

  const notes = overrides?.notes?.trim() || conditions.notes?.trim() || undefined;

  return {
    title: 'Feuille de route',
    subtitle: [residencyName, contextLabel].filter(Boolean).join(' • '),
    sections,
    notes,
  };
}

export function roadmapToLines(data: RoadmapData): string[] {
  const lines: string[] = [];
  lines.push(data.title);
  if (data.subtitle) lines.push(data.subtitle);
  lines.push('');
  if (data.intro) {
    lines.push(data.intro);
    lines.push('');
  }

  data.sections.forEach((section) => {
    lines.push(section.title.toUpperCase());
    if (section.kind === 'list') {
      (section.items ?? []).forEach((it) => {
        const label = it.label ? `${it.label}: ` : '';
        lines.push(`- ${label}${it.value}`.trim());
      });
    }
    if (section.kind === 'text' && section.text) {
      lines.push(section.text);
    }
    if (section.kind === 'schedule') {
      (section.schedule ?? []).forEach((it) => {
        const base = [it.day, it.time].filter(Boolean).join(' ');
        const place = it.place ? ` - ${it.place}` : '';
        lines.push(`- ${base}${place}`.trim());
        if (it.notes) lines.push(`  ${it.notes}`);
      });
    }
    lines.push('');
  });

  if (data.notes) {
    lines.push('NOTES');
    lines.push(data.notes);
  }

  return lines.filter((line, idx, arr) => {
    if (line !== '') return true;
    return idx === 0 || arr[idx - 1] !== '';
  });
}
