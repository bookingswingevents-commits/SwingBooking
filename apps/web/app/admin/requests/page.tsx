import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { fmtDateFR, statusFR } from '@/lib/date';

export const dynamic = 'force-dynamic';

type BookingRequestRow = {
  id: string;
  title: string | null;
  status: string | null;
  event_date: string | null;
  created_at: string;
  venue_company_name: string | null;
  venue_contact_email: string | null;
};

export default async function AdminRequestsPage() {
  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) redirect('/dashboard');

  const { data, error } = await supabase
    .from('booking_requests')
    .select('id, title, status, event_date, created_at, venue_company_name, venue_contact_email')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Demandes</h1>
        <p className="text-red-600 text-sm">Erreur: {error.message}</p>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const rows = (data ?? []) as BookingRequestRow[];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Demandes</h1>
          <p className="text-slate-600 text-sm">Toutes les demandes en cours et passées.</p>
        </div>
        <Link href="/admin/requests/new" className="btn btn-primary">
          Créer une demande
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="text-slate-500">Aucune demande pour le moment.</div>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/admin/requests/${r.id}`}
              className="border rounded-xl p-4 bg-white hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{r.title || 'Demande'}</div>
                <div className="text-xs text-slate-500">{fmtDateFR(r.created_at)}</div>
              </div>
              <div className="text-sm text-slate-600 mt-1">
                {r.event_date ? `Événement: ${fmtDateFR(r.event_date)}` : 'Date non renseignée'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {r.venue_company_name || 'Établissement'} •{' '}
                {r.venue_contact_email || 'Email non renseigné'} •{' '}
                {statusFR(r.status ?? 'en_cours')}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
