'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type ClientRow = {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_zip: string | null;
  billing_city: string | null;
  billing_country: string | null;
  default_event_address_line1: string | null;
  default_event_address_line2: string | null;
  default_event_zip: string | null;
  default_event_city: string | null;
  default_event_country: string | null;
  notes: string | null;
};

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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

  const [editName, setEditName] = useState('');
  const [editContactName, setEditContactName] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editBillingAddress1, setEditBillingAddress1] = useState('');
  const [editBillingAddress2, setEditBillingAddress2] = useState('');
  const [editBillingZip, setEditBillingZip] = useState('');
  const [editBillingCity, setEditBillingCity] = useState('');
  const [editBillingCountry, setEditBillingCountry] = useState('');
  const [editEventAddress1, setEditEventAddress1] = useState('');
  const [editEventAddress2, setEditEventAddress2] = useState('');
  const [editEventZip, setEditEventZip] = useState('');
  const [editEventCity, setEditEventCity] = useState('');
  const [editEventCountry, setEditEventCountry] = useState('');
  const [editNotes, setEditNotes] = useState('');

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

  function openEdit(client: ClientRow) {
    setEditing(client);
    setEditName(client.name ?? '');
    setEditContactName(client.contact_name ?? '');
    setEditContactEmail(client.contact_email ?? '');
    setEditContactPhone(client.contact_phone ?? '');
    setEditBillingAddress1(client.billing_address_line1 ?? '');
    setEditBillingAddress2(client.billing_address_line2 ?? '');
    setEditBillingZip(client.billing_zip ?? '');
    setEditBillingCity(client.billing_city ?? '');
    setEditBillingCountry(client.billing_country ?? '');
    setEditEventAddress1(client.default_event_address_line1 ?? '');
    setEditEventAddress2(client.default_event_address_line2 ?? '');
    setEditEventZip(client.default_event_zip ?? '');
    setEditEventCity(client.default_event_city ?? '');
    setEditEventCountry(client.default_event_country ?? '');
    setEditNotes(client.notes ?? '');
  }

  function closeEdit() {
    setEditing(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (editName.trim().length < 2) {
      setError('Nom requis (2 caracteres min).');
      return;
    }
    try {
      setSavingEdit(true);
      setError(null);
      const res = await fetch(`/api/admin/clients/${editing.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          contact_name: editContactName,
          contact_email: editContactEmail,
          contact_phone: editContactPhone,
          billing_address_line1: editBillingAddress1,
          billing_address_line2: editBillingAddress2,
          billing_zip: editBillingZip,
          billing_city: editBillingCity,
          billing_country: editBillingCountry,
          default_event_address_line1: editEventAddress1,
          default_event_address_line2: editEventAddress2,
          default_event_zip: editEventZip,
          default_event_city: editEventCity,
          default_event_country: editEventCountry,
          notes: editNotes,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Modification impossible');
      closeEdit();
      await loadClients();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la modification');
    } finally {
      setSavingEdit(false);
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
                {c.default_event_city || '—'}
                {c.contact_email ? ` • ${c.contact_email}` : ''}
              </div>
              <div className="text-xs text-slate-400">{c.id}</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn" onClick={() => openEdit(c)}>
                Modifier
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Modifier un client</h3>
              <button className="text-sm underline" onClick={closeEdit}>
                Fermer
              </button>
            </div>
            <form onSubmit={saveEdit} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Nom du client"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Contact (nom)"
                  value={editContactName}
                  onChange={(e) => setEditContactName(e.target.value)}
                />
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Contact email"
                  value={editContactEmail}
                  onChange={(e) => setEditContactEmail(e.target.value)}
                />
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Contact téléphone"
                  value={editContactPhone}
                  onChange={(e) => setEditContactPhone(e.target.value)}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Adresse facturation ligne 1"
                  value={editBillingAddress1}
                  onChange={(e) => setEditBillingAddress1(e.target.value)}
                />
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Adresse facturation ligne 2"
                  value={editBillingAddress2}
                  onChange={(e) => setEditBillingAddress2(e.target.value)}
                />
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Code postal facturation"
                  value={editBillingZip}
                  onChange={(e) => setEditBillingZip(e.target.value)}
                />
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Ville facturation"
                  value={editBillingCity}
                  onChange={(e) => setEditBillingCity(e.target.value)}
                />
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Pays facturation"
                  value={editBillingCountry}
                  onChange={(e) => setEditBillingCountry(e.target.value)}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Adresse evenement ligne 1"
                  value={editEventAddress1}
                  onChange={(e) => setEditEventAddress1(e.target.value)}
                />
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Adresse evenement ligne 2"
                  value={editEventAddress2}
                  onChange={(e) => setEditEventAddress2(e.target.value)}
                />
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Code postal evenement"
                  value={editEventZip}
                  onChange={(e) => setEditEventZip(e.target.value)}
                />
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Ville evenement"
                  value={editEventCity}
                  onChange={(e) => setEditEventCity(e.target.value)}
                />
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Pays evenement"
                  value={editEventCountry}
                  onChange={(e) => setEditEventCountry(e.target.value)}
                />
              </div>

              <textarea
                className="border rounded-lg px-3 py-2 min-h-[100px]"
                placeholder="Notes internes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />

              <div className="flex justify-end gap-2">
                <button type="button" className="btn" onClick={closeEdit} disabled={savingEdit}>
                  Annuler
                </button>
                <button className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
