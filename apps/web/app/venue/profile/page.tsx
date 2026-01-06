'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseBrowser';

export default function VenueProfilePage() {
  const router = useRouter();
  const topRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const uid = session.user.id;

      const { data, error } = await supabase
        .from('venues')
        .select('company_name, contact_name, billing_email, contact_phone, address_line1, address_line2, postal_code, city, vat_number, notes, is_active')
        .eq('id', uid)
        .maybeSingle();

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }
      if (data) {
        setExists(true);
        setCompanyName(data.company_name ?? '');
        setContactName(data.contact_name ?? '');
        setBillingEmail(data.billing_email ?? (session.user.email ?? ''));
        setContactPhone(data.contact_phone ?? '');
        setAddress1(data.address_line1 ?? '');
        setAddress2(data.address_line2 ?? '');
        setPostalCode(data.postal_code ?? '');
        setCity(data.city ?? '');
        setVatNumber(data.vat_number ?? '');
        setNotes(data.notes ?? '');
      } else {
        // préremplir l’email avec l’email du compte
        setBillingEmail(session.user.email ?? '');
        setExists(false);
      }

      setLoading(false);
    })();
  }, [router]);

  const completion = (() => {
    const checks = [
      !!companyName.trim(),
      !!billingEmail.trim(),
      !!address1.trim(),
      !!postalCode.trim(),
      !!city.trim(),
      !!contactName.trim(),
      !!contactPhone.trim(),
    ];
    const percent = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    return percent;
  })();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setErr(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    const uid = session.user.id;

    const payload = {
      id: uid,
      company_name: companyName || null,
      contact_name: contactName || null,
      billing_email: billingEmail || null,
      contact_phone: contactPhone || null,
      address_line1: address1 || null,
      address_line2: address2 || null,
      postal_code: postalCode || null,
      city: city || null,
      vat_number: vatNumber || null,
      notes: notes || null,
      is_active: true,
    };

    const q = exists
      ? supabase.from('venues').update(payload).eq('id', uid)
      : supabase.from('venues').insert(payload);

    const { error } = await q;
    setSaving(false);

    if (error) {
      setErr('Erreur : ' + error.message);
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setExists(true);
    setMsg('Profil établissement enregistré ✅');
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading) return <div className="text-slate-500">Chargement…</div>;

  return (
    <div ref={topRef} className="max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Mon profil établissement</h1>
        <p className="text-slate-600">Ces informations seront utilisées pour pré-remplir vos demandes et factures.</p>
      </header>

      {/* messages */}
      {err && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{err}</div>}
      {msg && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">{msg}</div>}

      {/* progression */}
      <div className="rounded-xl border p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-slate-600">Complétion du profil</div>
          <div className="font-semibold">{completion}%</div>
        </div>
        <div className="w-full h-2 rounded bg-slate-100 overflow-hidden">
          <div className="h-2 bg-[var(--accent)]" style={{ width: `${completion}%`, transition: 'width .4s ease' }} />
        </div>
      </div>

      <form onSubmit={save} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Nom établissement / Société</label>
            <input className="w-full border p-3 rounded-xl" value={companyName} onChange={e => setCompanyName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Nom du contact</label>
            <input className="w-full border p-3 rounded-xl" value={contactName} onChange={e => setContactName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Email de facturation</label>
            <input className="w-full border p-3 rounded-xl" type="email" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Téléphone</label>
            <input className="w-full border p-3 rounded-xl" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+33 6 xx xx xx xx" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Adresse</label>
            <input className="w-full border p-3 rounded-xl" value={address1} onChange={e => setAddress1(e.target.value)} placeholder="N°, Rue" />
          </div>
          <div>
            <label className="text-sm font-medium">Complément d’adresse</label>
            <input className="w-full border p-3 rounded-xl" value={address2} onChange={e => setAddress2(e.target.value)} placeholder="Bâtiment, étage…" />
          </div>
          <div>
            <label className="text-sm font-medium">Code postal</label>
            <input className="w-full border p-3 rounded-xl" value={postalCode} onChange={e => setPostalCode(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Ville</label>
            <input className="w-full border p-3 rounded-xl" value={city} onChange={e => setCity(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">N° TVA (optionnel)</label>
            <input className="w-full border p-3 rounded-xl" value={vatNumber} onChange={e => setVatNumber(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Notes (optionnel)</label>
            <textarea className="w-full border p-3 rounded-xl min-h-[100px]" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Infos d’accès, consignes, etc." />
          </div>
        </div>

        <div className="flex justify-end">
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </div>
  );
}
