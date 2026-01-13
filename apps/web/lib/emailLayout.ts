type EmailSection = {
  title?: string;
  body: string;
};

type EmailLayoutArgs = {
  title: string;
  intro?: string;
  sections?: EmailSection[];
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
};

const baseStyles = `
  body { margin: 0; padding: 0; background: #f6f7fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #0f172a; }
  .wrapper { width: 100%; padding: 32px 16px; }
  .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08); overflow: hidden; }
  .header { padding: 24px 28px 8px; }
  .title { font-size: 20px; font-weight: 700; margin: 0; }
  .content { padding: 8px 28px 24px; font-size: 15px; line-height: 1.6; }
  .section { margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
  .section-title { font-size: 14px; font-weight: 700; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; }
  .cta { display: inline-block; margin-top: 16px; padding: 12px 18px; background: #003049; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; }
  .footer { padding: 16px 28px 24px; font-size: 12px; color: #64748b; }
`;

export function renderEmailLayout({
  title,
  intro,
  sections = [],
  ctaLabel,
  ctaUrl,
  footerNote,
}: EmailLayoutArgs) {
  const sectionsHtml = sections
    .map(
      (section) => `
      <div class="section">
        ${section.title ? `<div class="section-title">${section.title}</div>` : ''}
        <div>${section.body}</div>
      </div>`
    )
    .join('');

  return `
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>${baseStyles}</style>
    <title>${title}</title>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">
          <h1 class="title">${title}</h1>
        </div>
        <div class="content">
          ${intro ? `<p>${intro}</p>` : ''}
          ${sectionsHtml}
          ${ctaLabel && ctaUrl ? `<a class="cta" href="${ctaUrl}">${ctaLabel}</a>` : ''}
        </div>
        <div class="footer">
          ${footerNote ?? 'Swing Booking — mise en relation établissements & artistes'}
        </div>
      </div>
    </div>
  </body>
</html>
`.trim();
}
