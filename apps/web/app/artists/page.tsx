import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';

export default async function ArtistsCataloguePage() {
  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);

  if (!user) {
    redirect('/login');
  }

  if (!isAdmin) {
    redirect('/');
  }

  redirect('/admin/artists');
}
