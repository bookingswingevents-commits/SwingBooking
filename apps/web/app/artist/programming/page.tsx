import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { formatRangeFR } from '@/lib/date';
import { fetchCompleteProgramsForArtist, fetchOpenProgramsForArtist } from '@/lib/programming/queries';
import { getProgrammingStatusLabel, getProgrammingStatusTone } from '@/lib/programming/status';
import StatusBadge from '@/components/programming/StatusBadge';

export const dynamic = 'force-dynamic';

function labelProgramType(value?: string | null) {
  return value === 'WEEKLY_RESIDENCY' ? 'Résidence hebdomadaire' : 'Dates multiples';
}

async function ensureArtist() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: byUser } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (byUser?.id) return byUser.id;

  const { data: byId } = await supabase
    .from('artists')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  return byId?.id ?? null;
}

export default async function ArtistProgrammingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const artistId = await ensureArtist();
  if (!artistId) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Programmations</h1>
        <p className="text-red-600">Compte artiste non lié.</p>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  let availablePrograms: Awaited<ReturnType<typeof fetchOpenProgramsForArtist>> = [];
  let completePrograms: Awaited<ReturnType<typeof fetchOpenProgramsForArtist>> = [];
  try {
    availablePrograms = await fetchOpenProgramsForArtist(supabase);
    const openIds = availablePrograms.map((program) => program.id);
    completePrograms = await fetchCompleteProgramsForArtist(supabase, openIds);
  } catch {
    availablePrograms = [];
    completePrograms = [];
  }
  const totalPrograms = availablePrograms.length + completePrograms.length;
  const totalOpenSlots = availablePrograms.reduce((sum, program) => sum + (program.open_count ?? 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Programmations</h1>
          <p className="text-sm text-slate-600">Choisissez une programmation disponible.</p>
        </div>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Disponibles</h2>
        {availablePrograms.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
            Aucune programmation disponible actuellement.
          </div>
        ) : (
          <div className="rounded-xl border divide-y">
            {availablePrograms.map((program) => {
              const periodLabel = formatRangeFR(program.start_date, program.end_date);
              const openLabel =
                program.open_count === 1
                  ? '1 créneau disponible'
                  : `${program.open_count} créneaux disponibles`;
              const statusLabel = getProgrammingStatusLabel(program.status ?? 'ACTIVE');
              const statusTone = getProgrammingStatusTone(program.status ?? 'ACTIVE');
              return (
                <div key={program.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="space-y-1">
                    <div className="font-semibold">{program.title ?? 'Programmation'}</div>
                    <div className="text-sm text-slate-600">
                      {program.client_name ?? 'Client'} • {labelProgramType(program.program_type)}
                    </div>
                    <div className="text-xs text-slate-500">{periodLabel}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge label={statusLabel} tone={statusTone} />
                    <div className="text-sm text-slate-600">{openLabel}</div>
                    <Link href={`/artist/programming/${program.id}`} className="btn btn-primary">
                      Voir les créneaux
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {availablePrograms.length === 0 ? (
          <div className="text-xs text-slate-500">
            Résumé : {totalPrograms} programmation{totalPrograms > 1 ? 's' : ''} trouvée
            {totalPrograms > 1 ? 's' : ''}, {totalOpenSlots} créneau{totalOpenSlots > 1 ? 'x' : ''} à pourvoir.
          </div>
        ) : null}
      </section>

      {completePrograms.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Complètes</h2>
            <p className="text-xs text-slate-500">Ces programmations sont déjà pourvues.</p>
          </div>
          <div className="rounded-xl border divide-y">
            {completePrograms.map((program) => {
              const periodLabel = formatRangeFR(program.start_date, program.end_date);
              const statusLabel = getProgrammingStatusLabel(program.status ?? 'ENDED');
              const statusTone = getProgrammingStatusTone(program.status ?? 'ENDED');
              return (
                <div key={program.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="space-y-1">
                    <div className="font-semibold">{program.title ?? 'Programmation'}</div>
                    <div className="text-sm text-slate-600">
                      {program.client_name ?? 'Client'} • {labelProgramType(program.program_type)}
                    </div>
                    <div className="text-xs text-slate-500">{periodLabel}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge label={statusLabel} tone={statusTone} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
