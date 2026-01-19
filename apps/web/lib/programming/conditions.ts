type ConditionsPayload = {
  fee_cents?: number | null;
  currency?: string | null;
  is_net?: boolean | null;
  performances_count?: number | null;
  lodging_included?: boolean | null;
  meals_included?: boolean | null;
  notes?: string | null;
};

type ProgramLike = {
  conditions_json?: Record<string, any> | null;
};

type ItemLike = {
  meta_json?: Record<string, any> | null;
};

const DEFAULT_CONDITIONS: ConditionsPayload = {
  currency: 'EUR',
  is_net: true,
  performances_count: 0,
  lodging_included: false,
  meals_included: false,
  notes: '',
};

function coerceBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function coerceNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

function coerceString(value: unknown, fallback: string) {
  if (typeof value === 'string') return value;
  return fallback;
}

function extractProgramConditions(program?: ProgramLike | null): ConditionsPayload {
  const source = program?.conditions_json ?? {};
  const base = (source.conditions_override ??
    source.conditions_default ??
    source.conditions ??
    source) as Record<string, any>;
  return {
    fee_cents: typeof base.fee_cents === 'number' ? base.fee_cents : DEFAULT_CONDITIONS.fee_cents,
    currency: coerceString(base.currency, DEFAULT_CONDITIONS.currency ?? 'EUR'),
    is_net: coerceBoolean(base.is_net, DEFAULT_CONDITIONS.is_net ?? true),
    performances_count: coerceNumber(base.performances_count, DEFAULT_CONDITIONS.performances_count ?? 0),
    lodging_included: coerceBoolean(base.lodging_included, DEFAULT_CONDITIONS.lodging_included ?? false),
    meals_included: coerceBoolean(base.meals_included, DEFAULT_CONDITIONS.meals_included ?? false),
    notes: coerceString(base.notes, DEFAULT_CONDITIONS.notes ?? ''),
  };
}

function extractOverride(item?: ItemLike | null): ConditionsPayload {
  const override = (item?.meta_json?.conditions_override ?? {}) as Record<string, any>;
  return {
    fee_cents: typeof override.fee_cents === 'number' ? override.fee_cents : undefined,
    currency: override.currency,
    is_net: override.is_net,
    performances_count: override.performances_count,
    lodging_included: override.lodging_included,
    meals_included: override.meals_included,
    notes: override.notes,
  };
}

export function getEffectiveSlotConditions({
  program,
  item,
}: {
  program?: ProgramLike | null;
  item?: ItemLike | null;
}) {
  const base = extractProgramConditions(program);
  const override = extractOverride(item);
  return {
    fee_cents: override.fee_cents ?? base.fee_cents ?? null,
    currency: override.currency ?? base.currency ?? DEFAULT_CONDITIONS.currency ?? 'EUR',
    is_net: override.is_net ?? base.is_net ?? DEFAULT_CONDITIONS.is_net ?? true,
    performances_count: override.performances_count ?? base.performances_count ?? 0,
    lodging_included: override.lodging_included ?? base.lodging_included ?? false,
    meals_included: override.meals_included ?? base.meals_included ?? false,
    notes: override.notes ?? base.notes ?? '',
  } satisfies ConditionsPayload;
}

export function hasSlotOverride(item?: ItemLike | null) {
  return Boolean(item?.meta_json?.conditions_override);
}

export function formatConditionsSummary(conditions: ConditionsPayload) {
  const parts: string[] = [];
  if (typeof conditions.fee_cents === 'number') {
    const amount = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: conditions.currency ?? 'EUR',
      maximumFractionDigits: 0,
    }).format(conditions.fee_cents / 100);
    const suffix = conditions.is_net === false ? 'brut' : 'net';
    parts.push(`${amount} ${suffix}`);
  }
  if (conditions.performances_count) {
    parts.push(`${conditions.performances_count} prestation${conditions.performances_count > 1 ? 's' : ''}`);
  }
  if (conditions.lodging_included || conditions.meals_included) {
    const extras = [];
    if (conditions.lodging_included) extras.push('logement');
    if (conditions.meals_included) extras.push('repas');
    parts.push(extras.join(' / '));
  }
  if (parts.length === 0) return 'Conditions à préciser';
  return parts.join(' • ');
}

export function formatFeeLabel(conditions: ConditionsPayload) {
  if (typeof conditions.fee_cents !== 'number') return 'Cachet à définir';
  const amount = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: conditions.currency ?? 'EUR',
    maximumFractionDigits: 0,
  }).format(conditions.fee_cents / 100);
  const suffix = conditions.is_net === false ? 'brut' : 'net';
  return `${amount} (${suffix})`;
}
