/* ═══════════════════════════════════════════════════════════════════════
   ARCHE!TYPES — FOTOHUISSTIJL (recept v5)
   Eén berekening voor twee plekken:
     • het live voorbeeld in de admin (browser)
     • het publiceren op Netlify (scripts/build.mjs)
   Zo is wat je in de admin ziet precies wat er live komt.

   Volgorde: (verkleinen gebeurt vóór deze functie) → zachter → licht → textuur →
   hooglichten → zacht zwart → kleur → vignet → korrel (altijd als laatste).
   Afgeleid van huisstijl_recept_v5.py. Instelbaar in de admin: korrel, textuur, contrast.
   ═══════════════════════════════════════════════════════════════════════ */

export const RECEPT_V5 = Object.freeze({
  versie: 5,
  zwart: 7.0, wit: 93.0, contrast: 26.0, verz: 14.0,
  zweem_a: 0.2, zweem_b: 1.5,
  kracht_toon: 0.7, kracht_contrast: 0.6, kracht_verz: 0.4, kracht_zweem: 0.6,
  textuur: 0.45, schouder: 0.45, teen_vloer: 6.0, teen_tot: 18.0,
  split_schaduw: -1.0, split_licht: 0.0,
  verzacht: 0.45, vignet: 0.10, korrel: 11.0, korrel_grof: 0.85,
  groen_naar: 105.0, groen_mee: 0.15, groen_demp: 0.08, groen_max: 48.0,
  blauw_tint: 264.0, blauw_mee: 0.30, blauw_max: 27.0,
  licht_a: 0.2, licht_b: 3.5, licht_mee: 0.4,
});

/* Instellingen uit de admin (data/fotostijl.json) samenvoegen met het recept, binnen veilige grenzen */
export function receptMet(instellingen = {}) {
  const r = { ...RECEPT_V5 };
  const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v)) ? Math.min(hi, Math.max(lo, v)) : undefined;
  const k = num(instellingen.korrel, 0, 25);   if (k !== undefined) r.korrel = k;
  const t = num(instellingen.textuur, 0, 1);   if (t !== undefined) r.textuur = t;
  const c = num(instellingen.contrast, 18, 34); if (c !== undefined) r.contrast = c;
  return r;
}

