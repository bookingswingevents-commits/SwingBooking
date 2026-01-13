import { renderEmailLayout } from '@/lib/emailLayout';

type TemplateResult = { subject: string; html: string; text: string };

function formatDateFRLong(dateInput?: string | Date | null) {
  if (!dateInput) return 'Date à confirmer';
  const date = typeof dateInput === 'string' ? new Date(`${dateInput}T12:00:00`) : dateInput;
  if (Number.isNaN(date.getTime())) return 'Date à confirmer';
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function joinLines(lines: Array<string | null | undefined>) {
  return lines.filter(Boolean).join('\n');
}

export function signupConfirmation(toName?: string | null): TemplateResult {
  const subject = 'Bienvenue sur Swing Booking';
  const intro = `Votre compte est créé${toName ? `, ${toName}` : ''}.`;
  const html = renderEmailLayout({
    title: 'Confirmation d’inscription',
    intro,
    sections: [
      {
        title: 'Prochaine étape',
        body: 'Complétez votre profil pour recevoir des opportunités adaptées à votre projet.',
      },
    ],
    ctaLabel: 'Accéder à votre espace',
    ctaUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://app.swingbooking.fr',
  });
  const text = joinLines([
    'Confirmation d’inscription',
    intro,
    'Prochaine étape : complétez votre profil pour recevoir des opportunités adaptées.',
    `Accès : ${process.env.NEXT_PUBLIC_APP_URL || 'https://app.swingbooking.fr'}`,
  ]);
  return { subject, html, text };
}

export function invitationArtist(args: {
  artistName?: string | null;
  title: string;
  dateFR?: string;
  ctaUrl: string;
}): TemplateResult {
  const subject = `Invitation à une programmation : ${args.title}`;
  const intro = `Bonjour${args.artistName ? ` ${args.artistName}` : ''}, vous avez été invité à une programmation.`;
  const html = renderEmailLayout({
    title: 'Invitation à une programmation',
    intro,
    sections: [
      {
        title: 'Programmation',
        body: `<strong>${args.title}</strong><br/>${args.dateFR ?? 'Dates à confirmer'}`,
      },
    ],
    ctaLabel: 'Voir la programmation',
    ctaUrl: args.ctaUrl,
  });
  const text = joinLines([
    'Invitation à une programmation',
    intro,
    `Programmation : ${args.title}`,
    args.dateFR ?? 'Dates à confirmer',
    `Lien : ${args.ctaUrl}`,
  ]);
  return { subject, html, text };
}

export function artistAppliedAdmin(args: {
  artistName: string;
  title: string;
  dateFR?: string;
  adminUrl: string;
}): TemplateResult {
  const subject = `Nouvelle candidature artiste : ${args.title}`;
  const intro = `${args.artistName} a postulé sur une programmation.`;
  const html = renderEmailLayout({
    title: 'Nouvelle candidature artiste',
    intro,
    sections: [
      {
        title: 'Programmation',
        body: `<strong>${args.title}</strong><br/>${args.dateFR ?? 'Dates à confirmer'}`,
      },
    ],
    ctaLabel: 'Voir les candidatures',
    ctaUrl: args.adminUrl,
  });
  const text = joinLines([
    'Nouvelle candidature artiste',
    intro,
    `Programmation : ${args.title}`,
    args.dateFR ?? 'Dates à confirmer',
    `Lien : ${args.adminUrl}`,
  ]);
  return { subject, html, text };
}

export function bookingConfirmedArtist(args: {
  artistName?: string | null;
  title: string;
  dateFR: string;
  address?: string | null;
  fee?: string | null;
  ctaUrl: string;
}): TemplateResult {
  const subject = `Confirmation de prestation : ${args.title}`;
  const intro = `Bonjour${args.artistName ? ` ${args.artistName}` : ''}, votre prestation est confirmée.`;
  const html = renderEmailLayout({
    title: 'Prestation confirmée',
    intro,
    sections: [
      {
        title: 'Détails',
        body: joinLines([
          `<strong>${args.title}</strong>`,
          args.dateFR,
          args.address ? `Adresse : ${args.address}` : null,
          args.fee ? `Cachet : ${args.fee}` : null,
        ]),
      },
    ],
    ctaLabel: 'Voir la demande',
    ctaUrl: args.ctaUrl,
  });
  const text = joinLines([
    'Prestation confirmée',
    intro,
    args.title,
    args.dateFR,
    args.address ? `Adresse : ${args.address}` : null,
    args.fee ? `Cachet : ${args.fee}` : null,
    `Lien : ${args.ctaUrl}`,
  ]);
  return { subject, html, text };
}

export function bookingConfirmedClient(args: {
  clientName?: string | null;
  title: string;
  dateFR: string;
  address?: string | null;
  artistNames?: string | null;
  ctaUrl: string;
}): TemplateResult {
  const subject = `Confirmation de prestation : ${args.title}`;
  const intro = `Bonjour${args.clientName ? ` ${args.clientName}` : ''}, votre prestation est confirmée.`;
  const html = renderEmailLayout({
    title: 'Prestation confirmée',
    intro,
    sections: [
      {
        title: 'Détails',
        body: joinLines([
          `<strong>${args.title}</strong>`,
          args.dateFR,
          args.address ? `Adresse : ${args.address}` : null,
          args.artistNames ? `Artiste : ${args.artistNames}` : null,
        ]),
      },
    ],
    ctaLabel: 'Voir la demande',
    ctaUrl: args.ctaUrl,
  });
  const text = joinLines([
    'Prestation confirmée',
    intro,
    args.title,
    args.dateFR,
    args.address ? `Adresse : ${args.address}` : null,
    args.artistNames ? `Artiste : ${args.artistNames}` : null,
    `Lien : ${args.ctaUrl}`,
  ]);
  return { subject, html, text };
}

export function runSheetReady(args: {
  title: string;
  dateFR: string;
  address?: string | null;
  ctaUrl: string;
  contactLine?: string | null;
}): TemplateResult {
  const subject = `Feuille de route disponible : ${args.title}`;
  const intro = 'La feuille de route est disponible pour cette prestation.';
  const html = renderEmailLayout({
    title: 'Feuille de route disponible',
    intro,
    sections: [
      {
        title: 'Récapitulatif',
        body: joinLines([
          `<strong>${args.title}</strong>`,
          args.dateFR,
          args.address ? `Adresse : ${args.address}` : null,
          args.contactLine ?? null,
        ]),
      },
    ],
    ctaLabel: 'Ouvrir la feuille de route',
    ctaUrl: args.ctaUrl,
  });
  const text = joinLines([
    'Feuille de route disponible',
    args.title,
    args.dateFR,
    args.address ? `Adresse : ${args.address}` : null,
    args.contactLine ?? null,
    `Lien : ${args.ctaUrl}`,
  ]);
  return { subject, html, text };
}

export function bookingDeclinedArtist(args: {
  artistName?: string | null;
  title: string;
  dateFR: string;
  ctaUrl: string;
}): TemplateResult {
  const subject = `Réponse à votre candidature : ${args.title}`;
  const intro = `Bonjour${args.artistName ? ` ${args.artistName}` : ''}, votre candidature n’a pas été retenue.`;
  const html = renderEmailLayout({
    title: 'Candidature non retenue',
    intro,
    sections: [
      {
        title: 'Programmation',
        body: joinLines([`<strong>${args.title}</strong>`, args.dateFR]),
      },
    ],
    ctaLabel: 'Voir la programmation',
    ctaUrl: args.ctaUrl,
  });
  const text = joinLines([
    'Candidature non retenue',
    intro,
    args.title,
    args.dateFR,
    `Lien : ${args.ctaUrl}`,
  ]);
  return { subject, html, text };
}

export function bulkProgrammationOuverte(args: {
  subject?: string | null;
  message: string;
  ctaUrl: string;
  intro?: string | null;
  footer?: string | null;
}): TemplateResult {
  const subject = args.subject?.trim() || 'Programmation ouverte';
  const intro = args.intro || 'Une programmation est ouverte et vous pouvez proposer vos disponibilités.';
  const html = renderEmailLayout({
    title: 'Programmation ouverte',
    intro,
    sections: [
      {
        title: 'Message',
        body: args.message.replace(/\n/g, '<br />'),
      },
    ],
    ctaLabel: 'Voir les programmations',
    ctaUrl: args.ctaUrl,
    footerNote: args.footer ?? undefined,
  });
  const text = joinLines([
    'Programmation ouverte',
    intro,
    'Message :',
    args.message,
    `Lien : ${args.ctaUrl}`,
  ]);
  return { subject, html, text };
}

export const emailFormatters = { formatDateFRLong };
