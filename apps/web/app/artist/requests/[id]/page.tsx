'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR, statusFR } from '@/lib/date';
import { labelForEventFormat } from '@/lib/event-formats';

type Formation = 'solo' | 'duo' | 'trio' | 'quartet' | 'dj';
const FORMATIONS: { value: Formation; label: string }[] = [
  { value: 'solo', label: 'Solo' },
  { value: 'duo', label: 'Duo' },
  { value: 'trio', label: 'Trio' },
  { value: 'quartet', label: 'Quartet' },
  { value: 'dj', label: 'DJ' },
];
const formationLabel = (v?: Formation | null) =>
  FORMATIONS.find((f) => f.value === v)?.label ?? (v ?? '—');

type Request = {
  id: string;
  title: string;
  status: string;
  event_date: string | null;
  formation: Formation | null;
  start_time?: string | null;
  duration_minutes?: number | null;
  event_format?: string | null;
  venue_company_name?: string | null;
  venue_address: string | null;
  venue_contact_name: string | null;
  venue_contact_email: string | null;
  venue_contact_phone: string | null;
  audience_size: number | null;
  notes: string | null;
};

type RA = {
  id: number;
  status: string | null;
  request_id: string;
  artist_id: string;
  created_at: string;
};

type Pricing = {
  client_quote: number | null;
  artist_fee: number | null;
  internal_costs: number | null;
  currency: string | null;
};

type Occurrence = {
  id: string;
  date: string;
  start_time: string | null;
  duration_minutes: number | null;
  address_snapshot: string | null;
  audience_estimate: number | null;
};

type CompensationMode = 'cachet' | 'facture' | null;

