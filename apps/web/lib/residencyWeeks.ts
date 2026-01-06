// apps/web/lib/residencyWeeks.ts
import { addDays, formatDate, parseDateUTC } from '@/lib/residencyWeeksUtils';

export type ResidencyWeekType = 'CALM' | 'BUSY';

export type ResidencyWeekSeed = {
  start_date_sun: string;
  end_date_sun: string;
  type: ResidencyWeekType;
  performances_count: 2 | 4;
  fee_cents: 15000 | 30000;
};

type VacationWindow = { start: string; end: string };

const VACATION_WINDOWS: VacationWindow[] = [
  // Fenetres simples (peuvent etre ajustees) : ete + fin d'annee.
  { start: '07-01', end: '08-31' },
  { start: '12-20', end: '01-05' },
];

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && startB < endA;
}

function vacationRangesForYear(year: number): Array<{ start: Date; end: Date }> {
  const ranges: Array<{ start: Date; end: Date }> = [];
  for (const win of VACATION_WINDOWS) {
    const [sm, sd] = win.start.split('-').map(Number);
    const [em, ed] = win.end.split('-').map(Number);
    if (sm > em) {
      // Cross-year window (ex: 12-20 -> 01-05)
      ranges.push({
        start: parseDateUTC(`${year}-${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}`),
        end: parseDateUTC(`${year}-12-31`),
      });
      ranges.push({
        start: parseDateUTC(`${year + 1}-${String(em).padStart(2, '0')}-${String(ed).padStart(2, '0')}`),
        end: addDays(parseDateUTC(`${year + 1}-${String(em).padStart(2, '0')}-${String(ed).padStart(2, '0')}`), 1),
      });
    } else {
      const start = parseDateUTC(`${year}-${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}`);
      const end = addDays(parseDateUTC(`${year}-${String(em).padStart(2, '0')}-${String(ed).padStart(2, '0')}`), 1);
      ranges.push({ start, end });
    }
  }
  return ranges;
}

function isVacationWeek(start: Date, end: Date): boolean {
  const years = new Set([start.getUTCFullYear(), end.getUTCFullYear()]);
  for (const y of years) {
    const ranges = vacationRangesForYear(y);
    for (const r of ranges) {
      if (rangesOverlap(start, end, r.start, r.end)) return true;
    }
  }
  return false;
}

function toSunday(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

function toNextSunday(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const add = (7 - day) % 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d;
}

export function generateResidencyWeeks(startDate: string, endDate: string): ResidencyWeekSeed[] {
  const start = toSunday(parseDateUTC(startDate));
  const end = toNextSunday(parseDateUTC(endDate));
  if (end < start) return [];

  const weeks: ResidencyWeekSeed[] = [];
  let cursor = start;
  while (cursor < end) {
    const weekStart = cursor;
    const weekEnd = addDays(weekStart, 7);
    const busy = isVacationWeek(weekStart, weekEnd);
    const type: ResidencyWeekType = busy ? 'BUSY' : 'CALM';
    weeks.push({
      start_date_sun: formatDate(weekStart),
      end_date_sun: formatDate(weekEnd),
      type,
      performances_count: busy ? 4 : 2,
      fee_cents: busy ? 30000 : 15000,
    });
    cursor = weekEnd;
  }
  return weeks;
}
