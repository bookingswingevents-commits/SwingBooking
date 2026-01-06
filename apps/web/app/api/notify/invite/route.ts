// apps/web/app/api/notify/invite/route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY!);

// ⚠️ SERVICE ROLE côté serveur UNIQUEMENT
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const { request_id, artist_ids } = (await req.json()) as {
      request_id: string;
      artist_ids: string[];
    };

    if (!request_id || !Array.isArray(artist_ids) || artist_ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Paramètres manquants (request_id, artist_ids[])' },
        { status: 400 }
      );
    }

    // Récup demande
    const { data: br, error: brErr } = await supabase
      .from('booking_requests')
      .select('id, title, event_date, venue_address')
      .eq('id', request_id)
      .maybeSingle();

    if (brErr) throw new Error(`Erreur lecture demande: ${brErr.message}`);
    if (!br) throw new Error('Demande introuvable');

    // Récup emails des artistes (via profiles)
    const { data: profs, error: pErr } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', artist_ids);

    if (pErr) throw new Error(`Erreur lecture profils: ${pErr.message}`);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const from =
      process.env.EMAIL_FROM ||
      'Swing Booking <noreply@swingbooking.com>';

    const toSend = (profs ?? []).filter(p => !!p.email);

    // Envoi en parallèle (best effort)
    await Promise.all(
      toSend.map(p =>
        resend.emails.send({
          from,
          to: p!.email!,
          subject: `Nouvelle invitation : ${br.title}`,
          html: `
            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
              <p>Bonjour ${p?.full_name ?? ''},</p>
              <p>Tu as reçu une invitation pour <strong>${br.title}</strong>.</p>
              <ul>
                <li><strong>Date :</strong> ${br.event_date ?? '—'}</li>
                <li><strong>Lieu :</strong> ${br.venue_address ?? '—'}</li>
              </ul>
              <p>
                Réponds depuis ton espace Swing Booking :
                <a href="${baseUrl}/login">Se connecter</a>
              </p>
              <p style="color:#64748b;font-size:12px;margin-top:24px">
                — L’équipe Swing Booking
              </p>
            </div>
          `,
        })
      )
    );

    return NextResponse.json({ ok: true, sent: toSend.length });
  } catch (e: any) {
    console.error('[notify/invite] error', e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'unknown' },
      { status: 500 }
    );
  }
}
