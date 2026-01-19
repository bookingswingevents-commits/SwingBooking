import Link from 'next/link';
import { redirect } from 'next/navigation';
import WeeklyGeneratorForm from './weekly-generator-form';
import StatusBadge from '@/components/programming/StatusBadge';
import { formatRangeFR } from '@/lib/date';
import { formatConditionsSummary, getEffectiveSlotConditions } from '@/lib/programming/conditions';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { ITEM_STATUS } from '@/lib/programming/types';
import { getSlotStatusLabel, getSlotStatusTone } from '@/lib/programming/status';

export const dynamic = 'force-dynamic';

type CalendarPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; success?: string }>;
};

type ProgramRow = {
  id: string;
  title: string;
  program_type: 'MULTI_DATES' | 'WEEKLY_RESIDENCY';
};

type ItemRow = {
  id: string;
  item_type: 'DATE' | 'WEEK';
  start_date: string;
  end_date: string;
  status: string;
  meta_json: Record<string, any>;
};

function parseDateUTC(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function overlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

function labelProgramType(value?: string | null) {
  return value === 'WEEKLY_RESIDENCY' ? 'Résidence hebdomadaire' : 'Dates multiples';
}

async function loadItems(programId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('programming_items')
    .select('id, item_type, start_date, end_date, status, meta_json')
    .eq('program_id', programId)
    .order('start_date', { ascending: true });
  return (data ?? []) as ItemRow[];
}

async function addDateAction(formData: FormData) {
  'use server';
  const programId = String(formData.get('program_id') ?? '').trim();
  const date = String(formData.get('date') ?? '').trim();
  if (!programId || !date) return;

  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) redirect('/admin/programming');

  const { data: program } = await supabase
    .from('programming_programs')
    .select('program_type')
    .eq('id', programId)
    .maybeSingle();
  if (program?.program_type !== 'MULTI_DATES') {
    redirect(`/admin/programming/${programId}/calendar?error=Type%20de%20programmation%20invalide`);
  }

  const items = await loadItems(programId);
  const newStart = parseDateUTC(date);
  const newEnd = addDays(newStart, 1);

  const blocked = items.some((item) => {
    if (item.status === ITEM_STATUS.CANCELLED) return false;
    const itemStart = parseDateUTC(item.start_date);
    const itemEnd = item.item_type === 'DATE' ? addDays(itemStart, 1) : parseDateUTC(item.end_date);
    return overlap(newStart, newEnd, itemStart, itemEnd);
  });

  if (blocked) {
    redirect(`/admin/programming/${programId}/calendar?error=Chevauchement%20detecte`);
  }

  const { error } = await supabase.from('programming_items').insert({
    program_id: programId,
    item_type: 'DATE',
    start_date: date,
    end_date: date,
    status: ITEM_STATUS.OPEN,
    meta_json: {},
  });

  if (error) {
    redirect(`/admin/programming/${programId}/calendar?error=Impossible%20d%27ajouter%20la%20date`);
  }

  redirect(`/admin/programming/${programId}/calendar?success=Date%20ajoutee`);
}

async function removeItemAction(formData: FormData) {
  'use server';
  const programId = String(formData.get('program_id') ?? '').trim();
  const itemId = String(formData.get('item_id') ?? '').trim();
  if (!programId || !itemId) return;

  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) redirect('/admin/programming');

  const { error } = await supabase
    .from('programming_items')
    .delete()
    .eq('id', itemId)
    .eq('program_id', programId);

  if (error) {
    redirect(`/admin/programming/${programId}/calendar?error=Suppression%20impossible`);
  }

  redirect(`/admin/programming/${programId}/calendar?success=Element%20supprime`);
}

