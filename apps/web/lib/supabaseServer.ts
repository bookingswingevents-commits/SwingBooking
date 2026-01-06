// apps/web/lib/supabaseServer.ts
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// Supabase SSR client wired to Next.js cookies (required for API auth).
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...(options as CookieOptions) });
          });
        },
      },
    }
  );
}

export async function getAdminAuth(
  supabaseClient?: Awaited<ReturnType<typeof createSupabaseServerClient>>
) {
  const supabase = supabaseClient ?? (await createSupabaseServerClient());
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null, isAdmin: false, errorCode: 'NO_USER' as const };
  }

  const metaRole = (user.user_metadata as { role?: string } | null)?.role ?? null;
  let profileRole: string | null = null;

  try {
    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profErr) {
      // Table absente ou autre erreur: fallback sur metadata
      profileRole = null;
    } else {
      profileRole = (prof?.role as string | null) ?? null;
    }
  } catch {
    profileRole = null;
  }

  const isAdmin = profileRole === 'admin' || metaRole === 'admin';
  if (!isAdmin) {
    return { supabase, user, isAdmin: false, errorCode: 'NOT_ADMIN' as const };
  }

  return { supabase, user, isAdmin: true, errorCode: null };
}
