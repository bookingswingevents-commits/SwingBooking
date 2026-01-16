import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import ConditionsClient from './conditions-client';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; success?: string }>;
};

type ConditionsPayload = {
  fees?: { options?: Array<{ label: string; amount_cents?: number | null }> };
  lodging?: { items?: Array<{ label: string; value: string }> };
  meals?: { items?: Array<{ label: string; value: string }> };
  logistics?: { items?: Array<{ label: string; value: string }> };
  venues?: { items?: Array<{ label: string; value: string }> };
  contacts?: { items?: Array<{ label: string; value: string }> };
};

async function saveConditions(programId: string, formData: FormData) {
  'use server';
  const raw = String(formData.get('conditions_json') ?? '{}');
  let conditions: ConditionsPayload = {};
  try {
    conditions = JSON.parse(raw) as ConditionsPayload;
  } catch {
    conditions = {};
  }

  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) redirect('/admin/programming');

  const { error } = await supabase
    .from('programming_programs')
    .update({ conditions_json: conditions })
    .eq('id', programId);

  if (error) {
    redirect(`/admin/programming/${programId}/conditions?error=Enregistrement%20impossible`);
  }

  redirect(`/admin/programming/${programId}/conditions?success=Conditions%20enregistrees`);
}

export default async function AdminProgrammingConditionsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Conditions</h1>
        <p className="text-red-600">Acces refuse (admin requis).</p>
        <Link href="/admin/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const { data: program, error } = await supabase
    .from('programming_programs')
    .select('id, title, conditions_json')
    .eq('id', id)
    .maybeSingle();

  if (error || !program) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Conditions</h1>
        <p className="text-slate-500">Programme introuvable.</p>
        <Link href="/admin/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const onSave = saveConditions.bind(null, program.id);
  const displayTitle = program.title ?? (program as any).name ?? 'Programmation';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="space-y-2">
        <Link href={`/admin/programming/${program.id}`} className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold">Conditions</h1>
        <p className="text-sm text-slate-600">{displayTitle}</p>
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

      <ConditionsClient
        initialConditions={(program.conditions_json ?? {}) as ConditionsPayload}
        onSave={onSave}
      />
    </div>
  );
}
