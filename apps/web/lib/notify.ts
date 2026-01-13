import { sendEmailOnce } from '@/lib/email';
import {
  artistAppliedAdmin,
  bookingConfirmedArtist,
  bookingConfirmedClient,
  bookingDeclinedArtist,
  invitationArtist,
  runSheetReady,
  signupConfirmation,
  emailFormatters,
} from '@/lib/emailTemplates';

type SendContext = {
  event: string;
  to?: string | string[];
  entity_id?: string;
};

async function safeSend(
  ctx: SendContext,
  payload: {
    to: string | string[];
    subject: string;
    html: string;
    text: string;
    eventKey: string;
    eventType: string;
    entityType?: string | null;
    entityId?: string | null;
  }
) {
  try {
    const { eventKey, eventType, entityType, entityId, ...email } = payload;
    await sendEmailOnce({ eventKey, eventType, entityType, entityId, ...email });
  } catch (e: any) {
    console.error('[email]', { ...ctx, error: e?.message ?? e });
  }
}

export async function notifySignupConfirmation(args: {
  to: string;
  userId: string;
  toName?: string | null;
}) {
  const tpl = signupConfirmation(args.toName);
  await safeSend(
    { event: 'signup_confirmation', to: args.to, entity_id: args.userId },
    {
      to: args.to,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      eventKey: `signup:${args.userId}`,
      eventType: 'signup',
      entityType: 'profile',
      entityId: args.userId,
    }
  );
}

export async function notifyInvitationArtist(args: {
  to: string;
  invitationId: string;
  artistName?: string | null;
  title: string;
  date?: string | null;
  ctaUrl: string;
}) {
  const tpl = invitationArtist({
    artistName: args.artistName,
    title: args.title,
    dateFR: args.date ? emailFormatters.formatDateFRLong(args.date) : undefined,
    ctaUrl: args.ctaUrl,
  });
  await safeSend(
    { event: 'invitation_artist', to: args.to, entity_id: args.invitationId },
    {
      to: args.to,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      eventKey: `invitation:${args.invitationId}`,
      eventType: 'invitation',
      entityType: 'residency_invitation',
      entityId: args.invitationId,
    }
  );
}

export async function notifyArtistAppliedAdmin(args: {
  to: string;
  artistName: string;
  title: string;
  date?: string | null;
  adminUrl: string;
  eventKey: string;
  residencyId?: string | null;
}) {
  const tpl = artistAppliedAdmin({
    artistName: args.artistName,
    title: args.title,
    dateFR: args.date ? emailFormatters.formatDateFRLong(args.date) : undefined,
    adminUrl: args.adminUrl,
  });
  await safeSend(
    { event: 'artist_applied_admin', to: args.to, entity_id: args.residencyId ?? undefined },
    {
      to: args.to,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      eventKey: args.eventKey,
      eventType: 'artist_apply',
      entityType: 'residency',
      entityId: args.residencyId ?? null,
    }
  );
}

export async function notifyBookingConfirmedArtist(args: {
  to: string;
  eventKey: string;
  artistName?: string | null;
  title: string;
  date: string;
  address?: string | null;
  fee?: string | null;
  ctaUrl: string;
  entityId?: string | null;
}) {
  const tpl = bookingConfirmedArtist({
    artistName: args.artistName,
    title: args.title,
    dateFR: emailFormatters.formatDateFRLong(args.date),
    address: args.address,
    fee: args.fee,
    ctaUrl: args.ctaUrl,
  });
  await safeSend(
    { event: 'booking_confirmed_artist', to: args.to, entity_id: args.entityId ?? undefined },
    {
      to: args.to,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      eventKey: args.eventKey,
      eventType: 'booking_confirmed',
      entityType: 'proposal',
      entityId: args.entityId ?? null,
    }
  );
}

export async function notifyBookingConfirmedClient(args: {
  to: string;
  eventKey: string;
  clientName?: string | null;
  title: string;
  date: string;
  address?: string | null;
  artistNames?: string | null;
  ctaUrl: string;
  entityId?: string | null;
}) {
  const tpl = bookingConfirmedClient({
    clientName: args.clientName,
    title: args.title,
    dateFR: emailFormatters.formatDateFRLong(args.date),
    address: args.address,
    artistNames: args.artistNames,
    ctaUrl: args.ctaUrl,
  });
  await safeSend(
    { event: 'booking_confirmed_client', to: args.to, entity_id: args.entityId ?? undefined },
    {
      to: args.to,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      eventKey: args.eventKey,
      eventType: 'booking_confirmed',
      entityType: 'proposal',
      entityId: args.entityId ?? null,
    }
  );
}

export async function notifyRunSheetReady(args: {
  to: string;
  eventKey: string;
  title: string;
  date: string;
  address?: string | null;
  ctaUrl: string;
  contactLine?: string | null;
  entityId?: string | null;
}) {
  const tpl = runSheetReady({
    title: args.title,
    dateFR: emailFormatters.formatDateFRLong(args.date),
    address: args.address,
    ctaUrl: args.ctaUrl,
    contactLine: args.contactLine,
  });
  await safeSend(
    { event: 'run_sheet_ready', to: args.to, entity_id: args.entityId ?? undefined },
    {
      to: args.to,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      eventKey: args.eventKey,
      eventType: 'run_sheet',
      entityType: 'proposal',
      entityId: args.entityId ?? null,
    }
  );
}

export async function notifyBookingDeclinedArtist(args: {
  to: string;
  eventKey: string;
  artistName?: string | null;
  title: string;
  date: string;
  ctaUrl: string;
  entityId?: string | null;
}) {
  const tpl = bookingDeclinedArtist({
    artistName: args.artistName,
    title: args.title,
    dateFR: emailFormatters.formatDateFRLong(args.date),
    ctaUrl: args.ctaUrl,
  });
  await safeSend(
    { event: 'booking_declined_artist', to: args.to, entity_id: args.entityId ?? undefined },
    {
      to: args.to,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      eventKey: args.eventKey,
      eventType: 'residency_declined',
      entityType: 'residency_application',
      entityId: args.entityId ?? null,
    }
  );
}
