import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

function labelProgramType(value?: string | null) {
  return value === 'WEEKLY_RESIDENCY' ? 'Residence hebdomadaire' : 'Dates multiples';
}

export default async function AdminProgrammingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Programmation</h1>
        <p className="text-red-600">Acces refuse (admin requis).</p>
        <Link href="/admin/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const { data: program, error } = await supabase
    .from('programming_programs')
    .select('id, title, program_type, status, clients(name)')
    .eq('id', id)
    .maybeSingle();

  if (error || !program) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Programmation</h1>
        <p className="text-slate-500">Programmation introuvable.</p>
        <Link href="/admin/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const clientName = Array.isArray(program.clients)
    ? program.clients[0]?.name
    : (program.clients as any)?.name;
  const displayTitle = program.title ?? (program as any).name ?? 'Programmation';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="space-y-2">
        <Link href="/admin/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold">{displayTitle}</h1>
        <p className="text-sm text-slate-600">
          {clientName || 'Client'} • {labelProgramType(program.program_type)}
        </p>
      </header>

      <section className="rounded-xl border p-4 space-y-2">
        <div className="text-sm font-medium">Statut</div>
        <div className="text-sm text-slate-600">{program.status ?? 'DRAFT'}</div>
      </section>

      <section className="rounded-xl border p-4 space-y-2">
        <div className="text-sm font-medium">Calendrier</div>
        <div className="text-sm text-slate-600">
          Ajouter des dates ou generer les semaines.
        </div>
        <Link href={`/admin/programming/${program.id}/calendar`} className="btn btn-primary w-fit">
          Ouvrir le calendrier
        </Link>
      </section>

      <section className="rounded-xl border p-4 space-y-2">
        <div className="text-sm font-medium">Conditions</div>
        <div className="text-sm text-slate-600">
          Configurer les modules sans regle imposee.
        </div>
        <Link href={`/admin/programming/${program.id}/conditions`} className="btn btn-primary w-fit">
          Editer les conditions
        </Link>
      </section>

      <section className="rounded-xl border p-4 space-y-2">
        <div className="text-sm font-medium">Candidatures</div>
        <div className="text-sm text-slate-600">
          Suivi des candidatures par item.
        </div>
        <Link href={`/admin/programming/${program.id}/applications`} className="btn btn-primary w-fit">
          Voir les candidatures
        </Link>
      </section>

      <section className="rounded-xl border p-4 space-y-2">
        <div className="text-sm font-medium">Etapes suivantes</div>
        <div className="text-sm text-slate-600">
          Les dates, conditions et feuilles de route seront ajoutees dans les prochaines etapes.
        </div>
      </section>
    </div>
  );
}
