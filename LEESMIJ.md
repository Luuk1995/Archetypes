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
