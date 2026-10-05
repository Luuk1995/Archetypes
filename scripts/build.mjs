/* ═══════════════════════════════════════════════════════════════════════
   BOUWSCRIPT ARCHE!TYPES — draait automatisch op Netlify bij elke publicatie.

   Wat het doet (jij hoeft hier nooit iets aan te veranderen):
   1. Leest alle projecten, objecten, info, video's en vindbaarheid uit de admin-bestanden.
   2. Maakt van elke projectfoto een lichte webversie (WebP, max. 1400 px breed).
   3. Zet alle gegevens direct in de pagina  → geen losse verzoeken meer, dus sneller.
   4. Zet titels, teksten en zoekmachine-gegevens leesbaar in de HTML → beter vindbaar.
   5. Schrijft sitemap.xml en robots.txt.

   Veiligheid: gaat er iets mis, dan wordt er NIETS overschreven en gaat de site
   live zoals hij zonder dit script werkt. Een publicatie wordt nooit geblokkeerd.
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const PUB = path.join(ROOT, 'archetypes-upload');
const OPT_DIR = path.join(PUB, '_opt');
const SKIP_IMAGES = process.env.NO_IMAGE_OPT === '1';
const log = (...a) => console.log('[arche!types]', ...a);

const DEFAULT_SEO = {
  title: 'Arche!Types — Imme van Straaten · Architectuur & Objectontwerp',
  description: 'Arche!Types (Archetypes) is de ontwerpstudio van architect Imme van Straaten: avontuurlijke architectuur en objecten van hout, staal en restmateriaal.',
  share_image: '',
  person_name: 'Imme van Straaten',
  person_role: 'Architect',
  city: 'Amsterdam',
  email: 'studio@arche-types.nl',
  instagram: 'arche_types',
  linkedin: '',
  site_url: 'https://arche-types.nl',
};

/* ── hulpjes ─────────────────────────────────────────────────────────── */
const readJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (s) => String(s ?? '').replace(/==(.+?)==/g, '$1').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\\n/g, '\n').trim();
const exclaim = (html) => html.replace(/!/g, '<em class="exclaim">!</em>');
const inlineJSON = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

// Vervangt alles tussen <!--NAAM--> en <!--/NAAM--> (blijft werken bij herhaald bouwen)
function fillMarker(html, name, content) {
  const re = new RegExp(`(<!--${name}-->)[\\s\\S]*?(<!--/${name}-->)`);
  if (!re.test(html)) { log(`let op: markering ${name} niet gevonden, overgeslagen`); return html; }
  return html.replace(re, (_, a, b) => a + content + b);
}

// Eenvoudige frontmatter-lezer (alleen voor de leesbare HTML; de site zelf parseert met zijn eigen code)
function frontmatter(text) {
  const m = /^---\s*\n([\s\S]*?)\n---/.exec(text); if (!m) return {};
  const out = {}; let key = null, block = null;
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1]; let v = kv[2].trim();
      if (v === '>' || v === '>-' || v === '|' || v === '|-') { block = v[0]; out[key] = ''; continue; }
      block = null;
      if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1);
      out[key] = v;
    } else if (key && /^\s+\S/.test(line)) {
      const nested = /^\s+([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(line);
      if (nested && out[key] === '') { out[nested[1]] = nested[2].replace(/^"(.*)"$|^'(.*)'$/, '$1$2'); continue; }
      out[key] = (out[key] ? out[key] + (block === '|' ? '\n' : ' ') : '') + line.trim();
    }
  }
  return out;
}

/* ── foto's: lichte webversie per foto, één keer per unieke foto ─────────── */
let sharp = null;
const optCache = new Map();
const stats = { done: 0, before: 0, after: 0, failed: 0 };

