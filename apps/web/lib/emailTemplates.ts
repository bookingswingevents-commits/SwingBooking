// lib/emailTemplates.ts
const BRAND = '#003049';
const ACCENT = '#ae8616';

export function inviteEmailHTML(params: {
  artistName?: string | null;
  title: string;
  eventDate?: string | null;
  venueAddress?: string | null;
  ctaUrl: string; // lien vers /login ou page d’invitation
  logoUrl?: string; // optionnel
}) {
  const { artistName, title, eventDate, venueAddress, ctaUrl, logoUrl } = params;

  return `
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width"/>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <title>Nouvelle invitation - Swing Booking</title>
  <style>
    /* Reset */
    body, table, td, p { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
    img { border: none; -ms-interpolation-mode: bicubic; max-width: 100%; }
    body { background: #f6f8fb; margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
    .container { max-width: 560px; margin: 0 auto; padding: 24px 16px; }
    .card { background: #ffffff; border-radius: 16px; padding: 24px; border: 1px solid #e9eef5; }
    .brand { color: ${BRAND}; }
    .muted { color: #64748b; }
    .title { font-weight: 800; font-size: 18px; margin: 0 0 4px; color: #0f172a; }
    .badge { display: inline-block; padding: 6px 10px; border-radius: 9999px; font-size: 12px; background: ${ACCENT}1a; color: ${BRAND}; border: 1px solid ${ACCENT}; }
    .btn { display:inline-block; text-decoration:none; padding:12px 18px; border-radius:10px; font-weight:700; background:${BRAND}; color:#fff; }
    .btn:hover { opacity:.95 }
    .row { margin: 14px 0; }
    .label { font-size:12px; color:#475569; }
    .val { font-size:14px; color:#0f172a; }
    .footer { font-size:12px; color:#94a3b8; margin-top: 12px; }
    .logo { height: 28px; }
    @media (prefers-color-scheme: dark) {
      body { background: #0b1220; }
      .card { background: #0f172a; border-color: #1f2937; }
      .title { color: #e2e8f0; }
      .muted { color: #94a3b8; }
      .label { color:#9ca3af; }
      .val { color:#e5e7eb; }
      .btn { background:${ACCENT}; color:#0b1220; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
      <tr>
        <td align="left">
          ${logoUrl ? `<img src="${logoUrl}" alt="Swing Booking" class="logo" />` : `<div class="brand" style="font-weight:800;font-size:18px;">Swing Booking</div>`}
        </td>
      </tr>
    </table>

    <!-- Card -->
    <div class="card">
      <p class="muted" style="margin:0 0 8px;">Bonjour${artistName ? ` ${escapeHtml(artistName)}` : ''},</p>
      <p style="margin:0 0 16px;">Tu as reçu une nouvelle <strong>invitation</strong> :</p>

      <div class="row">
        <div class="title">${escapeHtml(title)}</div>
        <span class="badge">Invitation</span>
      </div>

      <div class="row">
        <div class="label">Date</div>
        <div class="val">${eventDate ? escapeHtml(eventDate) : '—'}</div>
      </div>

      <div class="row">
        <div class="label">Lieu</div>
        <div class="val">${venueAddress ? escapeHtml(venueAddress) : '—'}</div>
      </div>

      <div class="row" style="margin-top:20px;">
        <a href="${ctaUrl}" class="btn" target="_blank" rel="noopener">Voir l’invitation</a>
      </div>

      <p class="footer">Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :<br/>
        <span style="word-break: break-all;">${ctaUrl}</span>
      </p>

      <p class="muted" style="margin-top:24px;">— L’équipe Swing Booking</p>
    </div>

    <!-- Legal -->
    <p class="footer">Ce message t’a été envoyé car tu disposes d’un compte artiste sur Swing Booking.</p>
  </div>
</body>
</html>
`;
}

// Plain text (fallback/mail clients simplifiés)
export function inviteEmailText(params: {
  artistName?: string | null;
  title: string;
  eventDate?: string | null;
  venueAddress?: string | null;
  ctaUrl: string;
}) {
  const { artistName, title, eventDate, venueAddress, ctaUrl } = params;
  return [
    `Bonjour${artistName ? ` ${artistName}` : ''},`,
    ``,
    `Tu as reçu une nouvelle invitation :`,
    `• Événement : ${title}`,
    `• Date : ${eventDate ?? '—'}`,
    `• Lieu : ${venueAddress ?? '—'}`,
    ``,
    `Voir l’invitation : ${ctaUrl}`,
    ``,
    `— L’équipe Swing Booking`,
  ].join('\n');
}

// Petit utilitaire pour éviter l'injection dans l'HTML email
function escapeHtml(str: string) {
  return str
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}
