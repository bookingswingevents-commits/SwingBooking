import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ itemId: string }>;
  searchParams?: { error?: string; success?: string };
};

type ItemRow = {
  id: string;
  item_type: 'DATE' | 'WEEK';
  start_date: string;
  end_date: string;
  status: string;
  programming_programs: { id: string; name: string; conditions_json: Record<string, any> } | null;
};

type ApplicationRow = { id: string; status: string; option_json: Record<string, any> };

type BookingRow = { id: string; status: string };

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

async function applyAction(itemId: string, formData: FormData) {
  'use server';
  const optionRaw = String(formData.get('option_json') ?? '{}');
  let option_json: Record<string, any> = {};
  try {
    option_json = JSON.parse(optionRaw) as Record<string, any>;
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

  const { data: item } = await supabase
    .from('programming_items')
    .select('id, status')
    .eq('id', itemId)
    .maybeSingle();
  if (!item || item.status !== 'OPEN') {
    redirect(`/artist/programming/${itemId}?error=Item%20non%20disponible`);
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
    redirect(`/artist/programming/${itemId}?error=Impossible%20de%20postuler`);
  }

  redirect(`/artist/programming/${itemId}?success=Candidature%20envoyee`);
}

export default async function ArtistProgrammingItemPage({ params, searchParams }: PageProps) {
  const { itemId } = await params;
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

  const { data: item } = await supabase
    .from('programming_items')
    .select('id, item_type, start_date, end_date, status, programming_programs(id, name, conditions_json)')
    .eq('id', itemId)
    .maybeSingle();

  if (!item) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Programmation</h1>
        <p className="text-slate-500">Item introuvable.</p>
        <Link href="/artist/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const { data: application } = await supabase
    .from('programming_applications')
    .select('id, status, option_json')
    .eq('item_id', itemId)
    .eq('artist_id', artistId)
    .maybeSingle();

  const { data: booking } = await supabase
    .from('programming_bookings')
    .select('id, status')
    .eq('item_id', itemId)
    .eq('artist_id', artistId)
    .maybeSingle();

  const program = Array.isArray(item.programming_programs)
    ? item.programming_programs[0]
    : item.programming_programs;
  const options = (program?.conditions_json as any)?.fees?.options ?? [];
  const canApply = item.status === 'OPEN' && !application && !booking;
  const onApply = applyAction.bind(null, itemId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="space-y-2">
        <Link href="/artist/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold">{program?.name ?? 'Programmation'}</h1>
        <p className="text-sm text-slate-600">
          {item.start_date} → {item.end_date}
        </p>
      </header>

      {searchParams?.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm">
          {searchParams.error}
        </div>
      ) : null}
      {searchParams?.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 text-sm">
          {searchParams.success}
        </div>
      ) : null}

      {booking ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 text-sm">
          Reservation confirmee.
        </div>
      ) : null}

      {application ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700 text-sm">
          Candidature: {application.status}
        </div>
      ) : null}

      {canApply ? (
        <form action={onApply} className="rounded-xl border p-4 space-y-3">
          <div className="text-sm font-medium">Candidater</div>
          {options.length > 0 ? (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="option">
                Choix de cachet
              </label>
              <select id="option" name="option_json" className="border rounded-lg px-3 py-2 w-full" required>
                <option value="">Selectionner une option</option>
                {options.map((opt: any, idx: number) => (
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
            Envoyer la candidature
          </button>
        </form>
      ) : (
        <div className="text-sm text-slate-500">
          Candidature indisponible pour cet item.
        </div>
      )}
    </div>
  );
}
