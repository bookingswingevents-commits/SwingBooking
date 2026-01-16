import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export default async function AdminProgrammingPage() {
  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Programming V2</h1>
        <p className="text-red-600">Acces refuse (admin requis).</p>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const { data: programs, error } = await supabase
    .from('programming_programs')
    .select('id, name, program_type, status, created_at, clients(name)')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Programming V2</h1>
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
          <h1 className="text-2xl font-bold">Programming V2</h1>
          <p className="text-sm text-slate-600">Programmes en cours de creation (v2).</p>
        </div>
        <Link href="/admin/programming/new" className="btn btn-primary">
          Nouveau programme
        </Link>
      </header>

      {programs && programs.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
          Aucun programme V2 pour le moment.
        </div>
      ) : (
        <div className="rounded-xl border divide-y">
          {programs?.map((program) => {
            const clientName = Array.isArray(program.clients)
              ? program.clients[0]?.name
              : (program.clients as any)?.name;
            return (
              <Link
                key={program.id}
                href={`/admin/programming/${program.id}`}
                className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50"
              >
                <div className="space-y-1">
                  <div className="font-semibold">{program.name}</div>
                  <div className="text-sm text-slate-600">
                    {clientName || 'Client'} • {program.program_type}
                  </div>
                </div>
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  {program.status ?? 'DRAFT'}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
