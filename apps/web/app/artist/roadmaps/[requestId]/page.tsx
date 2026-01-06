'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR } from '@/lib/date';
import { labelForEventFormat } from '@/lib/event-formats';

type BookingRequest = {
  id: string;
  title: string | null;
  formation: string | null;
  event_format: string | null;
  venue_company_name: string | null;
  venue_address: string | null;
  venue_contact_name: string | null;
  venue_contact_email: string | null;
  venue_contact_phone: string | null;
  practical_info: string | null;
  travel_covered?: boolean | null;
  travel_modes?: string[] | null;
  travel_notes?: string | null;
  accommodation_provided?: boolean | null;
  accommodation_type?: string | null;
  accommodation_notes?: string | null;
  meal_provided?: boolean | null;
  meal_notes?: string | null;
};

type Occurrence = {
  id: string;
  date: string;
  start_time: string | null;
  duration_minutes: number | null;
  address_snapshot: string | null;
  audience_estimate: number | null;
};

export default function ArtistRoadmapDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const [req, setReq] = useState<BookingRequest | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Connecte-toi pour voir la feuille de route.');
          setLoading(false);
          return;
        }
        const { data: br, error: brErr } = await supabase
          .from('booking_requests')
          .select(
            `
            id, title, formation, event_format,
            venue_company_name, venue_address, venue_contact_name, venue_contact_email, venue_contact_phone,
            practical_info,
            travel_covered, travel_modes, travel_notes,
            accommodation_provided, accommodation_type, accommodation_notes,
            meal_provided, meal_notes
          `
          )
          .eq('id', requestId)
          .maybeSingle();
        if (brErr || !br) throw new Error(brErr?.message || 'Demande introuvable');
        setReq(br as BookingRequest);

        const { data: occ, error: occErr } = await supabase
          .from('booking_request_occurrences')
          .select('id, date, start_time, duration_minutes, address_snapshot, audience_estimate')
          .eq('request_id', requestId)
          .order('date', { ascending: true });
        if (!occErr && occ) setOccurrences(occ as Occurrence[]);
      } catch (e: any) {
        setError(e?.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId]);

  const handlePrint = () => {
    try {
      window.print();
    } catch {
      /* ignore */
    }
  };

  if (loading) return <div className="text-slate-500">Chargement…</div>;
  if (error || !req) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Feuille de route</h1>
        <p className="text-red-600">{error ?? 'Demande introuvable.'}</p>
        <Link href="/artist/roadmaps" className="text-[var(--brand)] underline text-sm">
          ← Retour
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Feuille de route</h1>
          <p className="text-slate-600 text-sm">
            {req.title} • {req.formation?.toUpperCase() || '—'} •{' '}
            {req.event_format ? labelForEventFormat(req.event_format) : 'Format non précisé'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-2 rounded-lg border text-sm hover:bg-slate-50"
          >
            Imprimer
          </button>
          <Link href="/artist/roadmaps" className="text-sm underline text-[var(--brand)]">
            ← Retour
          </Link>
        </div>
      </header>

      <section className="border rounded-2xl p-4 space-y-2">
        <h2 className="text-lg font-semibold">Dates & lieux</h2>
        {occurrences.length === 0 ? (
          <div className="text-sm text-slate-600">Aucune date enregistrée.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {occurrences.map((o) => (
              <li key={o.id} className="border rounded-xl p-3 bg-white">
                <div className="font-medium">{fmtDateFR(o.date)}</div>
                <div className="text-slate-600">
                  {o.start_time || '—'}
                  {typeof o.duration_minutes === 'number'
                    ? ` • ${o.duration_minutes} min`
                    : ''}
                </div>
                {o.address_snapshot ? (
                  <div className="text-slate-600">{o.address_snapshot}</div>
                ) : req.venue_address ? (
                  <div className="text-slate-600">{req.venue_address}</div>
                ) : null}
                {o.audience_estimate != null ? (
                  <div className="text-slate-600">Public estimé : {o.audience_estimate}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border rounded-2xl p-4 space-y-2">
        <h2 className="text-lg font-semibold">Contact établissement</h2>
        <div className="text-sm space-y-1">
          <div className="font-medium">{req.venue_company_name || 'Établissement'}</div>
          {req.venue_address && <div>{req.venue_address}</div>}
          {req.venue_contact_name && <div>{req.venue_contact_name}</div>}
          {req.venue_contact_email && <div>{req.venue_contact_email}</div>}
          {req.venue_contact_phone && <div>{req.venue_contact_phone}</div>}
        </div>
      </section>

      <section className="border rounded-2xl p-4 space-y-2">
        <h2 className="text-lg font-semibold">Logistique VHR</h2>
        <div className="text-sm space-y-1">
          <div>
            Voyage : {req.travel_covered ? 'Pris en charge' : 'Non précisé'}
            {req.travel_modes?.length ? ` • Modes : ${req.travel_modes.join(', ')}` : ''}
          </div>
          {req.travel_notes && (
            <div className="text-slate-600 whitespace-pre-wrap">{req.travel_notes}</div>
          )}
          <div>
            Hébergement : {req.accommodation_provided ? 'Prévu' : 'Non précisé'}
            {req.accommodation_type ? ` • Type : ${req.accommodation_type}` : ''}
          </div>
          {req.accommodation_notes && (
            <div className="text-slate-600 whitespace-pre-wrap">{req.accommodation_notes}</div>
          )}
          <div>Repas : {req.meal_provided ? 'Prévu' : 'Non précisé'}</div>
          {req.meal_notes && (
            <div className="text-slate-600 whitespace-pre-wrap">{req.meal_notes}</div>
          )}
        </div>
      </section>
    </div>
  );
}
