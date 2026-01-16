import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { fetchProgram, fetchProgramItems } from '@/lib/programming/queries';
import ItemRow from '@/components/programming/ItemRow';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; success?: string }>;
};

type OptionPayload = { label?: string; amount_cents?: number };

type ApplicationRow = { id: string; item_id: string; status: string };

type BookingRow = { id: string; item_id: string; status: string };

async function getArtistId() {
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

async function applyToItem(programId: string, itemId: string, formData: FormData) {
  'use server';
  const optionRaw = String(formData.get('option_json') ?? '{}');
  let option_json: OptionPayload = {};
  try {
    option_json = JSON.parse(optionRaw) as OptionPayload;
  } catch {
    option_json = {};
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const artistId = await getArtistId();
  if (!artistId) redirect('/dashboard');

  const { data: program } = await supabase
    .from('programming_programs')
    .select('status')
    .eq('id', programId)
    .maybeSingle();
  if (!program || program.status !== 'PUBLISHED') {
    redirect(`/artist/programming/${programId}?error=Programme%20non%20publie`);
  }

  const { data: item } = await supabase
    .from('programming_items')
    .select('status')
    .eq('id', itemId)
    .eq('program_id', programId)
    .maybeSingle();
  if (!item || item.status !== 'OPEN') {
    redirect(`/artist/programming/${programId}?error=Item%20non%20disponible`);
  }

  const { data: existingBooking } = await supabase
    .from('programming_bookings')
    .select('id')
    .eq('item_id', itemId)
    .maybeSingle();
  if (existingBooking) {
    redirect(`/artist/programming/${programId}?error=Item%20deja%20reserve`);
  }

  const { error } = await supabase
    .from('programming_applications')
    .insert({
      item_id: itemId,
      artist_id: artistId,
      option_json,
      status: 'APPLIED',
    });

  if (error) {
    redirect(`/artist/programming/${programId}?error=Impossible%20de%20postuler`);
  }

  redirect(`/artist/programming/${programId}?success=Candidature%20envoyee`);
}

export default async function ArtistProgrammingItemsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const artistId = await getArtistId();
  if (!artistId) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Programmation</h1>
        <p className="text-red-600">Compte artiste non lie.</p>
        <Link href="/artist/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const program = await fetchProgram(supabase, id);
  if (!program) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Programmation</h1>
        <p className="text-slate-500">Programme introuvable.</p>
        <Link href="/artist/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const items = await fetchProgramItems(supabase, id);

  const { data: applications } = await supabase
    .from('programming_applications')
    .select('id, item_id, status')
    .eq('artist_id', artistId);

  const { data: bookings } = await supabase
    .from('programming_bookings')
    .select('id, item_id, status')
    .eq('artist_id', artistId);

  const appMap = new Map<string, ApplicationRow>();
  (applications ?? []).forEach((app) => appMap.set(app.item_id, app));
  const bookingMap = new Map<string, BookingRow>();
  (bookings ?? []).forEach((bk) => bookingMap.set(bk.item_id, bk));

  const feeOptions = ((program.conditions_json as any)?.fees?.options ?? []) as OptionPayload[];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="space-y-2">
        <Link href="/artist/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold">{program.name}</h1>
        <p className="text-sm text-slate-600">Items disponibles</p>
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

      {items.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
          Aucun item pour le moment.
        </div>
      ) : (
        <div className="rounded-xl border divide-y">
          {items.map((item) => {
            const application = appMap.get(item.id);
            const booking = bookingMap.get(item.id);
            const canApply =
              program.status === 'PUBLISHED' &&
              item.status === 'OPEN' &&
              !application &&
              !booking;
            const onApply = applyToItem.bind(null, program.id, item.id);
            return (
              <div key={item.id} className="space-y-3">
                <ItemRow
                  title={`${item.start_date} → ${item.end_date}`}
                  subtitle={item.item_type === 'WEEK' ? 'Semaine' : 'Date'}
                  status={booking?.status === 'CONFIRMED' ? 'CONFIRME' : application?.status ?? item.status}
                />
                {booking ? (
                  <div className="px-4 pb-4 text-sm text-emerald-700">Booking confirme.</div>
                ) : null}
                {application ? (
                  <div className="px-4 pb-4 text-sm text-slate-600">
                    Candidature: {application.status}
                  </div>
                ) : null}
                {canApply ? (
                  <form action={onApply} className="px-4 pb-4 space-y-3">
                    {feeOptions.length > 0 ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor={`option-${item.id}`}>
                          Choix de cachet
                        </label>
                        <select
                          id={`option-${item.id}`}
                          name="option_json"
                          className="border rounded-lg px-3 py-2 w-full"
                          required
                        >
                          <option value="">Selectionner une option</option>
                          {feeOptions.map((opt, idx) => (
                            <option key={`${opt.label}-${idx}`} value={JSON.stringify(opt)}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <input type="hidden" name="option_json" value="{}" />
                    )}
                    <button className="btn btn-primary" type="submit">
                      Postuler
                    </button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
