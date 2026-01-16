import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { fetchArtistApplications } from '@/lib/programming/queries';

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

export default async function ArtistApplicationsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const artistId = await getArtistId();
  if (!artistId) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Candidatures</h1>
        <p className="text-red-600">Compte artiste non lie.</p>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const applications = await fetchArtistApplications(supabase, artistId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Candidatures</h1>
          <p className="text-sm text-slate-600">Suivi de vos candidatures V2.</p>
        </div>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </header>

      {applications.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
          Aucune candidature pour le moment.
        </div>
      ) : (
        <div className="rounded-xl border divide-y">
          {applications.map((app) => {
            const item = Array.isArray(app.programming_items)
              ? app.programming_items[0]
              : app.programming_items;
            return (
              <div key={app.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <div className="font-semibold">Item {item?.id ?? app.item_id}</div>
                  <div className="text-xs text-slate-500">Statut: {app.status}</div>
                </div>
                <Link href={`/artist/programming/${item?.program_id ?? ''}`} className="btn">
                  Voir le programme
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
