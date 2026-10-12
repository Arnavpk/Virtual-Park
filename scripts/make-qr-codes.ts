/**
 * Makes printable location QR codes for the park. Developer tool; nothing here ships to visitors.
 *
 *   npm run qr -- --base https://your-park-site.example
 *   npm run qr -- --base https://your-park-site.example --only gate,p1,place-17 --out qr-codes
 *
 * Each code is a plain link, https://<site>/?loc=<id>, so a visitor can scan it with the phone's own
 * camera app (it opens the park with the character at that spot) or with Scan inside the app. The
 * link carries only the location id, never coordinates. Under each code the sheet prints the short
 * code (e.g. "P3", "17") that visitors can type in if scanning doesn't work.
 *
 * Output: one SVG per location, plus index.html, a print-ready sheet of all of them.
 * Place each printed code at the real spot it names (see the location list in data/locations.ts):
 * the entrance, the P1–P12 survey junctions, and the path in front of each ride, restaurant or facility.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import QRCode from 'qrcode';
import { LOCATIONS, locationUrl } from '../features/digital-park/data/locations';

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const base = arg('base');
const out = arg('out') ?? 'qr-codes';
const only = arg('only')?.split(',').map((s) => s.trim().toLowerCase());

if (!base || !/^https:\/\//.test(base)) {
  console.error('Give the site address the codes should open, starting https://, e.g.\n  npm run qr -- --base https://your-park-site.example');
  process.exit(1);
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

async function main() {
  const picked = only ? LOCATIONS.filter((l) => only.includes(l.id) || only.includes(l.code.toLowerCase())) : LOCATIONS;
  if (!picked.length) throw new Error('No locations matched --only');
  mkdirSync(out, { recursive: true });
  const cards: string[] = [];
  for (const loc of picked) {
    const url = locationUrl(loc, base!);
    // Error correction M survives scuffs and glare; margin 2 keeps the quiet zone the scanner needs.
    const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 });
    writeFileSync(join(out, `${loc.id}.svg`), svg);
    cards.push(`<figure class="card">
  ${svg}
  <figcaption>
    <strong>${escape(loc.name)}</strong>
    ${loc.note ? `<span class="note">${escape(loc.note)}</span>` : ''}
    <span class="code">Code: <b>${escape(loc.code)}</b></span>
    <span class="url">${escape(url)}</span>
  </figcaption>
</figure>`);
  }
  writeFileSync(
    join(out, 'index.html'),
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Digital Park location QR codes</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 16px; color: #12324a; }
  h1 { font-size: 20px; } p.lead { max-width: 70ch; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .card { margin: 0; padding: 12px; border: 2px solid #12324a; border-radius: 12px; break-inside: avoid; text-align: center; }
  .card svg { width: 100%; max-width: 200px; height: auto; }
  figcaption { display: grid; gap: 4px; font-size: 13px; }
  .note { color: #4b6a80; } .code b { font-size: 22px; letter-spacing: 0.04em; } .url { font-size: 10px; color: #6f8798; word-break: break-all; }
  @media print { .lead { display: none; } body { margin: 0; } }
</style></head><body>
<h1>Digital Park location QR codes (${picked.length})</h1>
<p class="lead">Print and fix each code at the spot it names. Scanning opens the park at that spot; the code under it can be typed into Scan instead. Codes open ${escape(base!)}.</p>
<div class="grid">
${cards.join('\n')}
</div></body></html>
`,
  );
  console.log(`Wrote ${picked.length} QR codes and index.html to ${out}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
