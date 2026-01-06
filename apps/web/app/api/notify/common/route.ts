import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY!);

// ⚠ service role côté serveur uniquement
const supabaseSrv = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { to_user_ids, subject, html, kind, meta } = await req.json();

    if (!Array.isArray(to_user_ids) || to_user_ids.length === 0) {
      return NextResponse.json({ ok: false, error: 'to_user_ids required' }, { status: 400 });
    }

    const { data: users, error } = await supabaseSrv
      .from('profiles')
      .select('id, email, full_name')
      .in('id', to_user_ids);

    if (error) throw error;

    const from = process.env.EMAIL_FROM || 'Swing Booking <noreply@swingbooking.com>';
    const sent = [];

    for (const u of users ?? []) {
      if (!u?.email) continue;
      await resend.emails.send({ from, to: u.email, subject, html });
      sent.push(u.id);
      await supabaseSrv.from('notifications').insert({
        user_id: u.id,
        type: kind ?? 'custom',
        payload: meta ?? {},
      });
    }

    return NextResponse.json({ ok: true, sent: sent.length });
  } catch (e: any) {
    console.error('notify/common error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown' }, { status: 500 });
  }
}
