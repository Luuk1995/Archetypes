/* ═══════════════════════════════════════════════════════════════
   NETLIFY-HULPJE "FOTO-OPSLAG" (het bouwscript zelf staat in build.mjs)
   Bewaart de bewerkte foto's (archetypes-upload/_opt) tussen
   publicaties, zodat alleen nieuwe of gewijzigde foto's opnieuw
   bewerkt hoeven te worden. Gaat er iets mis, dan wordt gewoon
   alles opnieuw gemaakt: een publicatie wordt nooit geblokkeerd.
   ═══════════════════════════════════════════════════════════════ */
const MAP = 'archetypes-upload/_opt';
export const onPreBuild = async ({ utils }) => {
  try { const ok = await utils.cache.restore(MAP); console.log(ok ? "[foto-opslag] bewerkte foto's van vorige keer teruggezet" : "[foto-opslag] nog geen opgeslagen foto's (eerste keer)"); }
  catch (e) { console.log('[foto-opslag] terugzetten overgeslagen:', e.message); }
};
export const onPostBuild = async ({ utils }) => {
  try { const ok = await utils.cache.save(MAP); console.log(ok ? "[foto-opslag] bewerkte foto's bewaard voor de volgende keer" : '[foto-opslag] niets te bewaren'); }
  catch (e) { console.log('[foto-opslag] bewaren overgeslagen:', e.message); }
};
