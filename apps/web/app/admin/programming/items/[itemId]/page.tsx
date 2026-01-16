import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ itemId: string }>;
  searchParams?: Promise<{ error?: string; success?: string }>;
};

type ApplicationRow = {
  id: string;
  artist_id: string;
  status: string;
  option_json: Record<string, any>;
  artists?: { stage_name: string | null } | { stage_name: string | null }[] | null;
};

async function confirmArtistAction(itemId: string, formData: FormData) {
  'use server';
  const applicationId = String(formData.get('application_id') ?? '').trim();
  if (!applicationId) return;

  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) redirect('/admin/programming');

  const { data: item } = await supabase
    .from('programming_items')
    .select('id, status, program_id, programming_programs(id, conditions_json)')
    .eq('id', itemId)
    .maybeSingle();

  if (!item || item.status !== 'OPEN') {
    redirect(`/admin/programming/items/${itemId}?error=Item%20non%20ouvert`);
  }

  const { data: application } = await supabase
    .from('programming_applications')
    .select('id, artist_id, option_json')
    .eq('id', applicationId)
    .eq('item_id', itemId)
    .maybeSingle();

  if (!application) {
    redirect(`/admin/programming/items/${itemId}?error=Candidature%20introuvable`);
  }

  const { data: existingBooking } = await supabase
    .from('programming_bookings')
    .select('id')
    .eq('item_id', itemId)
    .maybeSingle();
  if (existingBooking) {
    redirect(`/admin/programming/items/${itemId}?error=Item%20deja%20reserve`);
  }

  const program = Array.isArray(item.programming_programs)
    ? item.programming_programs[0]
    : item.programming_programs;

  const { error: bookingErr } = await supabase.from('programming_bookings').insert({
    item_id: itemId,
    artist_id: application.artist_id,
    status: 'CONFIRMED',
    conditions_snapshot_json: program?.conditions_json ?? {},
    option_json: application.option_json ?? {},
  });

  if (bookingErr) {
    redirect(`/admin/programming/items/${itemId}?error=Confirmation%20impossible`);
  }

  await supabase.from('programming_items').update({ status: 'CLOSED' }).eq('id', itemId);
  await supabase
    .from('programming_applications')
    .update({ status: 'REJECTED' })
    .eq('item_id', itemId)
    .neq('id', applicationId);

  redirect(`/admin/programming/items/${itemId}?success=Artiste%20confirme`);
}

export default async function AdminProgrammingItemPage({ params, searchParams }: PageProps) {
  const { itemId } = await params;
  const sp = (await searchParams) ?? {};
  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Candidatures</h1>
        <p className="text-red-600">Acces refuse (admin requis).</p>
        <Link href="/admin/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const { data: item } = await supabase
    .from('programming_items')
    .select(
      'id, item_type, start_date, end_date, status, program_id, programming_programs(id, title)'
    )
    .eq('id', itemId)
    .maybeSingle();

  if (!item) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Candidatures</h1>
        <p className="text-slate-500">Item introuvable.</p>
        <Link href="/admin/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const { data: applications } = await supabase
    .from('programming_applications')
    .select('id, artist_id, status, option_json, artists(stage_name)')
    .eq('item_id', itemId)
    .order('created_at', { ascending: true });

  const { data: booking } = await supabase
    .from('programming_bookings')
    .select('id, artist_id, status')
    .eq('item_id', itemId)
    .maybeSingle();

  const program = Array.isArray(item.programming_programs)
    ? item.programming_programs[0]
    : item.programming_programs;
  const displayTitle = program?.title ?? (program as any)?.name ?? 'Programmation';
  const onConfirm = confirmArtistAction.bind(null, itemId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="space-y-2">
        <Link href={`/admin/programming/${program?.id ?? ''}/calendar`} className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold">Candidatures</h1>
        <p className="text-sm text-slate-600">
          {displayTitle} • {item.start_date} → {item.end_date}
        </p>
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

      {booking ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 text-sm">
          Booking confirme pour cet item.
        </div>
      ) : null}

      {applications && applications.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
          Aucune candidature pour le moment.
        </div>
      ) : (
        <div className="rounded-xl border divide-y">
          {(applications ?? []).map((app) => {
            const artist = Array.isArray(app.artists) ? app.artists[0] : app.artists;
            const option = app.option_json ?? {};
            return (
              <div key={app.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div className="space-y-1">
                  <div className="font-medium">{artist?.stage_name ?? 'Artiste'}</div>
                  <div className="text-xs text-slate-500">Statut: {app.status}</div>
                  {option?.label ? (
                    <div className="text-xs text-slate-500">Option: {option.label}</div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {!booking && item.status === 'OPEN' ? (
                    <form action={onConfirm}>
                      <input type="hidden" name="application_id" value={app.id} />
                      <button className="btn btn-primary" type="submit">
                        Confirmer
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
