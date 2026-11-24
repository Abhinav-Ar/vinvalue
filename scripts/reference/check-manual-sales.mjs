import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const header = 'source,url,saleDate,make,model,generation,trim,year,mileage,salePriceUsd,transmission,notes,example';
// RFC4180 quoted commas, escaped quotes, CRLF and multiline notes.
export function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === '"' && !field && !closed) quoted = true;
    else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field); field = ''; closed = false;
      if (c !== ',') { if (row.some(Boolean)) rows.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; }
    } else { if (closed || c === '"') throw new Error('Malformed CSV quoting'); field += c; }
  }
  if (quoted) throw new Error('Unterminated quoted field');
  if (field || row.length || closed) { row.push(field); rows.push(row); }
  return rows;
}
export function validateManualSales(text, reference, today = new Date().toISOString().slice(0, 10)) {
  const rows = parseCsv(text), errors = [], urls = new Set(); let count = 0;
  if (rows.shift()?.join(',') !== header) return { errors: ['Header must be: ' + header], count };
  rows.forEach((cells, i) => {
    const fail = message => errors.push(`Row ${i + 2}: ${message}`);
    if (cells.length !== 13) { fail(`expected 13 columns, got ${cells.length}`); return; }
    const r = Object.fromEntries(header.split(',').map((key, j) => [key, cells[j].trim()]));
    if (r.example === 'true') return;
    if (r.example !== 'false') fail('example must be true or false');
    count++;
    const host = r.source === 'Bring a Trailer' ? 'bringatrailer.com' : r.source === 'Cars & Bids' ? 'carsandbids.com' : null;
    if (!host) fail('source must be Bring a Trailer or Cars & Bids');
    try {
      const u = new URL(r.url);
      if (u.protocol !== 'https:' || ![host, `www.${host}`].includes(u.hostname) || u.username || u.password || !/^\/(listing|auctions)\/[^/]+/.test(u.pathname)) fail('url must be an HTTPS auction result URL for the source');
      const key = u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '');
      if (urls.has(key)) fail('duplicate url');
      urls.add(key);
    } catch { fail('invalid url'); }
    const d = new Date(`${r.saleDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.saleDate) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== r.saleDate || r.saleDate > today || r.saleDate < '2000-01-01') fail('saleDate must be a real completed-sale date from 2000 through today');
    for (const [key, min, max] of [['year', 1886, Number(today.slice(0, 4)) + 1], ['mileage', 0, 999999], ['salePriceUsd', 500, 5000000]]) {
      if (!/^\d+$/.test(r[key]) || +r[key] < min || +r[key] > max) fail(`${key} must be whole units between ${min} and ${max}`);
    }
    const norm = s => s.toLowerCase();
    if (!reference.some(a => ['make', 'model', 'generation', 'trim'].every(k => norm(a[k]) === norm(r[k])) && +r.year >= a.yearFrom && +r.year <= a.yearTo)) fail('make/model/generation/trim/year does not match models/reference/data/msrp.json');
    if (!['manual', 'automatic', 'automated manual', 'cvt', 'single speed'].includes(r.transmission)) fail('use manual, automatic, automated manual, cvt or single speed for transmission');
    if (/\bbid to\b|\breserve not met\b|\bunsold\b/i.test(r.notes)) fail('only completed sales count; bid-to/unsold results are excluded');
  });
  return { errors, count };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const reference = JSON.parse(readFileSync(new URL('../../models/reference/data/msrp.json', import.meta.url), 'utf8'));
    const result = validateManualSales(readFileSync(process.argv[2] ?? new URL('./calibration/manual-sales.csv', import.meta.url), 'utf8'), reference);
    for (const error of result.errors) console.error(error);
    if (result.errors.length) process.exitCode = 1;
    else console.log(`Valid: ${result.count} completed sales (example rows ignored).`);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
