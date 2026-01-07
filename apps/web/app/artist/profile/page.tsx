import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import ArtistProfileClient from './profile-client';

export default async function ArtistProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userRes.user.id)
    .maybeSingle();

  if (profile?.role !== 'artist') {
    redirect('/dashboard');
  }

  return <ArtistProfileClient />;
}