async function optimizedURL(value) {
  if (!sharp) return null;
  const raw = String(value).trim().replace(/^"(.*)"$|^'(.*)'$/, '$1$2');
  if (!raw || /^https?:\/\//i.test(raw)) return null;
  if (optCache.has(raw)) return optCache.get(raw);
  let rel = raw.replace(/^\/+/, '');
  try { rel = decodeURI(rel); } catch {}
  const src = path.join(PUB, rel);
  if (!src.startsWith(PUB) || !fs.existsSync(src)) { optCache.set(raw, null); return null; }
  try {
    const buf = fs.readFileSync(src);
    const hash = crypto.createHash('md5').update(buf).digest('hex').slice(0, 10);
    const base = path.basename(rel, path.extname(rel)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'beeld';
    const name = `${base}-${hash}.webp`;
    const out = path.join(OPT_DIR, name);
    if (!fs.existsSync(out)) {
      await sharp(buf).rotate().resize({ width: 1400, withoutEnlargement: true }).webp({ quality: 70, effort: 5 }).toFile(out);
    }
    const after = fs.statSync(out).size;
    if (after >= buf.length) { optCache.set(raw, null); return null; }   // origineel was al kleiner
    stats.done++; stats.before += buf.length; stats.after += after;
    const url = `/_opt/${name}`;
    optCache.set(raw, url);
    return url;
  } catch (e) { stats.failed++; log('foto overgeslagen:', rel, e.message); optCache.set(raw, null); return null; }
}

async function shareImage(value) {
  if (!sharp || !value) return null;
  let rel = String(value).trim().replace(/^\/+/, ''); try { rel = decodeURI(rel); } catch {}
  const src = path.join(PUB, rel);
  if (!src.startsWith(PUB) || !fs.existsSync(src)) return null;
  try {
    const buf = fs.readFileSync(src);
    const hash = crypto.createHash('md5').update(buf).digest('hex').slice(0, 10);
    const name = `delen-${hash}.jpg`, out = path.join(OPT_DIR, name);
    if (!fs.existsSync(out)) await sharp(buf).rotate().resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 84, mozjpeg: true }).toFile(out);
    return `/_opt/${name}`;
  } catch { return null; }
}

// Vervangt foto-paden in de projecttekst door de lichte webversie (origineel blijft onaangeroerd)
async function rewriteImages(text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(image\d*)(\s*:\s*)(.+)$/.exec(lines[i]);
    if (!m) continue;
    const url = await optimizedURL(m[4]);
    if (url) lines[i] = m[1] + m[2] + m[3] + url;
  }
  return lines.join('\n');
}

