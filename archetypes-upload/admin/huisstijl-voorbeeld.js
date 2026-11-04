/* ═══════════════════════════════════════════════════════════════
   LIVE VOORBEELD (admin)
   Toont rechts in de admin je project mét de fotohuisstijl,
   met precies dezelfde berekening als bij het publiceren (/huisstijl.js).
   Schakelaar "Huisstijl toepassen" aan/uit → voorbeeld past zich aan.
   Knop Kleur / Zwart-wit → zoals een geopend project / het overzicht.
   ═══════════════════════════════════════════════════════════════ */
import { pasHuisstijlToe, receptMet } from '/huisstijl.js';

const CMS = window.CMS, h = window.h, createClass = window.createClass;
const BREEDTE = 1200;                     // voorbeeldmaat (site: 1600 overzicht, 2800 slideshow)
const SLEUTELS = ['image', 'image2', 'image3', 'image4', 'image5', 'image6', 'image7', 'image8'];

let receptBelofte = null;
const recept = () => receptBelofte || (receptBelofte =
  fetch('/data/fotostijl.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then(receptMet));

const cache = new Map();
function verwerk(url, aan, R) {
  const key = url + '|' + aan;
  if (cache.has(key)) return cache.get(key);
  const p = new Promise((klaar) => {
    if (!aan) { klaar(url); return; }
    const img = new Image();
    img.onload = () => {
      // even wachten zodat de admin eerst kan tekenen; daarna rekenen
      setTimeout(() => {
        try {
          const W = Math.min(BREEDTE, img.naturalWidth), H = Math.round(img.naturalHeight * W / img.naturalWidth);
          const c = document.createElement('canvas'); c.width = W; c.height = H;
          const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, W, H);
          const d = x.getImageData(0, 0, W, H);
          d.data.set(pasHuisstijlToe(d.data, W, H, 4, R, 7)); x.putImageData(d, 0, 0);
          c.toBlob((b) => klaar(b ? URL.createObjectURL(b) : url), 'image/jpeg', 0.92);
        } catch (e) { console.warn('[huisstijl] voorbeeld niet gelukt:', e); klaar(url); }
      }, 30);
    };
    img.onerror = () => klaar(url);
    img.src = url;
  });
  cache.set(key, p);
  return p;
}

const knop = (actief) => ({
  padding: '6px 12px', border: '1px solid #fff', background: actief ? '#fff' : 'transparent',
  color: actief ? '#0a0a0e' : '#fff', font: '600 12px/1 monospace', letterSpacing: '.08em', cursor: 'pointer',
});

const Voorbeeld = createClass({
  getInitialState() { return { zw: false, beelden: [], bezig: false }; },
  componentDidMount() { this.bereken(); },
  componentDidUpdate(vorige) { if (vorige.entry !== this.props.entry) this.bereken(); },
  bereken() {
    const e = this.props.entry, aan = e.getIn(['data', 'huisstijl']) === true;
    const urls = SLEUTELS.map((k) => e.getIn(['data', k])).filter((v) => v && String(v).trim())
      .map((v) => String(this.props.getAsset(v)));
    const sleutel = urls.join('|') + '|' + aan;
    if (sleutel === this._laatste) return;
    this._laatste = sleutel; const beurt = (this._beurt = (this._beurt || 0) + 1);
    this.setState({ bezig: aan && urls.length > 0 });
    recept().then((R) => Promise.all(urls.map((u) => verwerk(u, aan, R))))
      .then((b) => { if (beurt === this._beurt) this.setState({ beelden: b, bezig: false }); });
  },
  render() {
    const e = this.props.entry, aan = e.getIn(['data', 'huisstijl']) === true;
    const titel = e.getIn(['data', 'title']) || '', sub = e.getIn(['data', 'sub']) || '';
    const zw = this.state.zw;
    return h('div', { style: { background: '#0a0a0e', color: '#fff', minHeight: '100vh', padding: '18px', fontFamily: 'monospace' } },
      h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' } },
        h('button', { style: knop(!zw), onClick: () => this.setState({ zw: false }) }, 'KLEUR · GEOPEND PROJECT'),
        h('button', { style: knop(zw), onClick: () => this.setState({ zw: true }) }, 'ZWART-WIT · OVERZICHT'),
        h('span', { style: { fontSize: '12px', opacity: 0.85, marginLeft: '6px' } },
          aan ? (this.state.bezig ? 'Huisstijl wordt berekend…' : 'Huisstijl: aan') : 'Huisstijl: uit — foto’s zoals geüpload')),
      h('div', { style: { fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontSize: '15px' } }, titel),
      sub ? h('div', { style: { marginTop: '4px', fontSize: '13px' } }, sub) : null,
      h('div', { style: { display: 'grid', gap: '10px', marginTop: '16px' } },
        this.state.beelden.map((src, i) => h('img', {
          key: i, src, alt: '',
          style: { width: '100%', display: 'block', filter: zw ? 'grayscale(1)' : 'none', transition: 'filter .35s ease-out' },
        }))));
  },
});

if (CMS && h && createClass) {
  CMS.registerPreviewTemplate('projecten', Voorbeeld);
  CMS.registerPreviewTemplate('objecten', Voorbeeld);
} else {
  console.warn('[huisstijl] admin niet gevonden; voorbeeld niet geregistreerd');
}