/* Korte vingerafdruk van het recept: verandert het recept, dan krijgen foto's een nieuwe bestandsnaam */
export function receptCode(r) {
  const s = JSON.stringify(r); let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/* ── hulpjes: vervagen (gauss), kleurruimte, statistiek ─────────────────── */
function gaussKernel(sigma) {
  const r = Math.max(1, Math.ceil(sigma * 3)), k = new Float32Array(2 * r + 1); let s = 0;
  for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); k[i + r] = v; s += v; }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  return { k, r };
}
const refl = (i, n) => (i < 0 ? -i : (i >= n ? 2 * n - 2 - i : i));   // spiegelen aan de rand
function blurExact(src, w, h, sigma) {
  const { k, r } = gaussKernel(sigma), tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) { const row = y * w;
    for (let x = 0; x < w; x++) { let s = 0;
      if (x >= r && x < w - r) { const o = row + x - r; for (let j = 0; j <= 2 * r; j++) s += src[o + j] * k[j]; }
      else for (let j = -r; j <= r; j++) s += src[row + refl(x + j, w)] * k[j + r];
      tmp[row + x] = s; } }
  for (let y = 0; y < h; y++) { const row = y * w;
    if (y >= r && y < h - r) { for (let x = 0; x < w; x++) { let s = 0, o = (y - r) * w + x; for (let j = 0; j <= 2 * r; j++, o += w) s += tmp[o] * k[j]; out[row + x] = s; } }
    else for (let x = 0; x < w; x++) { let s = 0; for (let j = -r; j <= r; j++) s += tmp[refl(y + j, h) * w + x] * k[j + r]; out[row + x] = s; } }
  return out;
}
function boxPass(src, dst, w, h, r, horiz) {
  const d = 1 / (2 * r + 1);
  if (horiz) {
    for (let y = 0; y < h; y++) { const o = y * w; let s = 0;
      for (let j = -r; j <= r; j++) s += src[o + (j < 0 ? 0 : j >= w ? w - 1 : j)];
      for (let x = 0; x < w; x++) {
        dst[o + x] = s * d;
        const ai = x + r + 1, ri = x - r;
        s += src[o + (ai >= w ? w - 1 : ai)] - src[o + (ri < 0 ? 0 : ri)];
      } }
  } else {   // rij voor rij met lopende kolomsommen: geheugenvriendelijk
    const sum = new Float64Array(w);
    for (let j = -r; j <= r; j++) { const yy = (j < 0 ? 0 : j >= h ? h - 1 : j) * w; for (let x = 0; x < w; x++) sum[x] += src[yy + x]; }
    for (let y = 0; y < h; y++) {
      const o = y * w, ai = y + r + 1, ri = y - r;
      const ao = (ai >= h ? h - 1 : ai) * w, ro = (ri < 0 ? 0 : ri) * w;
      for (let x = 0; x < w; x++) { dst[o + x] = sum[x] * d; sum[x] += src[ao + x] - src[ro + x]; }
    }
  }
}
function blurBox(src, w, h, sigma) {   // 3× box ≈ gauss, snel voor grote sigma
  const n = 3, wIdeal = Math.sqrt((12 * sigma * sigma / n) + 1);
  let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--; const wu = wl + 2;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  let a = Float32Array.from(src), b = new Float32Array(w * h);
  for (let i = 0; i < n; i++) {
    const r = ((i < m ? wl : wu) - 1) / 2;
    boxPass(a, b, w, h, r, true); boxPass(b, a, w, h, r, false);
  }
  return a;
}
function blur(src, w, h, sigma) {
  if (sigma <= 0) return Float32Array.from(src);
  const maxS = Math.min(w, h) / 2.2;            // niet verder vervagen dan het beeld groot is
  if (sigma > maxS) sigma = maxS;
  return sigma < 2.5 ? blurExact(src, w, h, sigma) : blurBox(src, w, h, sigma);
}
function percentiel(arr, q, lo = -10, hi = 110, bins = 2400) {
  const hist = new Uint32Array(bins), sc = bins / (hi - lo);
  for (let i = 0; i < arr.length; i++) { let b = Math.floor((arr[i] - lo) * sc); if (b < 0) b = 0; else if (b >= bins) b = bins - 1; hist[b]++; }
  const doel = (q / 100) * (arr.length - 1); let acc = 0;
  for (let b = 0; b < bins; b++) { acc += hist[b]; if (acc > doel) return lo + (b + 0.5) / sc; }
  return hi;
}
function gemStd(arr) { let s = 0, s2 = 0; for (let i = 0; i < arr.length; i++) { s += arr[i]; s2 += arr[i] * arr[i]; }
  const m = s / arr.length; return [m, Math.sqrt(Math.max(0, s2 / arr.length - m * m))]; }
