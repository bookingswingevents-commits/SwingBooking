import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

async function createProgram(formData: FormData) {
  'use server';
  const title = String(formData.get('title') ?? formData.get('name') ?? '').trim();
  const clientId = String(formData.get('client_id') ?? '').trim();
  const programType = String(formData.get('program_type') ?? '').trim();

  if (!title || !clientId || !programType) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) redirect('/dashboard');

  const { data, error } = await supabase
    .from('programming_programs')
    .insert({
      title,
      client_id: clientId,
      program_type: programType,
      status: 'DRAFT',
      conditions_json: {},
      created_by: user.id,
    })
    .select('id')
    .maybeSingle();

  if (error || !data?.id) {
    return;
  }

  redirect(`/admin/programming/${data.id}`);
}

export default async function AdminProgrammingNewPage() {
  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Nouveau programme</h1>
        <p className="text-red-600">Acces refuse (admin requis).</p>
        <Link href="/admin/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .order('name', { ascending: true });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="space-y-2">
        <Link href="/admin/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold">Nouveau programme V2</h1>
        <p className="text-sm text-slate-600">Creation rapide en mode brouillon.</p>
      </header>

      <form action={createProgram} className="rounded-xl border p-5 space-y-4 bg-white">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="title">
            Titre du programme
          </label>
          <input
            id="title"
            name="title"
            className="border rounded-lg px-3 py-2 w-full"
            placeholder="Nom interne"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="client_id">
            Client
          </label>
          <select id="client_id" name="client_id" className="border rounded-lg px-3 py-2 w-full" required>
            <option value="">Selectionner un client</option>
            {(clients ?? []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="program_type">
            Type de programme
          </label>
          <select
            id="program_type"
            name="program_type"
            className="border rounded-lg px-3 py-2 w-full"
            required
          >
            <option value="WEEKLY_RESIDENCY">Residences hebdo (L2A)</option>
            <option value="MULTI_DATES">Multi dates (DPF)</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary">
            Creer le programme
          </button>
          <Link href="/admin/programming" className="btn">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
