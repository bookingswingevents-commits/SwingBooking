'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseBrowser';

type ClientRow = {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
};

export default function AdminClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingNotes, setEditingNotes] = useState('');

  async function loadClients() {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (prof?.role !== 'admin') {
        setError('Acces refuse (admin requis).');
        setLoading(false);
        return;
      }
      const { data, error: selErr } = await supabase
        .from('clients')
        .select('id, name, notes, created_at')
        .order('created_at', { ascending: false });
      if (selErr) throw selErr;
      setClients((data as ClientRow[]) ?? []);
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
    if (!newName.trim()) return;
    try {
      setSaving(true);
      const { error: insErr } = await supabase
        .from('clients')
        .insert({ name: newName.trim(), notes: newNotes.trim() || null });
      if (insErr) throw insErr;
      setNewName('');
      setNewNotes('');
      await loadClients();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la creation');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(c: ClientRow) {
    setEditingId(c.id);
    setEditingName(c.name);
    setEditingNotes(c.notes ?? '');
  }

  async function saveEdit() {
    if (!editingId) return;
    try {
      setSaving(true);
      const { error: upErr } = await supabase
        .from('clients')
        .update({ name: editingName.trim(), notes: editingNotes.trim() || null })
        .eq('id', editingId);
      if (upErr) throw upErr;
      setEditingId(null);
      await loadClients();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la mise a jour');
    } finally {
      setSaving(false);
    }
  }

  async function deleteClient(id: string) {
    if (!window.confirm('Supprimer ce client ?')) return;
    try {
      setSaving(true);
      const { error: delErr } = await supabase.from('clients').delete().eq('id', id);
      if (delErr) throw delErr;
      await loadClients();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la suppression');
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
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Notes internes (optionnel)"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
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
          <div key={c.id} className="rounded-xl border p-4 flex flex-col gap-3">
            {editingId === c.id ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="border rounded-lg px-3 py-2"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                  />
                  <input
                    className="border rounded-lg px-3 py-2"
                    value={editingNotes}
                    onChange={(e) => setEditingNotes(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                    Enregistrer
                  </button>
                  <button className="btn" type="button" onClick={() => setEditingId(null)}>
                    Annuler
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    {c.notes ? <div className="text-sm text-slate-500">{c.notes}</div> : null}
                  </div>
                  <div className="flex gap-2">
                    <button className="btn" onClick={() => startEdit(c)}>
                      Modifier
                    </button>
                    <button className="btn" onClick={() => deleteClient(c.id)}>
                      Supprimer
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
