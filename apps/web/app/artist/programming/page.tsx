import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { formatRangeFR } from '@/lib/date';
import { fetchOpenProgramsForArtist } from '@/lib/programming/queries';

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
        <p className="text-red-600">Compte artiste non lie.</p>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  let programs: Awaited<ReturnType<typeof fetchOpenProgramsForArtist>> = [];
  try {
    programs = await fetchOpenProgramsForArtist(supabase);
  } catch {
    programs = [];
  }

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

      {programs.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
          Aucune programmation disponible pour le moment. Revenez plus tard ou complétez votre profil si nécessaire.
        </div>
      ) : (
        <div className="rounded-xl border divide-y">
          {programs.map((program) => {
            const periodLabel = formatRangeFR(program.start_date, program.end_date);
            const openLabel =
              program.open_count === 1
                ? '1 créneau disponible'
                : `${program.open_count} créneaux disponibles`;
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
    </div>
  );
}
