'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR } from '@/lib/date';

type BR = { id: string; title: string; event_date: string | null; venue_id: string | null; status: string; venue_address: string | null };
type Proposal = { id: string; client_amount: number | null; currency: string | null; status: string; };

export default function ClientRequestProposalPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [req, setReq] = useState<BR | null>(null);
  const [prop, setProp] = useState<Proposal | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr('');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: r, error: rErr } = await supabase
        .from('booking_requests')
        .select('id, title, event_date, venue_id, status, venue_address')
        .eq('id', id)
        .maybeSingle();
      if (rErr || !r) { setErr(rErr?.message ?? 'Demande introuvable'); setLoading(false); return; }

      // sécurité RLS : seule la venue propriétaire verra sa demande
      setReq(r as BR);

      const { data: p } = await supabase
        .from('proposals')
        .select('id, client_amount, currency, status')
        .eq('request_id', id)
        .maybeSingle();
      setProp((p ?? null) as Proposal | null);

      setLoading(false);
    })();
  }, [id, router]);

  const respond = async (accept: boolean) => {
    setSubmitting(true);
    const res = await fetch('/api/proposals/respond', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ request_id: id, accept }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert('Erreur: ' + (j?.error ?? 'inconnue'));
      return;
    }
    alert(accept ? 'Proposition acceptée ✅' : 'Proposition déclinée.');
    router.push('/dashboard');
  };

  if (loading) return <div className="text-slate-500">Chargement…</div>;
  if (!req) return <div>Demande introuvable</div>;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Proposition</h1>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">← Retour</Link>
      </header>

      <section className="border rounded-2xl p-4 space-y-1">
        <div className="font-medium">{req.title}</div>
        <div className="text-slate-600 text-sm">{fmtDateFR(req.event_date)} • {req.venue_address ?? '—'}</div>
      </section>

      <section className="border rounded-2xl p-4 space-y-3">
        <h2 className="text-lg font-semibold">Détails de la proposition</h2>
        {prop ? (
          <>
            <div className="text-sm">Montant : <strong>{prop.client_amount ?? '—'} {prop.currency ?? 'EUR'}</strong></div>
            <div className="text-sm">Statut : <strong>{prop.status}</strong></div>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={() => respond(true)} disabled={submitting || prop.status === 'accepted'}>
                {submitting ? 'Traitement…' : 'Accepter'}
              </button>
              <button className="btn" onClick={() => respond(false)} disabled={submitting || prop.status === 'accepted'}>
                Refuser
              </button>
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-600">Aucune proposition pour l’instant.</div>
        )}
      </section>
    </div>
  );
}
