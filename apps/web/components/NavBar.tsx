'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseBrowser';

type Profile = { id: string; role: 'admin' | 'venue' | 'artist'; full_name?: string | null };

export default function NavBar() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(session);
      if (session?.user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('id, role, full_name')
          .eq('id', session.user.id)
          .maybeSingle();
        setProfile((data as Profile) ?? null);
      }
    })();
    return () => { alive = false; };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <header className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-bold">SwingBooking</Link>
          <Link href="/catalogue" className="text-sm hover:underline">Catalogue</Link>
          {/* raccourci neutre et stable */}
          <Link href="/dashboard" className="text-sm hover:underline">Dashboard</Link>
        </div>

        <div className="flex items-center gap-3">
          {session ? (
            <>
              <span className="text-sm text-slate-600">
                {profile?.full_name || 'Connecté'}{profile?.role ? ` • ${profile.role}` : ''}
              </span>
              {profile?.role === 'admin' ? (
                <Link
                  href="/admin/programmations"
                  className="px-3 py-1 rounded-lg border hover:bg-slate-50 text-sm"
                >
                  📅 Programmations
                </Link>
              ) : null}
              {profile?.role === 'artist' ? (
                <Link
                  href="/artist/programmations"
                  className="px-3 py-1 rounded-lg border hover:bg-slate-50 text-sm"
                >
                  📅 Programmations
                </Link>
              ) : null}
              {/* Toujours /dashboard pour “Mon espace” */}
              <Link href="/dashboard" className="px-3 py-1 rounded-lg border hover:bg-slate-50 text-sm">
                Mon espace
              </Link>
              <button
                onClick={logout}
                className="px-3 py-1 rounded-lg bg-[var(--brand,#0a3440)] text-white text-sm hover:brightness-110"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <Link href="/login" className="px-3 py-1 rounded-lg border hover:bg-slate-50 text-sm">
              Se connecter
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