/* ── zoekmachine-blok in <head> ─────────────────────────────────────────── */
function seoHead(seo, shareURL) {
  const site = String(seo.site_url || DEFAULT_SEO.site_url).replace(/\/+$/, '');
  const url = site + '/';
  const img = shareURL ? (shareURL.startsWith('http') ? shareURL : site + shareURL) : site + '/images/profiel-imme.jpg';
  const sameAs = [];
  if (seo.instagram) sameAs.push(`https://www.instagram.com/${String(seo.instagram).replace(/^@/, '')}/`);
  if (seo.linkedin) sameAs.push(seo.linkedin);
  const studio = {
    '@type': 'ProfessionalService', '@id': url + '#studio',
    name: 'Arche!Types', alternateName: ['Archetypes', 'Arche-Types', 'Arche Types'],
    url, image: img, description: seo.description,
    founder: { '@id': url + '#persoon' },
    ...(seo.email ? { email: seo.email } : {}),
    ...(seo.city ? { address: { '@type': 'PostalAddress', addressLocality: seo.city, addressCountry: 'NL' } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
  const person = {
    '@type': 'Person', '@id': url + '#persoon', name: seo.person_name, jobTitle: seo.person_role,
    worksFor: { '@id': url + '#studio' }, image: site + '/images/profiel-imme.jpg', url,
    ...(sameAs.length ? { sameAs } : {}),
  };
  const website = { '@type': 'WebSite', '@id': url + '#website', url, name: 'Arche!Types', alternateName: 'Archetypes', inLanguage: 'nl', publisher: { '@id': url + '#studio' } };
  const ld = inlineJSON({ '@context': 'https://schema.org', '@graph': [studio, person, website] });
  return `
  <title>${esc(seo.title)}</title>
  <meta name="description" content="${esc(seo.description)}">
  <link rel="canonical" href="${esc(url)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Arche!Types">
  <meta property="og:locale" content="nl_NL">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:title" content="${esc(seo.title)}">
  <meta property="og:description" content="${esc(seo.description)}">
  <meta property="og:image" content="${esc(img)}">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${ld}</script>
  `;
}

/* ── leesbare HTML voor zoekmachines (alleen tekst; foto's staan in de sitemap) — de site vervangt dit direct ── */
function prerenderList(items) {
  return items.map((p) => {
    const sub = p.sub ? `<p class="project-subtitle">${esc(plain(p.sub))}</p>` : '';
    const desc = [p.desc, p.desc_slider].filter(Boolean).map((t) => `<p class="project-desc">${esc(plain(t))}</p>`).join('');
    return `<article class="project-card"><h2 class="project-title">${esc(plain(p.title))}</h2>${sub}${desc}</article>`;
  }).join('');
}

/* ── hoofdprogramma ─────────────────────────────────────────────────────── */
async function main() {
  const indexPath = path.join(PUB, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  if (!SKIP_IMAGES) {
    try { sharp = (await import('sharp')).default; fs.mkdirSync(OPT_DIR, { recursive: true }); }
    catch { log('fotobewerking niet beschikbaar — originele foto\'s worden gebruikt'); sharp = null; }
  }

  const readFolder = (folder) => {
    const dir = path.join(PUB, 'data', folder);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.md'))
      .sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base' }))
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
  };
  const md = { projecten: [], objecten: [] };
  for (const folder of Object.keys(md)) {
    for (const t of readFolder(folder)) md[folder].push(await rewriteImages(t));
  }

  const info = readJSON(path.join(PUB, 'data', 'info.json'));
  const videos = readJSON(path.join(PUB, 'data', 'videos.json'));
  const seo = { ...DEFAULT_SEO };
  const seoFile = readJSON(path.join(PUB, 'data', 'seo.json')) || {};
  for (const [k, v] of Object.entries(seoFile)) if (typeof v === 'string' && v.trim()) seo[k] = v.trim();

  // Gesorteerd zoals de site ze toont (op volgorde-nummer)
  const parsed = (texts) => texts.map(frontmatter).filter((p) => p.title)
    .sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
  const arche = parsed(md.projecten), types = parsed(md.objecten);

  // Deelafbeelding: uit de admin, anders het eerste architectuurproject
  const shareSrc = seo.share_image || (arche[0] || {}).image || '';
  const share = (await shareImage(shareSrc)) || (shareSrc ? (shareSrc.startsWith('/') || shareSrc.startsWith('http') ? shareSrc : '/' + shareSrc) : null);

  // 1. Gegevens in de pagina
  const siteData = { v: 1, md, info, videos };
  html = fillMarker(html, 'SITE-DATA', `<script id="site-data" type="application/json">${inlineJSON(siteData)}</script>`);
  // 2. Zoekmachine-blok
  html = fillMarker(html, 'SEO', seoHead(seo, share));
  // 3. Leesbare inhoud
  html = fillMarker(html, 'PRE:arche', prerenderList(arche));
  html = fillMarker(html, 'PRE:types', prerenderList(types));
  if (info) {
    html = fillMarker(html, 'PRE:p1', exclaim(esc(info.p1 || '')));
    html = fillMarker(html, 'PRE:p2', exclaim(esc(info.p2 || '')));
    html = fillMarker(html, 'PRE:meta', esc(info.meta || '').replace(/\n/g, '<br>'));
  }

  // 4. sitemap + robots
  const site = String(seo.site_url).replace(/\/+$/, '');
  const imgs = [...new Set([...arche, ...types].flatMap((p) => Object.keys(p).filter((k) => /^image\d*$/.test(k)).map((k) => p[k])).filter(Boolean))];
  const imgTags = imgs.map((u) => `\n    <image:image><image:loc>${esc(u.startsWith('http') ? u : site + (u.startsWith('/') ? '' : '/') + encodeURI(decodeURI(u)))}</image:loc></image:image>`).join('');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${esc(site)}/</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>${imgTags}
  </url>
</urlset>
`;
  const robots = `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${site}/sitemap.xml\n`;

  // Alles in één keer wegschrijven (pas aan het eind = nooit een half bestand)
  fs.writeFileSync(indexPath, html);
  fs.writeFileSync(path.join(PUB, 'sitemap.xml'), sitemap);
  fs.writeFileSync(path.join(PUB, 'robots.txt'), robots);

  const mb = (n) => (n / 1048576).toFixed(1);
  log(`klaar: ${arche.length} projecten, ${types.length} objecten in de pagina gezet`);
  log(sharp ? `foto's: ${stats.done} verkleind (${mb(stats.before)} MB → ${mb(stats.after)} MB)${stats.failed ? `, ${stats.failed} overgeslagen` : ''}` : 'foto\'s: originelen gebruikt');
}

main().catch((e) => {
  console.error('[arche!types] bouwen overgeslagen, site gaat live zoals hij was:', e && e.stack || e);
  process.exit(0);
});
