import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { createSnapshot } from '@/lib/programming/snapshot';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; success?: string }>;
};

type ItemRow = {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
};

type ApplicationRow = {
  id: string;
  item_id: string;
  artist_id: string;
  status: string;
  option_json: Record<string, any>;
  artists?: { stage_name: string | null; contact_email?: string | null; contact_phone?: string | null } | { stage_name: string | null }[] | null;
};

async function confirmBooking(programId: string, formData: FormData) {
  'use server';
  const itemId = String(formData.get('item_id') ?? '').trim();
  const applicationId = String(formData.get('application_id') ?? '').trim();
  if (!itemId || !applicationId) return;

  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) redirect('/admin/programming');

  const { data: program } = await supabase
    .from('programming_programs')
    .select('id, title, program_type, conditions_json')
    .eq('id', programId)
    .maybeSingle();
  if (!program) {
    redirect(`/admin/programming/${programId}/applications?error=Programme%20introuvable`);
  }

  const { data: item } = await supabase
    .from('programming_items')
    .select('id, program_id, item_type, start_date, end_date, status, metadata_json')
    .eq('id', itemId)
    .maybeSingle();
  if (!item) {
    redirect(`/admin/programming/${programId}/applications?error=Item%20introuvable`);
  }

  const { data: application } = await supabase
    .from('programming_applications')
    .select('id, item_id, artist_id, option_json')
    .eq('id', applicationId)
    .maybeSingle();
  if (!application) {
    redirect(`/admin/programming/${programId}/applications?error=Candidature%20introuvable`);
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id, stage_name, contact_email, contact_phone')
    .eq('id', application.artist_id)
    .maybeSingle();
  if (!artist) {
    redirect(`/admin/programming/${programId}/applications?error=Artiste%20introuvable`);
  }

  const snapshot = createSnapshot({
    program: {
      id: program.id,
      title: program.title ?? (program as any).name ?? 'Programmation',
      program_type: program.program_type ?? 'MULTI_DATES',
      conditions_json: program.conditions_json ?? {},
    },
    item: {
      id: item.id,
      program_id: item.program_id,
      item_type: item.item_type,
      start_date: item.start_date,
      end_date: item.end_date,
      status: item.status,
      metadata_json: item.metadata_json ?? {},
    },
    application: { id: application.id, option_json: application.option_json ?? {} },
    artist: {
      id: artist.id,
      stage_name: artist.stage_name,
      email: artist.contact_email,
      phone: artist.contact_phone,
    },
  });

  const { error } = await supabase.rpc('admin_create_programming_booking', {
    p_item_id: itemId,
    p_application_id: applicationId,
    p_snapshot: snapshot,
    p_option: application.option_json ?? {},
  });

  if (error) {
    redirect(`/admin/programming/${programId}/applications?error=Confirmation%20impossible`);
  }

  redirect(`/admin/programming/${programId}/applications?success=Booking%20confirme`);
}

export default async function AdminProgrammingApplicationsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
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

  const { data: program } = await supabase
    .from('programming_programs')
    .select('id, title')
    .eq('id', id)
    .maybeSingle();

  if (!program) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Candidatures</h1>
        <p className="text-slate-500">Programme introuvable.</p>
        <Link href="/admin/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const { data: items } = await supabase
    .from('programming_items')
    .select('id, start_date, end_date, status')
    .eq('program_id', program.id)
    .order('start_date', { ascending: true });

  const itemIds = (items ?? []).map((item) => item.id);
  const applicationsRes = itemIds.length
    ? await supabase
        .from('programming_applications')
        .select('id, item_id, artist_id, status, option_json, artists(stage_name, contact_email, contact_phone)')
        .in('item_id', itemIds)
        .order('created_at', { ascending: true })
    : { data: [] };

  const bookingsRes = itemIds.length
    ? await supabase
        .from('programming_bookings')
        .select('id, item_id, artist_id, status')
        .in('item_id', itemIds)
    : { data: [] };

  const byItem: Record<string, ApplicationRow[]> = {};
  (applicationsRes.data ?? []).forEach((app) => {
    if (!byItem[app.item_id]) byItem[app.item_id] = [];
    byItem[app.item_id].push(app as ApplicationRow);
  });
  const bookingMap = new Map<string, string>();
  (bookingsRes.data ?? []).forEach((bk) => bookingMap.set(bk.item_id, bk.artist_id));

  const onConfirm = confirmBooking.bind(null, program.id);
  const displayTitle = program.title ?? (program as any).name ?? 'Programmation';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="space-y-2">
        <Link href={`/admin/programming/${program.id}`} className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold">Candidatures</h1>
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

      {(items ?? []).length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
          Aucun item pour ce programme.
        </div>
      ) : (
        <div className="space-y-4">
          {(items ?? []).map((item) => {
            const apps = byItem[item.id] ?? [];
            const bookingArtist = bookingMap.get(item.id);
            return (
              <section key={item.id} className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">
                      {item.start_date} → {item.end_date}
                    </div>
                    <div className="text-xs text-slate-500">Statut: {item.status}</div>
                  </div>
                  {bookingArtist ? (
                    <span className="text-xs text-emerald-600">Booking confirme</span>
                  ) : null}
                </div>

                {apps.length === 0 ? (
                  <div className="text-sm text-slate-500">Aucune candidature.</div>
                ) : (
                  <div className="space-y-2">
                    {apps.map((app) => {
                      const artist = Array.isArray(app.artists) ? app.artists[0] : app.artists;
                      return (
                        <div key={app.id} className="flex flex-wrap items-center justify-between gap-3 text-sm border rounded-lg p-3">
                          <div>
                            <div className="font-medium">{artist?.stage_name ?? 'Artiste'}</div>
                            <div className="text-xs text-slate-500">Statut: {app.status}</div>
                            {app.option_json?.label ? (
                              <div className="text-xs text-slate-500">Option: {app.option_json.label}</div>
                            ) : null}
                          </div>
                          {!bookingArtist && item.status === 'OPEN' ? (
                            <form action={onConfirm}>
                              <input type="hidden" name="item_id" value={item.id} />
                              <input type="hidden" name="application_id" value={app.id} />
                              <button className="btn btn-primary" type="submit">
                                Confirmer
                              </button>
                            </form>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
