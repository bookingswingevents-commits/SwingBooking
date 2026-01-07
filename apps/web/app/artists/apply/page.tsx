import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

export default async function ArtistApplyPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (data?.user) {
    redirect('/artist/profile');
  }
  redirect('/signup');
}
