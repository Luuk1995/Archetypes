# Arche!Types — hoe de site gebouwd wordt

Je werkt zoals altijd: **alles via de admin** (`arche-types.nl/admin`).
Bij elke publicatie doet Netlify automatisch het volgende:

1. **`scripts/build.mjs`** leest alle projecten, objecten, info, video's en vindbaarheid uit de admin.
2. Maakt van elke projectfoto een lichte webversie (je originelen blijven onaangeroerd).
3. Zet alles direct in de pagina → sneller, en Google leest alle teksten.
4. Schrijft `sitemap.xml` en `robots.txt` voor zoekmachines.

**Veilig:** als het script ooit een fout tegenkomt, gaat de site gewoon live zoals hij zonder script werkt.
In het Netlify-logboek zie je bij een geslaagde publicatie regels die beginnen met `[arche!types]`.

| Bestand | Wat het doet |
|---|---|
| `netlify.toml` | Netlify-instellingen: bouwstap, map, doorverwijzing oud adres |
| `package.json` / `package-lock.json` | Gereedschap voor het verkleinen van foto's (automatisch geïnstalleerd) |
| `scripts/build.mjs` | Het bouwscript |
| `archetypes-upload/data/seo.json` | Titel en beschrijving voor Google — aan te passen in de admin onder *Instellingen → Vindbaarheid* |

Aan deze bestanden hoef je niets te doen.

## Foto's uploaden

Sleep foto's gewoon op volle kwaliteit in de admin. Is een foto groter dan 3000 px of zwaarder dan 2,5 MB, dan verkleint je browser hem automatisch (max. 3000 px, hoge kwaliteit; `archetypes-upload/admin/foto-verkleiner.js`). Bij publiceren maakt het bouwscript er nog lichte webversies van (1600 px voor overzicht en mobiel, 2800 px voor de slideshow).

## Slideshow

De tekstslide in de slideshow verschijnt alleen als *Tekst in slider* is ingevuld. Leeg = geen tekstslide (de hovertekst wordt niet herhaald).
