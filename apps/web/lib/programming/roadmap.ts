import type {
  ProgrammingProgram,
  ProgrammingItem,
  ProgrammingBooking,
  RoadmapOutput,
  RoadmapEntry,
  RoadmapScheduleEntry,
} from './types';

type ConditionsJson = Record<string, any>;

type RoadmapInput = {
  program: ProgrammingProgram;
  item: ProgrammingItem;
  booking?: ProgrammingBooking | null;
};

const emptyOutput: RoadmapOutput = {
  schedule: [],
  fees: [],
  venues: [],
  lodging: [],
  meals: [],
  access: [],
  logistics: [],
  contacts: [],
};

function formatMoney(cents?: number, currency = 'EUR') {
  if (typeof cents !== 'number') return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);
}

function normalizeEntries(items?: any[]): RoadmapEntry[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => ({ label: String(it?.label ?? '').trim(), value: String(it?.value ?? '').trim() }))
    .filter((it) => it.label || it.value);
}

function normalizeSchedule(items?: any[]): RoadmapScheduleEntry[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => ({
      date: String(it?.date ?? '').trim(),
      time: it?.time ? String(it.time).trim() : undefined,
      place: it?.place ? String(it.place).trim() : undefined,
      notes: it?.notes ? String(it.notes).trim() : undefined,
    }))
    .filter((it) => it.date || it.time || it.place || it.notes);
}

function buildFees(
  program: ProgrammingProgram,
  item: ProgrammingItem,
  conditions: ConditionsJson,
  booking?: ProgrammingBooking | null
): RoadmapEntry[] {
  const remuneration = conditions?.remuneration ?? {};
  const currency = remuneration.currency ?? 'EUR';
  const suffix = remuneration.is_net === false ? 'brut' : 'net';
  const entries: RoadmapEntry[] = [];

  if (program.program_type === 'MULTI_DATES') {
    const perDate = remuneration.per_date ?? {};
    if (booking?.option?.label) {
      const amount =
        typeof booking.option.amount_cents === 'number'
          ? formatMoney(booking.option.amount_cents, currency)
          : '—';
      entries.push({
        label: 'Option artiste',
        value: `${booking.option.label} • ${amount} (${suffix})`,
      });
    } else if (typeof perDate.amount_cents === 'number') {
      entries.push({
        label: 'Cachet par date',
        value: `${formatMoney(perDate.amount_cents, currency)} (${suffix})`,
      });
    }
    return entries;
  }

  const weekType = String(item.metadata_json?.week_type ?? '').toUpperCase();
  const perWeek = remuneration.per_week ?? {};
  if (weekType === 'CALM' || weekType === 'PEAK') {
    const key = weekType === 'CALM' ? 'calm' : 'peak';
    const data = perWeek?.[key] ?? {};
    const perfs = data.performances_count ? `${data.performances_count} prestation(s)` : '—';
    const fee = formatMoney(data.fee_cents, currency);
    entries.push({
      label: weekType === 'CALM' ? 'Semaine calme' : 'Semaine forte',
      value: `${perfs} • ${fee} (${suffix})`,
    });
    return entries;
  }

  if (perWeek?.calm) {
    entries.push({
      label: 'Semaine calme',
      value: `${perWeek.calm.performances_count ?? '—'} prestation(s) • ${formatMoney(
        perWeek.calm.fee_cents,
        currency
      )} (${suffix})`,
    });
  }
  if (perWeek?.peak) {
    entries.push({
      label: 'Semaine forte',
      value: `${perWeek.peak.performances_count ?? '—'} prestation(s) • ${formatMoney(
        perWeek.peak.fee_cents,
        currency
      )} (${suffix})`,
    });
  }
  return entries;
}

function buildLodging(conditions: ConditionsJson): RoadmapEntry[] {
  const lodging = conditions?.lodging ?? {};
  const items = normalizeEntries(lodging.items ?? []);
  if (typeof lodging.included === 'boolean') {
    items.unshift({ label: 'Logement', value: lodging.included ? 'Inclus' : 'Non inclus' });
  }
  if (typeof lodging.companion_included === 'boolean') {
    items.push({
      label: 'Accompagnant',
      value: lodging.companion_included ? 'Inclus' : 'Non inclus',
    });
  }
  if (lodging.details) {
    items.push({ label: 'Details', value: String(lodging.details) });
  }
  return items;
}

function buildMeals(conditions: ConditionsJson): RoadmapEntry[] {
  const meals = conditions?.meals ?? {};
  const items = normalizeEntries(meals.items ?? []);
  if (typeof meals.included === 'boolean') {
    items.unshift({ label: 'Repas', value: meals.included ? 'Inclus' : 'Non inclus' });
  }
  if (meals.details) {
    items.push({ label: 'Details', value: String(meals.details) });
  }
  return items;
}

function buildSchedule(program: ProgrammingProgram, item: ProgrammingItem): RoadmapScheduleEntry[] {
  const schedule = normalizeSchedule(item.metadata_json?.schedule ?? []);
  if (schedule.length > 0) return schedule;

  if (program.program_type === 'MULTI_DATES') {
    return [{ date: item.start_date }];
  }

  return [
    {
      date: `${item.start_date} → ${item.end_date}`,
      notes: 'Semaine complete',
    },
  ];
}

export function generateRoadmap(input: RoadmapInput): RoadmapOutput {
  const { program, item, booking } = input;
  const conditions = (booking?.conditions_snapshot_json ?? program.conditions_json ?? {}) as ConditionsJson;
  const itemMeta = item.metadata_json ?? {};
  const venues = normalizeEntries([...(conditions.venues?.items ?? []), ...(itemMeta.venues ?? [])]);
  const access = normalizeEntries([...(conditions.access?.items ?? []), ...(itemMeta.access ?? [])]);
  const logistics = normalizeEntries([
    ...(conditions.logistics?.items ?? []),
    ...(itemMeta.logistics ?? []),
  ]);
  const contacts = normalizeEntries([
    ...(conditions.contacts?.items ?? []),
    ...(itemMeta.contacts ?? []),
  ]);

  return {
    ...emptyOutput,
    schedule: buildSchedule(program, item),
    fees: buildFees(program, item, conditions, booking),
    venues: venues.length > 0 ? venues : normalizeEntries(conditions.locations?.items ?? []),
    lodging: buildLodging(conditions),
    meals: buildMeals(conditions),
    access,
    logistics,
    contacts,
  };
}
