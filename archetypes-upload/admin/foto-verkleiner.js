/* ═══════════════════════════════════════════════════════════════
   FOTO-VERKLEINER (admin)
   Kies je in de admin een foto die groter is dan 3000 px of zwaarder
   dan 2,5 MB, dan verkleint je browser hem vóór het opslaan naar
   max. 3000 px in hoge kwaliteit (meestal 1–2 MB). Je originele
   bestand op je computer blijft onaangeroerd.
   Lukt verkleinen niet, dan gaat de foto gewoon ongewijzigd door.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var MAX = 3000, KWALITEIT = 0.9, DREMPEL = 2.5 * 1024 * 1024;
  var mb = function (n) { return (n / 1048576).toFixed(1).replace('.', ',') + ' MB'; };

  function melding(tekst) {
    var d = document.createElement('div');
    d.textContent = tekst;
    d.style.cssText = 'position:fixed;z-index:2147483647;left:50%;bottom:24px;transform:translateX(-50%);' +
      'background:#1d1d1b;color:#fff;font:14px/1.4 system-ui,sans-serif;padding:10px 16px;border-radius:6px;' +
      'box-shadow:0 4px 18px rgba(0,0,0,.3);pointer-events:none';
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 4500);
  }

  function heeftDoorzichtigheid(ctx, w, h) {
    var d = ctx.getImageData(0, 0, w, h).data;
    for (var i = 3; i < d.length; i += 16) if (d[i] < 250) return true;
    return false;
  }

  async function verklein(file) {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return file;          // andere bestanden ongemoeid
    var bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { return file; }
    var w = bmp.width, h = bmp.height, schaal = Math.min(1, MAX / Math.max(w, h));
    if (schaal === 1 && file.size <= DREMPEL) { if (bmp.close) bmp.close(); return file; }
    var tw = Math.max(1, Math.round(w * schaal)), th = Math.max(1, Math.round(h * schaal));
    // in stappen halveren: scherper resultaat bij grote verkleiningen
    var bron = bmp, bw = w, bh = h;
    while (bw / 2 >= tw * 1.4) {
      var tussen = document.createElement('canvas'); tussen.width = Math.round(bw / 2); tussen.height = Math.round(bh / 2);
      var tc = tussen.getContext('2d'); tc.imageSmoothingQuality = 'high'; tc.drawImage(bron, 0, 0, tussen.width, tussen.height);
      bron = tussen; bw = tussen.width; bh = tussen.height;
    }
    var c = document.createElement('canvas'); c.width = tw; c.height = th;
    var ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bron, 0, 0, tw, th);
    if (bmp.close) bmp.close();
    var png = /png/i.test(file.type) && heeftDoorzichtigheid(ctx, tw, th);       // doorzichtige PNG blijft PNG
    var blob = await new Promise(function (res) { c.toBlob(res, png ? 'image/png' : 'image/jpeg', KWALITEIT); });
    if (!blob || blob.size >= file.size) return file;                              // niets gewonnen: origineel houden
    var naam = png ? file.name : file.name.replace(/\.(png|webp|jpe?g)$/i, '') + '.jpg';
    return new File([blob], naam, { type: blob.type, lastModified: Date.now() });
  }

  // Vang de bestandskeuze op vóór de admin hem ziet, verklein, en geef hem daarna door
  window.addEventListener('change', function (e) {
    var inp = e.target;
    if (!inp || inp.tagName !== 'INPUT' || inp.type !== 'file' || !inp.files || !inp.files.length) return;
    if (inp.__verkleind) { inp.__verkleind = false; return; }                       // onze eigen doorgifte
    var files = Array.prototype.slice.call(inp.files);
    if (!files.some(function (f) { return /^image\//i.test(f.type); })) return;
    e.stopImmediatePropagation(); e.stopPropagation();
    var voor = files.reduce(function (s, f) { return s + f.size; }, 0);
    Promise.all(files.map(function (f) { return verklein(f).catch(function () { return f; }); }))
      .then(function (nieuw) {
        try { var dt = new DataTransfer(); nieuw.forEach(function (f) { dt.items.add(f); }); inp.files = dt.files; } catch (err) {}
        var na = nieuw.reduce(function (s, f) { return s + f.size; }, 0);
        if (na < voor) melding('Foto verkleind: ' + mb(voor) + ' → ' + mb(na));
      })
      .finally(function () { inp.__verkleind = true; inp.dispatchEvent(new Event('change', { bubbles: true })); });
  }, true);
})();
