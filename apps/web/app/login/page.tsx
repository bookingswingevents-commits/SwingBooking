import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import LoginClientPage from './login-client';

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return <LoginClientPage />;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userRes.user.id)
    .maybeSingle();

  if (profile?.role === 'artist') {
    redirect('/artist/profile');
  }

  redirect('/dashboard');
}
