'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseBrowser';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(session ?? null);

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession ?? null);
      });

      setLoading(false);

      return () => {
        subscription.unsubscribe();
      };
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const isLogged = !!session;

  const logout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navLinks = [
    { href: '/catalogue', label: 'Catalogue' },
    { href: '/how-it-works', label: 'Comment ça marche ?' },
    { href: '/subscribe', label: 'Packs & tarifs' },
  ];

  return (
    <header className="border-b bg-white/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={isLogged ? '/dashboard' : '/catalogue'}
            className="flex items-center gap-2"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-white text-sm font-bold">
              SB
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-semibold">Swing Booking</span>
              <span className="text-[11px] text-slate-500">
                Programmation musicale simplifiée
              </span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-3 text-sm">
            {navLinks.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== '/' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    'px-2 py-1 rounded-full transition ' +
                    (active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
                  }
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <nav className="flex items-center gap-2">
          {loading ? (
            <span className="text-xs text-slate-400">…</span>
          ) : isLogged ? (
            <>
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex items-center text-sm px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50"
              >
                Mon espace
              </Link>
              <button
                onClick={logout}
                className="text-sm px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50"
              >
                Se déconnecter
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50"
              >
                Se connecter
              </Link>
              <Link
                href="/signup"
                className="text-sm px-3 py-1.5 rounded-full bg-[var(--brand)] text-white rounded-full hover:opacity-90"
              >
                Créer un compte
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
