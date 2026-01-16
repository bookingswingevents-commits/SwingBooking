'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR } from '@/lib/date';
import { getArtistIdentity } from '@/lib/artistIdentity';
import { LEGACY_RESIDENCIES_DISABLED } from '@/lib/featureFlags';

type ResidencyRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  lodging_included: boolean;
  meals_included: boolean;
  companion_included: boolean;
  is_public: boolean;
  is_open: boolean;
  clients?: { name: string } | { name: string }[] | null;
};

export default function ArtistProgrammationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ResidencyRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [artistLinked, setArtistLinked] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        if (LEGACY_RESIDENCIES_DISABLED) {
          setRows([]);
          return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const identity = await getArtistIdentity(supabase);
        if (!identity.artistId) {
          setArtistLinked(false);
        }

        const { data, error: selErr } = await supabase
          .from('residencies')
          .select(
            'id, name, start_date, end_date, lodging_included, meals_included, companion_included, is_public, is_open, clients(name)'
          )
          .eq('is_public', true)
          .eq('is_open', true)
          .order('start_date', { ascending: true });
        if (selErr) throw selErr;
        setRows((data as ResidencyRow[]) ?? []);
      } catch (e: any) {
        setError(e?.message ?? 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) return <div className="text-slate-500">Chargement…</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  const safeRows = Array.isArray(rows) ? rows : [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Programmations</h1>
        <p className="text-slate-600 text-sm">Programmations ouvertes aux candidatures.</p>
      </header>

      {!artistLinked ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
          Compte artiste non lié. Contactez l’admin pour activer votre accès.
        </div>
      ) : null}

      {safeRows.length === 0 ? (
        <div className="text-sm text-slate-500">Aucune programmation ouverte pour le moment.</div>
      ) : (
        <div className="space-y-3">
          {safeRows.map((r) => {
            const clientName = Array.isArray(r.clients)
              ? r.clients[0]?.name
              : (r.clients as any)?.name;
            return (
              <div key={r.id} className="rounded-xl border p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-sm text-slate-500">
                    {clientName || 'Client'} • {fmtDateFR(r.start_date)} → {fmtDateFR(r.end_date)}
                  </div>
                </div>
                <Link href={`/artist/programmations/${r.id}`} className="btn btn-primary">
                  Voir
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
