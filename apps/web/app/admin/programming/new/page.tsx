import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import ProgrammingForm from './programming-form';

export const dynamic = 'force-dynamic';

type ActionState = {
  error?: string | null;
  fields?: {
    title: string;
    client_id: string;
    program_type: string;
  };
};

async function createProgrammingAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  'use server';
  const title = String(formData.get('title') ?? '').trim();
  const client_id = String(formData.get('client_id') ?? '').trim();
  const program_type = String(formData.get('program_type') ?? '').trim();
  const fields = { title, client_id, program_type };

  if (!title || !client_id || !program_type) {
    return { error: 'Veuillez renseigner tous les champs.', fields };
  }

  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) {
    return { error: 'Acces refuse (admin requis).', fields };
  }

  const { data, error } = await supabase
    .from('programming_programs')
    .insert({
      title,
      client_id,
      program_type,
      status: 'DRAFT',
      conditions_json: {},
    })
    .select('id, title')
    .maybeSingle();

  if (error || !data?.id) {
    return { error: error?.message ?? 'Creation impossible.', fields };
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
        <h1 className="text-2xl font-bold">Nouvelle programmation</h1>
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
        <h1 className="text-2xl font-bold">Nouvelle programmation</h1>
        <p className="text-sm text-slate-600">Création rapide en mode brouillon.</p>
      </header>

      <ProgrammingForm clients={(clients ?? []) as Array<{ id: string; name: string }>} action={createProgrammingAction} />
    </div>
  );
}
