// apps/web/lib/artistIdentity.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type ArtistIdentity = {
  userId: string;
  email: string | null;
  artistId: string | null;
  error: string | null;
};

export async function getArtistIdentity(supabase: SupabaseClient): Promise<ArtistIdentity> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { userId: '', email: null, artistId: null, error: 'NOT_AUTHENTICATED' };
  }

  const userId = user.id;
  const email = user.email ?? null;

  const { data: byUserId } = await supabase
    .from('artists')
    .select('id, user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (byUserId?.id) {
    return { userId, email, artistId: byUserId.id, error: null };
  }

  const { data: byId } = await supabase
    .from('artists')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (byId?.id) {
    return { userId, email, artistId: byId.id, error: null };
  }

  if (email) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();
    if (prof?.id) {
      const { data: byProfileId } = await supabase
        .from('artists')
        .select('id')
        .eq('id', prof.id)
        .maybeSingle();
      if (byProfileId?.id) {
        return { userId, email, artistId: byProfileId.id, error: null };
      }
    }
  }

  return { userId, email, artistId: null, error: 'ARTIST_NOT_LINKED' };
}
