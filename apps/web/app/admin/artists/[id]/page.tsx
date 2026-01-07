import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import AdminArtistApplicationDetail from './detail-client';

export default async function AdminArtistApplicationPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) redirect('/dashboard');

  return <AdminArtistApplicationDetail id={params.id} />;
}
