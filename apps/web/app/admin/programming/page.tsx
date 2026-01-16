import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';

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
        <p className="text-red-600">Acces refuse (admin requis).</p>
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
        <p className="text-red-600">{error.message}</p>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Programmations</h1>
          <p className="text-sm text-slate-600">Programmations en cours de creation.</p>
        </div>
        <Link href="/admin/programming/new" className="btn btn-primary">
          Nouvelle programmation
        </Link>
      </header>

      {programs && programs.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
          Aucune programmation pour le moment.
        </div>
      ) : (
        <div className="rounded-xl border divide-y">
          {programs?.map((program) => {
            const clientName = Array.isArray(program.clients)
              ? program.clients[0]?.name
              : (program.clients as any)?.name;
            const displayTitle = program.title ?? 'Programmation';
            return (
              <Link
                key={program.id}
                href={`/admin/programming/${program.id}`}
                className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50"
              >
                <div className="space-y-1">
                  <div className="font-semibold">{displayTitle}</div>
                  <div className="text-sm text-slate-600">
                    {clientName || 'Client'} • {labelProgramType(program.program_type)}
                  </div>
                </div>
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  {(program.status ?? 'draft').toUpperCase()}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
