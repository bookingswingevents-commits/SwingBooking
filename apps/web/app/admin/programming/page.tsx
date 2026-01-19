import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { formatRangeFR } from '@/lib/date';
import {
  getProgrammingStatusLabel,
  getProgrammingStatusTone,
  normalizeProgrammingStatus,
} from '@/lib/programming/status';
import StatusBadge from '@/components/programming/StatusBadge';

export const dynamic = 'force-dynamic';

function labelProgramType(value?: string | null) {
  return value === 'WEEKLY_RESIDENCY' ? 'Résidence hebdomadaire' : 'Dates multiples';
}

export default async function AdminProgrammingPage() {
  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Programmations</h1>
        <p className="text-red-600">Accès refusé (admin requis).</p>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const { data: programs, error } = await supabase
    .from('programming_programs')
    .select('id, title, program_type, status, created_at, clients(name)')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Programmations</h1>
        <p className="text-red-600">Une erreur est survenue lors du chargement.</p>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const programIds = (programs ?? []).map((program) => program.id);
  const activeCount = (programs ?? []).filter(
    (program) => normalizeProgrammingStatus(program.status) === 'ACTIVE'
  ).length;

  let pendingApplicationsCount = 0;
  try {
    const { count, error: applicationsError } = await supabase
      .from('programming_applications')
      .select('id', { count: 'exact', head: true })
      .in('status', ['NEW', 'APPLIED', 'PENDING']);
    if (applicationsError) throw applicationsError;
    pendingApplicationsCount = count ?? 0;
  } catch {
    pendingApplicationsCount = 0;
  }

  let confirmedBookingsCount = 0;
  try {
    const { count, error: bookingsError } = await supabase
      .from('programming_bookings')
      .select('id', { count: 'exact', head: true })
      .in('status', ['CONFIRMED', 'ACCEPTED']);
    if (bookingsError) throw bookingsError;
    confirmedBookingsCount = count ?? 0;
  } catch {
    confirmedBookingsCount = 0;
  }

  const periodByProgram = new Map<string, { start?: string | null; end?: string | null }>();
  if (programIds.length > 0) {
    try {
      const { data: items, error: itemsError } = await supabase
        .from('programming_items')
        .select('program_id, start_date, end_date')
        .in('program_id', programIds);
      if (itemsError) throw itemsError;
      (items ?? []).forEach((item) => {
        const existing = periodByProgram.get(item.program_id) ?? { start: null, end: null };
        const start = item.start_date;
        const end = item.end_date ?? item.start_date;
        const nextStart = existing.start ? (start < existing.start ? start : existing.start) : start;
        const nextEnd = existing.end ? (end > existing.end ? end : existing.end) : end;
        periodByProgram.set(item.program_id, { start: nextStart, end: nextEnd });
      });
    } catch {
      periodByProgram.clear();
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Programmations</h1>
          <p className="text-sm text-slate-600">Vue d’ensemble des programmations.</p>
        </div>
        <Link href="/admin/programming/new" className="btn btn-primary">
          Créer une programmation
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border p-4 space-y-1">
          <div className="text-sm text-slate-600">Programmations actives</div>
          <div className="text-2xl font-semibold">{activeCount}</div>
        </div>
        <div className="rounded-xl border p-4 space-y-1">
          <div className="text-sm text-slate-600">Demandes à traiter</div>
          <div className="text-2xl font-semibold">{pendingApplicationsCount}</div>
        </div>
        <div className="rounded-xl border p-4 space-y-1">
          <div className="text-sm text-slate-600">Artistes confirmés</div>
          <div className="text-2xl font-semibold">{confirmedBookingsCount}</div>
        </div>
      </section>

      {programs && programs.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
          Aucune programmation pour le moment.
        </div>
      ) : (
        <div className="rounded-xl border divide-y">
          <div className="hidden md:grid grid-cols-[1.2fr_2fr_1.6fr_1fr_1.2fr] gap-3 px-4 py-3 text-xs uppercase tracking-wide text-slate-500">
            <div>Client</div>
            <div>Titre</div>
            <div>Période</div>
            <div>Statut</div>
            <div>Type</div>
          </div>
          {programs?.map((program) => {
            const clientName = Array.isArray(program.clients)
              ? program.clients[0]?.name
              : (program.clients as any)?.name;
            const displayTitle = program.title ?? 'Programmation';
            const period = periodByProgram.get(program.id);
            const periodLabel = period ? formatRangeFR(period.start, period.end) : '—';
            const statusLabel = getProgrammingStatusLabel(program.status);
            const statusTone = getProgrammingStatusTone(program.status);
            return (
              <Link
                key={program.id}
                href={`/admin/programming/${program.id}`}
                className="grid gap-2 md:grid-cols-[1.2fr_2fr_1.6fr_1fr_1.2fr] items-center px-4 py-4 hover:bg-slate-50"
              >
                <div className="text-sm text-slate-600">{clientName || 'Client'}</div>
                <div className="font-semibold">{displayTitle}</div>
                <div className="text-sm text-slate-600">{periodLabel}</div>
                <div>
                  <StatusBadge label={statusLabel} tone={statusTone} />
                </div>
                <div className="text-sm text-slate-600">{labelProgramType(program.program_type)}</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
