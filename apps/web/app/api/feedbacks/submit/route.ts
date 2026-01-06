import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseSrv = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { request_id, rating, comment, author_role } = await req.json(); // author_role: 'artist' | 'venue'

    if (!request_id || !rating) {
      return NextResponse.json({ ok: false, error: 'Paramètres manquants' }, { status: 400 });
    }

    await supabaseSrv.from('feedbacks').insert({
      request_id,
      rating,
      comment: comment || null,
      author_role: author_role === 'artist' ? 'artist' : 'venue',
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('feedbacks/submit error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown' }, { status: 500 });
  }
}
