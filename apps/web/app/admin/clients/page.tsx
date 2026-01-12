'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type ClientRow = {
  id: string;
  name: string;
  contact_email: string | null;
  default_event_city: string | null;
};

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [billingAddress1, setBillingAddress1] = useState('');
  const [billingAddress2, setBillingAddress2] = useState('');
  const [billingZip, setBillingZip] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingCountry, setBillingCountry] = useState('');
  const [eventAddress1, setEventAddress1] = useState('');
  const [eventAddress2, setEventAddress2] = useState('');
  const [eventZip, setEventZip] = useState('');
  const [eventCity, setEventCity] = useState('');
  const [eventCountry, setEventCountry] = useState('');
  const [notes, setNotes] = useState('');

  async function loadClients() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/clients', { credentials: 'include' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Erreur de chargement');
      setClients((json.clients as ClientRow[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Nom requis (2 caracteres min).');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          contact_name: contactName,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          billing_address_line1: billingAddress1,
          billing_address_line2: billingAddress2,
          billing_zip: billingZip,
          billing_city: billingCity,
          billing_country: billingCountry,
          default_event_address_line1: eventAddress1,
          default_event_address_line2: eventAddress2,
          default_event_zip: eventZip,
          default_event_city: eventCity,
          default_event_country: eventCountry,
          notes,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Creation impossible');
      setName('');
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setBillingAddress1('');
      setBillingAddress2('');
      setBillingZip('');
      setBillingCity('');
      setBillingCountry('');
      setEventAddress1('');
      setEventAddress2('');
      setEventZip('');
      setEventCity('');
      setEventCountry('');
      setNotes('');
      await loadClients();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la creation');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-slate-500">Chargement…</div>;
  if (error) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Clients</h1>
        <p className="text-red-600">{error}</p>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-slate-600 text-sm">Hotels, lieux et partenaires de residence.</p>
        </div>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </header>

      <form onSubmit={createClient} className="rounded-xl border p-4 space-y-4 bg-white">
        <h2 className="font-semibold">Nouveau client</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Nom du client"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Contact (nom)"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Contact email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Contact téléphone"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Adresse facturation ligne 1"
            value={billingAddress1}
            onChange={(e) => setBillingAddress1(e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Adresse facturation ligne 2"
            value={billingAddress2}
            onChange={(e) => setBillingAddress2(e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Code postal facturation"
            value={billingZip}
            onChange={(e) => setBillingZip(e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Ville facturation"
            value={billingCity}
            onChange={(e) => setBillingCity(e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Pays facturation"
            value={billingCountry}
            onChange={(e) => setBillingCountry(e.target.value)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Adresse evenement ligne 1"
            value={eventAddress1}
            onChange={(e) => setEventAddress1(e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Adresse evenement ligne 2"
            value={eventAddress2}
            onChange={(e) => setEventAddress2(e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Code postal evenement"
            value={eventZip}
            onChange={(e) => setEventZip(e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Ville evenement"
            value={eventCity}
            onChange={(e) => setEventCity(e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Pays evenement"
            value={eventCountry}
            onChange={(e) => setEventCountry(e.target.value)}
          />
        </div>

        <textarea
          className="border rounded-lg px-3 py-2 min-h-[100px]"
          placeholder="Notes internes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <button className="btn btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Ajouter'}
        </button>
      </form>

      <div className="space-y-3">
        {clients.length === 0 ? (
          <div className="text-sm text-slate-500">Aucun client pour le moment.</div>
        ) : null}
        {clients.map((c) => (
          <div key={c.id} className="rounded-xl border p-4 flex items-center justify-between gap-4 bg-white">
            <div>
              <div className="font-semibold">{c.name}</div>
              <div className="text-sm text-slate-500">
                {c.default_event_city || '—'}{c.contact_email ? ` • ${c.contact_email}` : ''}
              </div>
            </div>
            <div className="text-xs text-slate-400">{c.id}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
