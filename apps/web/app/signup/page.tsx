'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseBrowser';

type Role = 'artist' | 'venue';

/** Champ mot de passe avec bouton Afficher / Masquer */
function PasswordInput({
  value,
  onChange,
  name = 'password',
}: {
  value: string;
  onChange: (v: string) => void;
  name?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="text-sm font-medium" htmlFor={name}>
        Mot de passe
      </label>
      <div className="relative mt-1">
        <input
          id={name}
          name={name}
          type={visible ? 'text' : 'password'}
          className="w-full border p-3 rounded-xl pr-20"
          required
          minLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 px-3 text-xs text-slate-500 hover:text-slate-800"
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          {visible ? 'Masquer' : 'Afficher'}
        </button>
      </div>
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('artist');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    setDone(false);

    try {
      // 1) Création du compte Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Même si la redirection existe, Supabase ne forcera plus
          // l'envoi de mail si tu as désactivé la confirmation dans le dashboard.
          emailRedirectTo: `${appUrl}/login`,
          data: { role, full_name: fullName || null },
        },
      });
      if (error) throw error;

      const user = data.user;
      const uid = user?.id;

      // 2) Créer / mettre à jour le profil dans "profiles" si on a déjà l'ID
      if (uid) {
        const { error: profErr } = await supabase.from('profiles').upsert({
          id: uid,
          email,
          role,
          full_name: fullName || null,
        });
        if (profErr) {
          console.error('Erreur création profil:', profErr);
          // On n'empêche pas forcément le login pour un simple souci de profil,
          // mais on remonte l'info.
          throw profErr;
        }

        // 3) Si artiste → créer la fiche artiste minimale
        if (role === 'artist') {
          const { error: artErr } = await supabase
            .from('artists')
            .insert({ id: uid, stage_name: fullName || null, is_active: false });

          // On ignore l'erreur "doublon" si jamais la fiche existe déjà
          // @ts-ignore
          if (artErr && artErr.code !== '23505') {
            console.error('Erreur création artiste:', artErr);
            throw artErr;
          }
        }
      }

      setMsg(
        `🎉 Compte créé pour ${
          role === 'artist' ? "l’artiste" : "l’établissement"
        } !\nTu peux maintenant te connecter avec ${email}.`
      );
      setDone(true);

      // Redirection douce possible
      // setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      console.error('Signup error:', err);
      setMsg('❌ Erreur : ' + (err?.message ?? 'inconnue'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-10 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Créer un compte</h1>
        <p className="text-slate-600">Choisis ton rôle et finalise ton inscription.</p>
      </header>

      {msg && (
        <div
          className={`p-4 rounded-lg border text-sm whitespace-pre-wrap ${
            done
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'border-slate-200 bg-white'
          }`}
        >
          {msg}
        </div>
      )}

      {!done && (
        <form onSubmit={submit} className="space-y-4">
          {/* Choix du rôle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`p-3 rounded-xl border text-left ${
                role === 'artist' ? 'border-[var(--brand)]' : 'border-slate-200'
              }`}
              onClick={() => setRole('artist')}
            >
              Je suis <strong>Artiste</strong>
              <div className="text-xs text-slate-500">
                Crée ton profil et reçois des invitations
              </div>
            </button>
            <button
              type="button"
              className={`p-3 rounded-xl border text-left ${
                role === 'venue' ? 'border-[var(--brand)]' : 'border-slate-200'
              }`}
              onClick={() => setRole('venue')}
            >
              Je suis <strong>Établissement</strong>
              <div className="text-xs text-slate-500">
                Demande une prestation depuis le catalogue
              </div>
            </button>
          </div>

          {/* Nom complet */}
          <div>
            <label className="text-sm font-medium">Nom complet (optionnel)</label>
            <input
              className="w-full border p-3 rounded-xl"
              placeholder="Prénom Nom"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              className="w-full border p-3 rounded-xl"
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Mot de passe avec bouton afficher/masquer */}
          <PasswordInput value={password} onChange={setPassword} />

          <button className="btn btn-primary w-full" disabled={submitting}>
            {submitting ? 'Création…' : 'Créer mon compte'}
          </button>

          <div className="text-sm text-center">
            Déjà un compte ?{' '}
            <a className="text-[var(--brand)] underline" href="/login">
              Se connecter
            </a>
          </div>
        </form>
      )}
    </div>
  );
}
