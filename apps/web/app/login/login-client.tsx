'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseBrowser';

export default function LoginClientPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Vérifie et crée la ligne artiste manquante
  const ensureArtistRow = async (uid: string) => {
    const { data: exists, error: selErr } = await supabase
      .from('artists')
      .select('id')
      .eq('id', uid)
      .maybeSingle();
    if (selErr) {
      console.error('artists select error:', selErr.message);
      return;
    }
    if (exists) return;

    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email || '';
    const meta = session?.user?.user_metadata || {};
    const fullName = (meta.full_name as string) || '';
    const metaStage = (meta.stage_name as string) || '';

    const fallbackStage =
      metaStage.trim() ||
      fullName.trim() ||
      (userEmail ? userEmail.split('@')[0] : '') ||
      `Artiste-${uid.slice(0, 8)}`;

    const { error: insErr } = await supabase
      .from('artists')
      .insert({ id: uid, stage_name: fallbackStage, is_active: true });

    if (insErr) {
      console.error('artists insert error:', insErr.code, insErr.message);
    }
  };

  // Synchronise le rôle du profil
  const syncProfileRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    type Role = 'artist' | 'venue' | 'admin';

    const uid = session.user.id;
    const metaRole =
      (session.user.user_metadata?.role as Role | undefined) || null;
    const fullName = (session.user.user_metadata?.full_name as string | undefined) || null;
    const emailVal = session.user.email || null;
    const emailLower = (session.user.email || '').toLowerCase();
    const inferredEmailRole = emailLower.startsWith('admin@')
      ? 'admin'
      : emailLower.startsWith('artist@')
      ? 'artist'
      : null;

    const { data: prof, error: profSelErr } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', uid)
      .maybeSingle();
    if (profSelErr) {
      console.error('profiles select error:', profSelErr.message);
    }

    const existingRole = (prof?.role as Role | null) ?? null;
    const effectiveRole =
      inferredEmailRole ||
      metaRole ||
      existingRole ||
      'venue';

    if (!prof) {
      const { error: insErr } = await supabase.from('profiles').insert({
        id: uid,
        email: emailVal,
        role: effectiveRole,
        full_name: fullName,
      });
      if (insErr) console.error('profiles insert error:', insErr.message);
      return effectiveRole;
    }

    if (effectiveRole && existingRole !== effectiveRole) {
      const { error: upErr } = await supabase
        .from('profiles')
        .update({ role: effectiveRole })
        .eq('id', uid);
      if (upErr) console.error('profiles update error:', upErr.message);
    }
    return effectiveRole;
  };

  // ✅ Redirection unique vers /dashboard
  const goToDashboard = async () => {
    try {
      const role = await syncProfileRole();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const uid = session.user.id;
      if (role === 'artist') await ensureArtistRow(uid);

      if (role === 'artist') {
        router.push('/artist/profile');
      } else {
        router.push('/dashboard');
      }
    } catch (e) {
      console.error('Erreur redirection dashboard:', e);
      router.push('/dashboard');
    }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setMsg('Connexion impossible : ' + error.message);
      return;
    }
    await goToDashboard();
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await goToDashboard();
    })();
  }, []);

  return (
    <div className="max-w-md mx-auto py-10 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Connexion</h1>
        <p className="text-slate-600">Accède à ton espace Swing Booking.</p>
      </header>

      {msg && (
        <div className="p-3 rounded-lg border text-sm whitespace-pre-wrap bg-red-50 border-red-200 text-red-700">
          {msg}
        </div>
      )}

      <form onSubmit={signIn} className="space-y-4">
        <div>
          <label className="text-sm font-medium" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="w-full border p-3 rounded-xl"
            type="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="login-password">
            Mot de passe
          </label>
          <div className="relative">
            <input
              id="login-password"
              className="w-full border p-3 rounded-xl pr-12"
              type={showPwd ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm underline"
              aria-label={showPwd ? 'Masquer' : 'Afficher'}
            >
              {showPwd ? 'Masquer' : 'Afficher'}
            </button>
          </div>
        </div>

        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>

        <div className="text-sm text-center">
          Pas encore de compte ?{' '}
          <a className="text-[var(--brand)] underline" href="/signup">
            Créer un compte
          </a>
        </div>
      </form>
    </div>
  );
}