const Xn = 0.950456, Zn = 1.088754;
const LIN = new Float32Array(4097); for (let i = 0; i <= 4096; i++) { const c = i / 4096; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const toLin = (c) => { const p = c * 4096, i = p | 0; return i >= 4096 ? LIN[4096] : LIN[i] + (LIN[i + 1] - LIN[i]) * (p - i); };
const SRGB = new Float32Array(8193); for (let i = 0; i <= 8192; i++) { const c = i / 8192; SRGB[i] = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
const toSrgb = (c) => { if (c >= 1) return 1.055 * Math.pow(c, 1 / 2.4) - 0.055; const p = c * 8192, i = p | 0; return SRGB[i] + (SRGB[i + 1] - SRGB[i]) * (p - i); };
const fLab = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const fInv = (t) => { const t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787; };

/* Mulberry32 + Box-Muller: vaste "willekeur" per foto, zodat korrel bij elke publicatie gelijk blijft */
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function ruis(n, seed) { const r = rng(seed), out = new Float32Array(n);
  for (let i = 0; i < n; i += 2) { const u = Math.max(r(), 1e-12), v = r(), m = Math.sqrt(-2 * Math.log(u));
    out[i] = m * Math.cos(2 * Math.PI * v); if (i + 1 < n) out[i + 1] = m * Math.sin(2 * Math.PI * v); }
  return out; }

/* ── het recept ──────────────────────────────────────────────────────────
   pixels: Uint8Array/Uint8ClampedArray met RGB (kanalen=3) of RGBA (kanalen=4), al op weergavemaat.
   Geeft een nieuwe array met dezelfde opbouw terug (alfa blijft gelijk). */
export function pasHuisstijlToe(pixels, w, h, kanalen = 3, P = RECEPT_V5, seed = 7) {
  const N = w * h;
  let R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  for (let i = 0, j = 0; i < N; i++, j += kanalen) { R[i] = pixels[j] / 255; G[i] = pixels[j + 1] / 255; B[i] = pixels[j + 2] / 255; }
  if (P.verzacht > 0) { R = blur(R, w, h, P.verzacht); G = blur(G, w, h, P.verzacht); B = blur(B, w, h, P.verzacht); }
  // naar Lab
  let l = new Float32Array(N); const a = new Float32Array(N), b = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = toLin(Math.min(1, Math.max(0, R[i]))), g = toLin(Math.min(1, Math.max(0, G[i]))), bb = toLin(Math.min(1, Math.max(0, B[i])));
    const X = (0.412453 * r + 0.357580 * g + 0.180423 * bb) / Xn, Y = 0.212671 * r + 0.715160 * g + 0.072169 * bb, Z = (0.019334 * r + 0.119193 * g + 0.950227 * bb) / Zn;
    const fx = fLab(X), fy = fLab(Y), fz = fLab(Z);
    l[i] = Y > 0.008856 ? 116 * fy - 16 : 903.3 * Y; a[i] = 500 * (fx - fy); b[i] = 200 * (fy - fz);
  }
  // licht: zwart- en witpunt, contrast
  let sm = blur(l, w, h, 3); const p1 = percentiel(sm, 1), p99 = percentiel(sm, 99);
  const t1 = p1 + (P.zwart - p1) * P.kracht_toon, t99 = p99 + (97 - p99) * P.kracht_toon * 0.3, span = Math.max(p99 - p1, 1e-3);
  for (let i = 0; i < N; i++) l[i] = t1 + (l[i] - p1) * (t99 - t1) / span;
  const s = gemStd(sm)[1] * Math.abs(t99 - t1) / span, f = 1 + ((P.contrast / Math.max(s, 1e-3)) - 1) * P.kracht_contrast, med = percentiel(l, 50);
  for (let i = 0; i < N; i++) l[i] = med + (l[i] - med) * f;
  // textuur op materiaalstructuur, minder in diepe schaduw; maat schaalt mee met de foto
  const sc = Math.max(w / 1600, 0.5);
  const tw = blur(l, w, h, 4 * sc), fijn = blur(l, w, h, 1.0 * sc), grof = blur(l, w, h, 8 * sc);
  for (let i = 0; i < N; i++) { const wt = Math.min(1, Math.max(0.15, (tw[i] - 8) / 22)); l[i] += (fijn[i] - grof[i]) * P.textuur * wt; }
  // hooglichten: alleen het algemene lichtniveau afronden (wolken blijven), toppen nooit digitaal felwit
  const base = blur(l, w, h, 300 * sc), k = 75, span2 = P.wit - k, fac = 1 / (1 - P.schouder + 1e-3);
  for (let i = 0; i < N; i++) {
    const det = l[i] - base[i]; let bs = base[i];
    if (bs > k) bs = k + span2 * (1 - Math.exp(-(bs - k) / span2 * fac));
    let v = bs + det;
    if (v > 92) { const o = v - 92; v = 92 + o / (1 + o / 4); }
    if (v < P.teen_tot) v = P.teen_vloer + (P.teen_tot - P.teen_vloer) * Math.pow(Math.max(v, 0) / P.teen_tot, 1.25);
    l[i] = Math.min(100, Math.max(0, v));
  }
  // kleurzweem: neutrale delen richting neutraal-warm
  const ab = blur(a, w, h, 3), bbl = blur(b, w, h, 3); let na = 0, nb = 0, nn = 0;
  for (let i = 0; i < N; i++) if (Math.hypot(ab[i], bbl[i]) < 6) { na += a[i]; nb += b[i]; nn++; }
  if (nn / N > 0.02) {
    const da = Math.min(3, Math.max(-3, (P.zweem_a - na / nn) * P.kracht_zweem)), db = Math.min(3, Math.max(-3, (P.zweem_b - nb / nn) * P.kracht_zweem));
    for (let i = 0; i < N; i++) { a[i] += da; b[i] += db; }
  }
  // lichte palettoets: groen bijna echt, blauw iets stoffiger, hooglichten iets warm wit
  const softcap = (C, cap) => { const kk = 0.7 * cap; return C < kk ? C : kk + (C - kk) / (1 + (C - kk) / (0.3 * cap)); };
  let cs = 0;
  for (let i = 0; i < N; i++) {
    let C = Math.hypot(a[i], b[i]), hh = ((Math.atan2(b[i], a[i]) * 180 / Math.PI) + 360) % 360;
    const wg = Math.pow(Math.min(1, Math.max(0, 1 - Math.abs(hh - 140) / 55)), 0.8), wb = Math.pow(Math.min(1, Math.max(0, 1 - Math.abs(hh - 250) / 60)), 0.8);
    hh = hh + wg * P.groen_mee * (P.groen_naar - hh) + wb * P.blauw_mee * (P.blauw_tint - hh); C = C * (1 - wg * P.groen_demp);
    let aa = a[i], bv = b[i];
    if (wb + wg > 0.05) { C = softcap(C, wb > wg ? P.blauw_max : P.groen_max); aa = C * Math.cos(hh * Math.PI / 180); bv = C * Math.sin(hh * Math.PI / 180); }
    else if (wg + wb > 0) { aa = C * Math.cos(hh * Math.PI / 180); bv = C * Math.sin(hh * Math.PI / 180); }
    const wt = Math.min(1, Math.max(0, (l[i] - 75) / 20)) * (1 - Math.min(1, Math.max(0, C / 20)));
    aa += wt * P.licht_mee * (P.licht_a - aa); bv += wt * P.licht_mee * (P.licht_b - bv);
    a[i] = aa; b[i] = bv; cs += Math.hypot(aa, bv);
  }
  const kv = Math.min(1.08, Math.max(0.92, 1 + ((P.verz / Math.max(cs / N, 1e-3)) - 1) * P.kracht_verz));
  // korrel vooraf: twee lagen, iets in klontjes, genormaliseerd
  let n1 = blur(ruis(N, seed), w, h, P.korrel_grof), n2 = blur(ruis(N, seed + 101), w, h, 0.4);
  const s1 = gemStd(n1)[1] || 1, s2 = gemStd(n2)[1] || 1; const nz = new Float32Array(N);
  for (let i = 0; i < N; i++) nz[i] = n1[i] / s1 * 0.75 + n2[i] / s2 * 0.45;
  const s3 = gemStd(nz)[1] || 1;
  // terug naar RGB + split-toon + vignet + korrel
  const out = new Uint8ClampedArray(pixels.length);
  const DX = new Float32Array(w), DY = new Float32Array(h);
  for (let x = 0; x < w; x++) { const v = (x - w / 2) / (w / 2); DX[x] = v * v; }
  for (let y = 0; y < h; y++) { const v = (y - h / 2) / (h / 2); DY[y] = v * v; }
  for (let i = 0, j = 0; i < N; i++, j += kanalen) {
    const t = Math.min(1, Math.max(0, l[i] / 100));
    const A = a[i] * kv, Bv = b[i] * kv + P.split_schaduw * (1 - t) * (1 - t) + P.split_licht * t * t;
    const fy = (l[i] + 16) / 116, fx = fy + A / 500, fz = fy - Bv / 200;
    const X = fInv(fx) * Xn, Y = l[i] > 7.9996 ? fy * fy * fy : l[i] / 903.3, Z = fInv(fz) * Zn;
    let r = 3.240479 * X - 1.537150 * Y - 0.498535 * Z, g = -0.969256 * X + 1.875992 * Y + 0.041556 * Z, bb = 0.055648 * X - 0.204043 * Y + 1.057311 * Z;
    r = toSrgb(Math.max(0, r)) * 255; g = toSrgb(Math.max(0, g)) * 255; bb = toSrgb(Math.max(0, bb)) * 255;
    const x = i % w, y = (i / w) | 0, rr = Math.sqrt(DX[x] + DY[y]) / 1.414;
    const vv = Math.min(1, Math.max(0, (rr - 0.45) / 0.55)), vig = 1 - P.vignet * vv * vv;
    const kw = 0.45 + 0.55 * Math.min(1, Math.max(0, 1 - Math.abs(l[i] - 45) / 50));
    const korrel = nz[i] / s3 * P.korrel * kw;
    out[j] = r * vig + korrel; out[j + 1] = g * vig + korrel; out[j + 2] = bb * vig + korrel;
    if (kanalen === 4) out[j + 3] = pixels[j + 3];
  }
  return out;
}