function fmtMinutes(m?: number | null) {
  if (m == null) return '—';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h}h${String(min).padStart(2, '0')}` : `${h}h`;
}

export default function ArtistRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string>('');
  const [req, setReq] = useState<Request | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [link, setLink] = useState<RA | null>(null);
  const [acting, setActing] = useState<'yes' | 'no' | null>(null);
  const [compMode, setCompMode] = useState<CompensationMode>(null);
  const [compAmount, setCompAmount] = useState<string>('');
  const [compExpenses, setCompExpenses] = useState<string>('');
  const [compOrganism, setCompOrganism] = useState<string>('');
  const [savingComp, setSavingComp] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLastError('');

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const artistId = session.user.id;

      try {
        const { data: ra, error: raErr } = await supabase
          .from('request_artists')
          .select('id, status, request_id, artist_id, created_at')
          .eq('request_id', id)
          .eq('artist_id', artistId)
          .maybeSingle();

        if (raErr) throw new Error(`Erreur lecture invitation : ${raErr.message}`);
        if (!ra) throw new Error("Tu n'as pas accès à cette demande (pas d’invitation liée).");
        setLink(ra as RA);

        const { data: r, error: rErr } = await supabase
          .from('booking_requests')
          .select(
            `
            id, title, status, event_date, formation,
            start_time, duration_minutes, event_format,
            venue_company_name, venue_address, venue_contact_name, venue_contact_email, venue_contact_phone,
            audience_size, notes
          `,
          )
          .eq('id', id)
          .maybeSingle();

        if (rErr) throw new Error(`Erreur lecture demande : ${rErr.message}`);
        if (!r) throw new Error('Demande introuvable.');
        setReq(r as Request);

        // Charger éventuelle compensation existante
        const { data: prop } = await supabase
          .from('proposals')
          .select('compensation_mode, compensation_amount, compensation_expenses, compensation_organism')
          .eq('request_id', id)
          .eq('artist_id', artistId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (prop) {
          setCompMode((prop as any)?.compensation_mode ?? null);
          setCompAmount(
            (prop as any)?.compensation_amount != null
              ? String((prop as any).compensation_amount)
              : ''
          );
          setCompExpenses(
            (prop as any)?.compensation_expenses != null
              ? String((prop as any).compensation_expenses)
              : ''
          );
          setCompOrganism((prop as any)?.compensation_organism ?? '');
          // Une rémunération est déjà enregistrée : on affiche l'état comme sauvegardé
          setIsSaved(true);
        }


        try {
          const res = await fetch(`/api/pricing/by-request?request_id=${encodeURIComponent(id)}`, {
            cache: 'no-store',
          });
          const json = await res.json();
          setPricing(json?.ok ? (json.data as Pricing | null) ?? null : null);
        } catch {
          setPricing(null);
        }

        // Occurrences (dates / lieux)
        const { data: occ, error: occErr } = await supabase
          .from('booking_request_occurrences')
          .select('id, date, start_time, duration_minutes, address_snapshot, audience_estimate')
          .eq('request_id', id)
          .order('date', { ascending: true });
        if (!occErr && occ) setOccurrences(occ as Occurrence[]);
      } catch (e: any) {
        setLastError(e?.message ?? 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  const respond = async (decision: 'accepted' | 'declined') => {
    if (!link) return;
    setLastError('');
    setActing(decision === 'accepted' ? 'yes' : 'no');

    try {
      const { error: rpcErr } = await supabase.rpc('artist_reply_invitation', {
        _request_id: link.request_id,
        _answer: decision,
        _reason: null,
      });
      if (!rpcErr) {
        setLink({ ...link, status: decision });
        alert(
          decision === 'accepted'
            ? 'Merci, ta disponibilité a été confirmée ✅'
            : 'Ta réponse “indisponible” a bien été enregistrée 🚫',
        );
        setActing(null);
        return;
      }
    } catch {
      // ignore
    }

    const { error } = await supabase.from('request_artists').update({ status: decision }).eq('id', link.id);

    setActing(null);

    if (error) {
      setLastError(`Réponse impossible : ${error.message}`);
      return;
    }

    setLink({ ...link, status: decision });
    alert(
      decision === 'accepted'
        ? 'Merci, ta disponibilité a été confirmée ✅'
        : 'Ta réponse “indisponible” a bien été enregistrée 🚫',
    );
  };

  const saveCompensation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compMode || !req) {
      setLastError('Choisis un mode de rémunération.');
      return;
    }
    setIsSaved(false);
    setSavingComp(true);
    setLastError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLastError('Vous devez être connecté pour enregistrer votre rémunération.');
        setSavingComp(false);
        return;
      }

      const res = await fetch('/api/artist/proposals/compensation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          request_id: req.id,
          compensation_mode: compMode,
          compensation_amount: compAmount === '' ? null : Number(compAmount),
          compensation_expenses: compExpenses === '' ? null : Number(compExpenses),
          compensation_organism: compMode === 'cachet' ? compOrganism : null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        throw new Error(j?.error || 'Sauvegarde impossible');
      }
      alert('Rémunération enregistrée ✅');
      setIsSaved(true);
    } catch (e: any) {
      setLastError(e?.message ?? 'Erreur sauvegarde rémunération');
    } finally {
      setSavingComp(false);
    }
  };

  if (loading) return <div className="text-slate-500">Chargement…</div>;

  if (!req) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Demande introuvable</h1>
        {lastError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm whitespace-pre-wrap">
            {lastError}
          </div>
        )}
        <Link href="/dashboard" className="text-[var(--brand)] underline">
          ← Retour au tableau de bord
        </Link>
      </div>
    );
  }

  const alreadyResponded = link?.status === 'accepted' || link?.status === 'declined';
  const markDirty = () => setIsSaved(false);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Demande</h1>
            <div className="text-slate-600">
              <div className="font-medium">{req.title}</div>
              <div>
                {fmtDateFR(req.event_date)} • {statusFR(req.status)}
                {req.start_time ? ` • ${req.start_time}` : ''}
                {typeof req.duration_minutes === 'number' ? ` • ${fmtMinutes(req.duration_minutes)}` : ''}
              </div>
              <div className="flex gap-2 mt-2">
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                  {labelForEventFormat(req.event_format)}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                  {formationLabel(req.formation)}
                </span>
              </div>
            </div>
          </div>
          <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
            ← Retour
          </Link>
        </div>

        {lastError && (
          <div className="mt-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm whitespace-pre-wrap">
            {lastError}
          </div>
        )}
      </header>

      {/* DÉTAILS PRESTATION */}
      <section className="border rounded-2xl p-4 space-y-2">
        <h2 className="text-lg font-semibold">Détails de la prestation</h2>
        <div className="grid sm:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-slate-500">Format</div>
            <div className="font-medium">{labelForEventFormat(req.event_format)}</div>
          </div>
          <div>
            <div className="text-slate-500">Date</div>
            <div className="font-medium">{fmtDateFR(req.event_date)}</div>
          </div>
          <div>
            <div className="text-slate-500">Heure de début</div>
            <div className="font-medium">{req.start_time ?? '—'}</div>
          </div>
          <div>
            <div className="text-slate-500">Durée</div>
            <div className="font-medium">{fmtMinutes(req.duration_minutes)}</div>
          </div>
        </div>
        <div className="mt-2 text-sm text-slate-600">
          Public estimé : <span className="font-medium">{req.audience_size ?? '—'}</span>
        </div>
        {req.notes ? <div className="mt-2 text-sm whitespace-pre-wrap">{req.notes}</div> : null}
      </section>

      {/* Rémunération souhaitée */}
      <section className="border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Rémunération souhaitée</h2>
          <span className="text-xs text-slate-500">
            Définis ton mode et ton montant pour cette demande.
          </span>
        </div>
        <form className="space-y-3" onSubmit={saveCompensation}>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="text-sm font-medium">Mode</label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="compMode"
                value="cachet"
                checked={compMode === 'cachet'}
                onChange={() => {
                  setCompMode('cachet');
                  markDirty();
                }}
              />
              Cachet (via organisme)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="compMode"
                value="facture"
                checked={compMode === 'facture'}
                onChange={() => {
                  setCompMode('facture');
                  markDirty();
                }}
              />
              Facture (artiste / structure)
            </label>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">
                {compMode === 'facture' ? 'Montant facture (TTC)' : 'Cachet net souhaité'}
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full border p-3 rounded-xl"
                value={compAmount}
                onChange={(e) => {
                  setCompAmount(e.target.value);
                  markDirty();
                }}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Défraiement (optionnel)</label>
              <input
                type="number"
                step="0.01"
                className="w-full border p-3 rounded-xl"
                value={compExpenses}
                onChange={(e) => {
                  setCompExpenses(e.target.value);
                  markDirty();
                }}
                placeholder="ex: 50"
              />
            </div>
          </div>

          {compMode === 'cachet' && (
            <div>
              <label className="text-sm font-medium">Organisme souhaité</label>
              <input
                className="w-full border p-3 rounded-xl"
                value={compOrganism}
                onChange={(e) => {
                  setCompOrganism(e.target.value);
                  markDirty();
                }}
                placeholder='ex: "Un Dimanche au Bord de l’Eau"'
              />
            </div>
          )}

          <button
            className={`btn ${isSaved ? 'bg-emerald-600 text-white border-emerald-600' : 'btn-primary'}`}
            type="submit"
            disabled={savingComp || isSaved}
          >
            {savingComp ? 'Enregistrement…' : isSaved ? 'Enregistré ✓' : 'Enregistrer'}
          </button>
        </form>
      </section>

      {/* Carte établissement */}
      {req?.venue_address ? (
        <section className="border rounded-2xl p-4 space-y-2">
          <h2 className="text-lg font-semibold">Localisation</h2>
          <div className="rounded-xl overflow-hidden border">
            <iframe
              className="w-full h-[320px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${encodeURIComponent(req.venue_address)}&output=embed`}
              title="Map établissement"
            />
          </div>
          <div className="text-sm text-slate-600">{req.venue_address}</div>
        </section>
      ) : null}

      {/* Infos établissement */}
      <section className="border rounded-2xl p-4 space-y-2">
        <h2 className="text-lg font-semibold">Établissement</h2>
        <div className="text-sm space-y-1">
          {req.venue_company_name && (
            <div>
              <span className="font-medium">Nom :</span> {req.venue_company_name}
            </div>
          )}
          <div>
            <span className="font-medium">Adresse :</span> {req.venue_address ?? '—'}
          </div>
          <div>
            <span className="font-medium">Contact :</span> {req.venue_contact_name ?? '—'}
          </div>
          <div>
            <span className="font-medium">Email :</span> {req.venue_contact_email ?? '—'}
          </div>
          <div>
            <span className="font-medium">Téléphone :</span> {req.venue_contact_phone ?? '—'}
          </div>
        </div>
      </section>

      {/* Occurrences */}
      <section className="border rounded-2xl p-4 space-y-2">
        <h2 className="text-lg font-semibold">Dates & lieux</h2>
        {occurrences.length === 0 ? (
          <div className="text-sm text-slate-600">Aucune occurrence enregistrée.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {occurrences.map((o) => (
              <li key={o.id} className="border rounded-xl p-3 bg-white">
                <div className="font-medium">{fmtDateFR(o.date)}</div>
                <div className="text-slate-600">
                  {o.start_time || '—'}
                  {typeof o.duration_minutes === 'number'
                    ? ` • ${fmtMinutes(o.duration_minutes)}`
                    : ''}
                </div>
                {o.address_snapshot ? (
                  <div className="text-slate-600">{o.address_snapshot}</div>
                ) : null}
                {o.audience_estimate != null ? (
                  <div className="text-slate-600">Public estimé : {o.audience_estimate}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Réponse artiste */}
      <section id="repondre" className="border rounded-2xl p-4 space-y-3">
        <h2 className="text-lg font-semibold">Ta disponibilité</h2>
        <div className="text-sm text-slate-600">
          Statut de ton invitation : <span className="font-medium">{statusFR(link?.status ?? 'invited')}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-primary disabled:opacity-60"
            onClick={() => respond('accepted')}
            disabled={alreadyResponded || acting !== null}
            title={link?.status ? `Déjà répondu : ${link.status}` : 'Confirmer disponibilité'}
          >
            {acting === 'yes' ? 'Envoi…' : 'Je suis dispo'}
          </button>
          <button
            className="btn disabled:opacity-60"
            onClick={() => respond('declined')}
            disabled={alreadyResponded || acting !== null}
            title={link?.status ? `Déjà répondu : ${link.status}` : 'Indiquer indisponibilité'}
          >
            {acting === 'no' ? 'Envoi…' : 'Je suis indispo'}
          </button>
        </div>

        {link?.status && (
          <div className="text-sm text-slate-600">
            Statut actuel de ta réponse : <strong>{statusFR(link.status)}</strong>
          </div>
        )}
      </section>
    </div>
  );
}
