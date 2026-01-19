import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { ITEM_STATUS } from '@/lib/programming/types';

type GenerateWeeksResult = {
  ok: boolean;
  error?: string;
  details?: string;
  createdCount?: number;
};

function parseDateUTC(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function normalizeDateInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function formatDateUTC(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toSunday(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

function toNextSunday(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const add = (7 - day) % 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d;
}

function overlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: programId } = await params;
  let body: { start_date?: string; end_date?: string } = {};

  try {
    body = (await req.json()) as { start_date?: string; end_date?: string };
  } catch (error) {
    return NextResponse.json<GenerateWeeksResult>(
      { ok: false, error: 'Payload invalide.', details: 'JSON attendu.' },
      { status: 400 }
    );
  }

  const startInput = String(body.start_date ?? '').trim();
  const endInput = String(body.end_date ?? '').trim();
  if (!startInput || !endInput) {
    return NextResponse.json<GenerateWeeksResult>(
      { ok: false, error: 'Dates requises.', details: 'Merci de renseigner un debut et une fin.' },
      { status: 400 }
    );
  }

  const startDate = normalizeDateInput(startInput);
  const endDate = normalizeDateInput(endInput);
  if (!startDate || !endDate || !isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
    return NextResponse.json<GenerateWeeksResult>(
      { ok: false, error: 'Dates invalides.', details: 'Format attendu: YYYY-MM-DD ou DD/MM/YYYY.' },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) {
    return NextResponse.json<GenerateWeeksResult>({ ok: false, error: 'Non authentifie.' }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json<GenerateWeeksResult>(
      { ok: false, error: 'Acces refuse.', details: 'Admin requis.' },
      { status: 403 }
    );
  }

  const { data: program } = await supabase
    .from('programming_programs')
    .select('program_type')
    .eq('id', programId)
    .maybeSingle();
  if (program?.program_type !== 'WEEKLY_RESIDENCY') {
    return NextResponse.json<GenerateWeeksResult>(
      { ok: false, error: 'Type de programmation invalide.' },
      { status: 400 }
    );
  }

  const start = toSunday(parseDateUTC(startDate));
  const end = toNextSunday(parseDateUTC(endDate));
  if (end < start) {
    return NextResponse.json<GenerateWeeksResult>(
      { ok: false, error: 'Periode invalide.', details: 'La fin doit etre apres le debut.' },
      { status: 400 }
    );
  }

  const { data: items } = await supabase
    .from('programming_items')
    .select('item_type, start_date, end_date, status')
    .eq('program_id', programId);

  const existingItems = items ?? [];
  const newItems: Array<{ start: Date; end: Date }> = [];
  let cursor = start;
  while (cursor < end) {
    const weekStart = cursor;
    const weekEnd = addDays(weekStart, 7);
    newItems.push({ start: weekStart, end: weekEnd });
    cursor = weekEnd;
  }

  const blocked = newItems.some((range) =>
    existingItems.some((item) => {
      if (item.status === ITEM_STATUS.CANCELLED) return false;
      const itemStart = parseDateUTC(item.start_date);
      const itemEnd = item.item_type === 'DATE' ? addDays(itemStart, 1) : parseDateUTC(item.end_date);
      return overlap(range.start, range.end, itemStart, itemEnd);
    })
  );

  if (blocked) {
    return NextResponse.json<GenerateWeeksResult>(
      {
        ok: false,
        error: 'Chevauchement detecte.',
        details: 'Une ou plusieurs semaines existent deja sur cette periode.',
      },
      { status: 409 }
    );
  }

  const payload = newItems.map((range) => ({
    program_id: programId,
    item_type: 'WEEK',
    start_date: formatDateUTC(range.start),
    end_date: formatDateUTC(range.end),
    status: ITEM_STATUS.OPEN,
    meta_json: { week_type: 'CALM' },
  }));

  const { error } = await supabase.from('programming_items').insert(payload);
  if (error) {
    console.error('[programming/calendar] GENERATE_WEEKS_FAILED', {
      programId,
      startDate,
      endDate,
      error,
    });
    const details = error?.details || error?.hint || error?.message || 'Erreur inconnue';
    return NextResponse.json<GenerateWeeksResult>(
      { ok: false, error: 'Generation impossible.', details },
      { status: 500 }
    );
  }

  return NextResponse.json<GenerateWeeksResult>({ ok: true, createdCount: payload.length });
}
