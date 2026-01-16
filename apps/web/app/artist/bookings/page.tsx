import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { fetchArtistBookings } from '@/lib/programming/queries';

export const dynamic = 'force-dynamic';

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

export default async function ArtistBookingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const artistId = await getArtistId();
  if (!artistId) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <p className="text-red-600">Compte artiste non lie.</p>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const bookings = await fetchArtistBookings(supabase, artistId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-sm text-slate-600">Vos confirmations V2.</p>
        </div>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </header>

      {bookings.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
          Aucun booking confirme pour le moment.
        </div>
      ) : (
        <div className="rounded-xl border divide-y">
          {bookings.map((booking) => {
            const item = Array.isArray(booking.programming_items)
              ? booking.programming_items[0]
              : booking.programming_items;
            const program = Array.isArray(item?.programming_programs)
              ? item?.programming_programs[0]
              : item?.programming_programs;
            const displayTitle = program?.title ?? (program as any)?.name ?? 'Programmation';
            return (
              <div key={booking.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <div className="font-semibold">{displayTitle}</div>
                  <div className="text-xs text-slate-500">
                    {item?.start_date ?? 'Date'} → {item?.end_date ?? ''}
                  </div>
                </div>
                <Link href={`/artist/bookings/${booking.id}`} className="btn">
                  Feuille de route
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