export default async function AdminProgrammingCalendarPage({ params, searchParams }: CalendarPageProps) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Créneaux</h1>
        <p className="text-red-600">Accès refusé (admin requis).</p>
        <Link href="/admin/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const { data: program, error } = await supabase
    .from('programming_programs')
    .select('id, title, program_type, conditions_json')
    .eq('id', id)
    .maybeSingle();

  if (error || !program) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Créneaux</h1>
        <p className="text-slate-500">Programmation introuvable.</p>
        <Link href="/admin/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const { data: items } = await supabase
    .from('programming_items')
    .select('id, item_type, start_date, end_date, status, meta_json')
    .eq('program_id', program.id)
    .order('start_date', { ascending: true });
  const filteredItems = (items ?? []).filter((item) =>
    program.program_type === 'MULTI_DATES' ? item.item_type === 'DATE' : item.item_type === 'WEEK'
  );

  const itemIds = filteredItems.map((item) => item.id);
  const bookingByItem = new Map<string, { artist?: string | null }>();
  const applicationCountByItem = new Map<string, number>();

  if (itemIds.length > 0) {
    try {
      const { data: bookings } = await supabase
        .from('programming_bookings')
        .select('id, item_id, status, artists(stage_name)')
        .in('item_id', itemIds);
      (bookings ?? []).forEach((booking) => {
        const artist = Array.isArray(booking.artists) ? booking.artists[0] : booking.artists;
        bookingByItem.set(booking.item_id, { artist: artist?.stage_name ?? 'Artiste confirmé' });
      });
    } catch {
      bookingByItem.clear();
    }

    try {
      const { data: applications } = await supabase
        .from('programming_applications')
        .select('id, item_id')
        .in('item_id', itemIds);
      (applications ?? []).forEach((application) => {
        applicationCountByItem.set(
          application.item_id,
          (applicationCountByItem.get(application.item_id) ?? 0) + 1
        );
      });
    } catch {
      applicationCountByItem.clear();
    }
  }

  const hasConfirmedArtist = bookingByItem.size > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="space-y-2">
        <Link href={`/admin/programming/${program.id}`} className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold">Créneaux</h1>
        <p className="text-sm text-slate-600">
          {program.title ?? 'Programmation'} • {labelProgramType(program.program_type)}
        </p>
      </header>

      {sp.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm">
          {sp.error}
        </div>
      ) : null}
      {sp.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 text-sm">
          {sp.success}
        </div>
      ) : null}

      {!hasConfirmedArtist ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-600 text-sm">
          Aucun artiste confirmé sur cette programmation.
        </div>
      ) : null}

      {program.program_type === 'MULTI_DATES' ? (
        <section className="rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold">Créneaux</h2>
          <form action={addDateAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="program_id" value={program.id} />
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="date">
                Ajouter une date
              </label>
              <input id="date" name="date" type="date" className="border rounded-lg px-3 py-2" required />
            </div>
            <button className="btn btn-primary" type="submit">
              Ajouter
            </button>
          </form>
          {filteredItems.length === 0 ? (
            <div className="text-sm text-slate-500">
              Aucun créneau pour le moment. Commence par générer ou ajouter des dates.
            </div>
          ) : (
            <div className="rounded-lg border divide-y">
              <div className="hidden md:grid md:grid-cols-[2fr_1fr_1.2fr_0.8fr_1.8fr] gap-3 px-4 py-2 text-xs uppercase tracking-wide text-slate-500">
                <div>Période</div>
                <div>Statut</div>
                <div>Artiste confirmé</div>
                <div>Demandes</div>
                <div>Actions</div>
              </div>
              {filteredItems.map((item) => {
                const periodLabel = formatRangeFR(item.start_date, item.end_date);
                const statusLabel = getSlotStatusLabel(item.status);
                const statusTone = getSlotStatusTone(item.status);
                const booking = bookingByItem.get(item.id);
                const applicationsCount = applicationCountByItem.get(item.id) ?? 0;
                const isConfirmed = Boolean(booking);
                const effectiveConditions = getEffectiveSlotConditions({
                  program: { conditions_json: program.conditions_json ?? {} },
                  item: { meta_json: item.meta_json ?? {} },
                });
                const conditionsLabel = formatConditionsSummary(effectiveConditions);
                return (
                  <div
                    key={item.id}
                    className="grid gap-3 md:grid-cols-[2fr_1fr_1.2fr_0.8fr_1.8fr] items-center px-4 py-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">{periodLabel}</div>
                      <div className="text-xs text-slate-500">{conditionsLabel}</div>
                    </div>
                    <div>
                      <StatusBadge label={statusLabel} tone={statusTone} />
                    </div>
                    <div className="text-slate-600">{booking?.artist ?? '—'}</div>
                    <div className="text-slate-600">{applicationsCount}</div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/admin/programming/items/${item.id}`} className="btn">
                        Modifier les conditions
                      </Link>
                      {isConfirmed ? (
                        <button className="btn" type="button" disabled aria-disabled>
                          Créneau confirmé
                        </button>
                      ) : (
                        <Link href={`/admin/programming/items/${item.id}`} className="btn btn-primary">
                          Confirmer un artiste
                        </Link>
                      )}
                      <form action={removeItemAction}>
                        <input type="hidden" name="program_id" value={program.id} />
                        <input type="hidden" name="item_id" value={item.id} />
                        <button className="btn" type="submit">
                          Supprimer
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-xl border p-4 space-y-4">
          <h2 className="font-semibold">Créneaux</h2>
          <WeeklyGeneratorForm programId={program.id} />

          {filteredItems.length === 0 ? (
            <div className="text-sm text-slate-500">
              Aucun créneau pour le moment. Commence par générer ou ajouter des dates.
            </div>
          ) : (
            <div className="rounded-lg border divide-y">
              <div className="hidden md:grid md:grid-cols-[2fr_1fr_1.2fr_0.8fr_1.8fr] gap-3 px-4 py-2 text-xs uppercase tracking-wide text-slate-500">
                <div>Période</div>
                <div>Statut</div>
                <div>Artiste confirmé</div>
                <div>Demandes</div>
                <div>Actions</div>
              </div>
              {filteredItems.map((item) => {
                const periodLabel = formatRangeFR(item.start_date, item.end_date);
                const statusLabel = getSlotStatusLabel(item.status);
                const statusTone = getSlotStatusTone(item.status);
                const booking = bookingByItem.get(item.id);
                const applicationsCount = applicationCountByItem.get(item.id) ?? 0;
                const isConfirmed = Boolean(booking);
                const effectiveConditions = getEffectiveSlotConditions({
                  program: { conditions_json: program.conditions_json ?? {} },
                  item: { meta_json: item.meta_json ?? {} },
                });
                const conditionsLabel = formatConditionsSummary(effectiveConditions);
                return (
                  <div
                    key={item.id}
                    className="grid gap-3 md:grid-cols-[2fr_1fr_1.2fr_0.8fr_1.8fr] items-center px-4 py-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">{periodLabel}</div>
                      <div className="text-xs text-slate-500">{conditionsLabel}</div>
                    </div>
                    <div>
                      <StatusBadge label={statusLabel} tone={statusTone} />
                    </div>
                    <div className="text-slate-600">{booking?.artist ?? '—'}</div>
                    <div className="text-slate-600">{applicationsCount}</div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/admin/programming/items/${item.id}`} className="btn">
                        Modifier les conditions
                      </Link>
                      {isConfirmed ? (
                        <button className="btn" type="button" disabled aria-disabled>
                          Créneau confirmé
                        </button>
                      ) : (
                        <Link href={`/admin/programming/items/${item.id}`} className="btn btn-primary">
                          Confirmer un artiste
                        </Link>
                      )}
                      <form action={removeItemAction}>
                        <input type="hidden" name="program_id" value={program.id} />
                        <input type="hidden" name="item_id" value={item.id} />
                        <button className="btn" type="submit">
                          Supprimer
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
