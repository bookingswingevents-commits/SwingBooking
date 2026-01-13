import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

type SendEmailArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export async function sendEmail({ to, subject, html, text, replyTo }: SendEmailArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY manquante');
  }

  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM || 'Swing Booking <no-reply@app.swingbooking.fr>';
  const finalReplyTo = replyTo || process.env.EMAIL_REPLY_TO || undefined;

  return resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
    replyTo: finalReplyTo,
  });
}

type SendOnceArgs = SendEmailArgs & {
  eventKey: string;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
};

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Variables d'environnement manquantes: ${name}`);
  return v;
}

export async function sendEmailOnce({
  eventKey,
  eventType,
  entityType,
  entityId,
  ...args
}: SendOnceArgs) {
  const supabase = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: logErr } = await supabase
    .from('email_logs')
    .insert({
      event_key: eventKey,
      event_type: eventType,
      to_email: Array.isArray(args.to) ? args.to.join(',') : args.to,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
    });

  if (logErr) {
    if ((logErr as any)?.code === '23505') {
      return { sent: false, skipped: true };
    }
    throw logErr;
  }

  try {
    await sendEmail(args);
    return { sent: true, skipped: false };
  } catch (e: any) {
    await supabase.from('email_logs').delete().eq('event_key', eventKey);
    throw e;
  }
}
