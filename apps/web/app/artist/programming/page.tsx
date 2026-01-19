import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { fetchPublishedPrograms } from '@/lib/programming/queries';
import { PROGRAM_STATUS } from '@/lib/programming/types';
import ItemRow from '@/components/programming/ItemRow';

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

  const programs = await fetchPublishedPrograms(supabase);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Programmations</h1>
          <p className="text-sm text-slate-600">Choisissez une programmation ouverte.</p>
        </div>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </header>

      {programs.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
          Aucune programmation ouverte pour le moment.
        </div>
      ) : (
        <div className="rounded-xl border divide-y">
          {programs.map((program) => (
            <Link key={program.id} href={`/artist/programming/${program.id}`}>
              <ItemRow
                title={program.title ?? 'Programmation'}
                subtitle={labelProgramType(program.program_type)}
                status={program.status ?? PROGRAM_STATUS.PUBLISHED}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
