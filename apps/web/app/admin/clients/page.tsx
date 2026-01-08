'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type ClientRow = {
  id: string;
  name: string;
};

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

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
    if (newName.trim().length < 2) {
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
        body: JSON.stringify({ name: newName.trim() }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Creation impossible');
      setNewName('');
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
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-slate-600 text-sm">Hotels, lieux et partenaires de residence.</p>
        </div>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </header>

      <form onSubmit={createClient} className="rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold">Nouveau client</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Nom du client"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Ajouter'}
        </button>
      </form>

      <div className="space-y-3">
        {clients.length === 0 ? (
          <div className="text-sm text-slate-500">Aucun client pour le moment.</div>
        ) : null}
        {clients.map((c) => (
          <div key={c.id} className="rounded-xl border p-4 flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-slate-500">{c.id}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
