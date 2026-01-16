import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

type ItemRow = {
  id: string;
  item_type: 'DATE' | 'WEEK';
  start_date: string;
  end_date: string;
  status: string;
  programming_programs: { id: string; name: string; program_type: string } | null;
};

type ApplicationRow = { item_id: string; status: string };

type BookingRow = { item_id: string; status: string };

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

export default async function ArtistProgrammingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const artistId = await getArtistId();
  if (!artistId) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Programmations</h1>
        <p className="text-red-600">Compte artiste non lie.</p>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const { data: items } = await supabase
    .from('programming_items')
    .select('id, item_type, start_date, end_date, status, programming_programs(id, name, program_type)')
    .order('start_date', { ascending: true });

  const { data: applications } = await supabase
    .from('programming_applications')
    .select('item_id, status')
    .eq('artist_id', artistId);

  const { data: bookings } = await supabase
    .from('programming_bookings')
    .select('item_id, status')
    .eq('artist_id', artistId);

  const appMap = new Map<string, ApplicationRow>();
  (applications ?? []).forEach((app) => appMap.set(app.item_id, app));
  const bookingMap = new Map<string, BookingRow>();
  (bookings ?? []).forEach((bk) => bookingMap.set(bk.item_id, bk));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Programmations</h1>
          <p className="text-sm text-slate-600">Programmations ouvertes pour candidature.</p>
        </div>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </header>

      {items && items.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
          Aucune programmation ouverte pour le moment.
        </div>
      ) : (
        <div className="rounded-xl border divide-y">
          {(items ?? []).map((item) => {
            const program = Array.isArray(item.programming_programs)
              ? item.programming_programs[0]
              : item.programming_programs;
            const app = appMap.get(item.id);
            const booking = bookingMap.get(item.id);
            return (
              <Link
                key={item.id}
                href={`/artist/programming/${item.id}`}
                className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50"
              >
                <div className="space-y-1">
                  <div className="font-semibold">{program?.name ?? 'Programme'}</div>
                  <div className="text-sm text-slate-600">
                    {item.start_date} → {item.end_date}
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {booking?.status === 'CONFIRMED'
                    ? 'Confirme'
                    : app?.status
                    ? app.status
                    : 'Ouvert'}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
