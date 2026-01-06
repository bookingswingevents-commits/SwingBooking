'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR } from '@/lib/date';
import { labelForEventFormat } from '@/lib/event-formats';

type Proposal = {
  id: string;
  status: string;
  created_at: string;
  request_id: string;
  booking_requests: {
    id: string;
    title: string;
    event_date: string | null;
    event_format?: string | null;
    formation?: string | null;
    venue_address?: string | null;
  } | null;
  artists: { id: string; stage_name: string | null } | null;
};

const humanStatus = (s?: string) =>
  ({
    accepted: 'Acceptée par le client',
    declined: 'Refusée par le client',
    changes_requested: 'Modifications demandées par le client',
    sent: 'Envoyée au client',
    proposal_sent: 'Envoyée au client',
    proposed: 'Proposée',
    pending: 'En attente',
  } as Record<string, string>)[s || ''] || (s ?? '—');

export default function AdminProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [p, setP] = useState<Proposal | null>(null);
  const [err, setErr] = useState<string>('');
  const [acting, setActing] = useState(false);
  const [doneRoadmap, setDoneRoadmap] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr('');
        const { data, error } = await supabase
          .from('proposals')
          .select(`
            id, status, created_at, request_id,
            booking_requests(id, title, event_date, event_format, formation, venue_address),
            artists:artist_id(id, stage_name)
          `)
          .eq('id', id)
          .maybeSingle();
        if (error) throw new Error(error.message);
        const normalized = data
          ? {
              ...data,
              booking_requests: Array.isArray((data as any).booking_requests)
                ? (data as any).booking_requests[0] ?? null
                : (data as any).booking_requests,
              artists: Array.isArray((data as any).artists)
                ? (data as any).artists[0] ?? null
                : (data as any).artists,
            }
          : null;
        setP((normalized as Proposal) ?? null);
      } catch (e: any) {
        setErr(e?.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const canGenerate = p?.status === 'accepted' && !acting && !doneRoadmap;

  const generateRoadmap = async () => {
    if (!p) return;
    try {
      setActing(true);
      const res = await fetch('/api/roadmaps/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: p.id }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'Échec création feuille de route');
      setDoneRoadmap(true);
      alert('Feuille de route générée et notifications envoyées ✅');
      router.refresh();
    } catch (e: any) {
      alert(e?.message || 'Impossible de générer la feuille de route');
    } finally {
      setActing(false);
    }
  };

  if (loading) return <div className="text-slate-500">Chargement…</div>;
  if (err) return <div className="text-red-600">{err}</div>;
  if (!p) return <div className="text-slate-600">Proposition introuvable</div>;

  const br = p.booking_requests;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Proposition</h1>
          <div className="text-slate-600 text-sm">
            Statut : <span className="font-medium">{humanStatus(p.status)}</span>
          </div>
        </div>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">← Retour</Link>
      </header>

      {br && (
        <section className="border rounded-2xl p-4 space-y-1">
          <h2 className="text-lg font-semibold">{br.title}</h2>
          <div className="text-slate-600 text-sm">
            {fmtDateFR(br.event_date)}
            {br.event_format ? ` • ${labelForEventFormat(br.event_format)}` : ''}
            {br.formation ? ` • ${String(br.formation).toUpperCase()}` : ''}
          </div>
          {br.venue_address ? <div className="text-sm text-slate-600">{br.venue_address}</div> : null}
        </section>
      )}

      <section className="border rounded-2xl p-4 space-y-3">
        <h2 className="text-lg font-semibold">Actions</h2>
        <div className="text-sm text-slate-600">
          {p.status === 'accepted' && 'Le client a accepté — vous pouvez générer la feuille de route et notifier les parties.'}
          {p.status === 'declined' && 'Le client a refusé — proposez un autre artiste ou clôturez la demande.'}
          {p.status === 'changes_requested' && 'Le client a demandé des modifications — éditez puis renvoyez la proposition.'}
          {(p.status === 'sent' || p.status === 'proposal_sent') && 'En attente de la décision du client.'}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-primary disabled:opacity-60"
            onClick={generateRoadmap}
            disabled={!canGenerate}
            title={canGenerate ? 'Créer feuille de route' : 'Action indisponible'}
          >
            {acting ? 'Traitement…' : doneRoadmap ? 'Feuille de route générée' : 'Générer la feuille de route'}
          </button>
          <Link href={`/admin/requests/${p.request_id}`} className="btn">Ouvrir la demande</Link>
        </div>
      </section>
    </div>
  );
}
