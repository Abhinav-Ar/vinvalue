/** Plain message bodies for each channel. User-visible strings: plain, no em dashes. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function absoluteLink(link: string | null): string | null {
  if (!link) return null;
  if (/^https?:\/\//.test(link)) return link;
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${link.startsWith('/') ? '' : '/'}${link}`;
}

type A = { title: string; body: string; link: string | null };

const SETTINGS_LINE = 'You can change which alerts you get in AutoIQ under Alerts, Notification settings.';

export function alertEmail(a: A) {
  const url = absoluteLink(a.link);
  const text = [a.body, url ? `Open in AutoIQ: ${url}` : null, '', SETTINGS_LINE].filter((x) => x !== null).join('\n');
  const html = `<p>${esc(a.body)}</p>${url ? `<p><a href="${esc(url)}">Open in AutoIQ</a></p>` : ''}<p style="color:#666;font-size:12px">${esc(SETTINGS_LINE)}</p>`;
  return { subject: a.title, text, html };
}

export function digestEmail(items: A[]) {
  const subject = `Your AutoIQ weekly digest: ${items.length} alert${items.length === 1 ? '' : 's'}`;
  const lines = items.map((a) => {
    const url = absoluteLink(a.link);
    return `- ${a.title}. ${a.body}${url ? ` ${url}` : ''}`;
  });
  const text = ['Here is what changed this week.', '', ...lines, '', SETTINGS_LINE].join('\n');
  const html =
    '<p>Here is what changed this week.</p><ul>' +
    items
      .map((a) => {
        const url = absoluteLink(a.link);
        const t = url ? `<a href="${esc(url)}">${esc(a.title)}</a>` : esc(a.title);
        return `<li><strong>${t}</strong><br>${esc(a.body)}</li>`;
      })
      .join('') +
    `</ul><p style="color:#666;font-size:12px">${esc(SETTINGS_LINE)}</p>`;
  return { subject, text, html };
}

/** SMS: short, with a link. Includes the opt-out hint carriers expect. */
export function alertSms(a: A): string {
  const url = absoluteLink(a.link);
  return `AutoIQ: ${a.title}.${url ? ` ${url}` : ''} Reply STOP to opt out.`;
}
