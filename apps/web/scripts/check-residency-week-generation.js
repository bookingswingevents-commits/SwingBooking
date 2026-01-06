#!/usr/bin/env node
// Sanity check for residency week generation logic.

function parseDateUTC(value) {
  const d = new Date(`${value}T00:00:00Z`);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
  return d;
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function toSunday(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

function toNextSunday(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const add = (7 - day) % 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d;
}

function generateWeeks(startDate, endDate) {
  const start = toSunday(parseDateUTC(startDate));
  const end = toNextSunday(parseDateUTC(endDate));
  const weeks = [];
  let cursor = start;
  while (cursor < end) {
    const weekStart = cursor;
    const weekEnd = addDays(weekStart, 7);
    weeks.push({
      start_date_sun: formatDate(weekStart),
      end_date_sun: formatDate(weekEnd),
    });
    cursor = weekEnd;
  }
  return weeks;
}

const weeks = generateWeeks('2025-01-05', '2025-01-19');
if (weeks.length !== 2) {
  console.error('Expected 2 weeks, got', weeks.length);
  process.exit(1);
}

console.log('Week generation OK:', weeks);
