import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import AdminArtistApplicationsList from './list-client';

export default async function AdminArtistApplicationsPage() {
  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) redirect('/dashboard');

  return <AdminArtistApplicationsList />;
}
