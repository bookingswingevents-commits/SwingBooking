// apps/web/lib/residencyWeeksUtils.ts
export function parseDateUTC(value: string): Date {
  const d = new Date(`${value}T00:00:00Z`);
  if (isNaN(d.getTime())) throw new Error(`Date invalide: ${value}`);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
