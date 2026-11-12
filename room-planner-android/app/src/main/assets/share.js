/* ===================== PICTURES, 360° VIDEO, ITEM LIST PDF, SHARING =====================
 * • Picture  — the current 3D view as a JPEG, with the customer's name and room size.
 * • 360° video — the camera circles the room once (about 12 s) and is recorded.
 * • Item list — PDF with the customer's details, room size, a picture of the room and
 *   every catalogue item (size, colour, quantity) to take into the 4S Orders app.
 * Each can be saved, or sent by WhatsApp (to the customer's number) or email (to the
 * customer's email id). In the Android app this goes through the app's own share
 * bridge (RPNative); in a browser / iPhone it uses the phone's share sheet.
 */
(function () {
  var P = window.__planner;
  var busy = false;

  function cust() { return P.state().customer || {}; }
  function slug(s) { return String(s || 'customer').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'customer'; }
  function dateStr() { return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function roomTxt() { var R = P.state().room; return 'Room ' + P.fmtLen(R.w) + ' × ' + P.fmtLen(R.l) + ', height ' + P.fmtLen(R.h); }

  /* ---------- deliver a file ---------- */
  function blobToB64(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(',')[1]); }; fr.onerror = rej; fr.readAsDataURL(blob);
    });
  }
  function waNumber() { var m = String(cust().mobile || '').replace(/\D/g, ''); return m.length === 10 ? '91' + m : m; }
  function deliver(blob, name, target, text) {
    var c = cust(), subject = '4S Interiors – room design for ' + (c.name || 'you');
    if (window.RPNative && RPNative.shareFile) {
      return blobToB64(blob).then(function (b64) {
        RPNative.shareFile(b64, name, blob.type || 'application/octet-stream', target, waNumber(), c.email || '', subject, text || '');
      });
    }
    var file = null;
    try { file = new File([blob], name, { type: blob.type }); } catch (e) {}
    var download = function () {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    };
    if (target === 'save') { download(); P.toast('Saved ' + name); return Promise.resolve(); }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      // The share sheet lets the user pick WhatsApp or Mail; the customer's details are in the text.
      return navigator.share({ files: [file], title: subject, text: text || subject }).catch(function (e) { if (e && e.name !== 'AbortError') throw e; });
    }
    download();
    if (target === 'whatsapp') window.open('https://wa.me/' + waNumber() + '?text=' + encodeURIComponent((text || subject) + '\n(File saved on this device — please attach it.)'), '_blank');
    if (target === 'email') location.href = 'mailto:' + encodeURIComponent(c.email || '') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent((text || '') + '\n\n(Please attach the saved file: ' + name + ')');
    return Promise.resolve();
  }

  /* ---------- picture ---------- */
  function frame() { P.applyCam(); P.renderer.render(P.scene, P.camera); return P.renderer.domElement; }
  function snapshotCanvas(withBanner) {
    var src = frame(), W = src.width, H = src.height, bh = withBanner ? Math.round(Math.max(54, W * .055)) : 0;
    var c = document.createElement('canvas'); c.width = W; c.height = H + bh;
    var g = c.getContext('2d'); g.fillStyle = '#f3efe9'; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0);
    if (withBanner) {
      g.fillStyle = '#8a1538'; g.fillRect(0, H, W, bh);
      g.fillStyle = '#fff'; g.font = '700 ' + Math.round(bh * .34) + 'px system-ui,sans-serif'; g.textBaseline = 'middle';
      g.fillText('4S Interiors · Interio by Godrej Patia', bh * .3, H + bh * .36);
      g.font = '400 ' + Math.round(bh * .26) + 'px system-ui,sans-serif';
      var R = P.state().room;
      g.fillText((cust().name ? cust().name + ' · ' : '') + (R.w / P.FT).toFixed(1) + ' × ' + (R.l / P.FT).toFixed(1) + ' ft room · ' + dateStr(), bh * .3, H + bh * .74);
    }
    return c;
  }
  function picture(target) {
    P.select(null);
    var c = snapshotCanvas(true);
    return new Promise(function (res) { c.toBlob(res, 'image/jpeg', .92); }).then(function (blob) {
      return deliver(blob, 'Room-' + slug(cust().name) + '-' + Date.now().toString().slice(-5) + '.jpg', target, 'Room design for ' + (cust().name || '') + ' — 4S Interiors');
    });
  }

  /* ---------- 360° video ---------- */
  function pickMime() {
    var opts = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    if (!window.MediaRecorder) return null;
    for (var i = 0; i < opts.length; i++) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(opts[i])) return opts[i];
    return '';
  }
  function video(target, onProgress) {
    var cv = P.renderer.domElement, mime = pickMime();
    if (mime === null || !cv.captureStream) return Promise.reject(new Error('This phone’s browser cannot record video. Please update Android System WebView / Chrome, or use iPhone Safari.'));
    P.select(null);
    var R = P.state().room, cam = P.cam, start = Object.assign({}, cam), dur = 12;
    var target0 = { tx: 0, ty: R.h * .3, tz: 0, r: P.fitR() * .95, ph: 1.0, fov: 50 };
    var stream = cv.captureStream(30), chunks = [], rec;
    try { rec = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5e6 }) : new MediaRecorder(stream); }
    catch (e) { return Promise.reject(e); }
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    return new Promise(function (res, rej) {
      var t = 0, th0 = cam.th;
      Object.assign(cam, target0);
      window.__camDriver = function (dt) {
        t += dt; cam.th = th0 + Math.min(1, t / dur) * Math.PI * 2;
        if (onProgress) onProgress(Math.min(1, t / dur));
        if (t >= dur && rec.state === 'recording') { window.__camDriver = function () {}; setTimeout(function () { rec.stop(); }, 150); }
      };
      rec.onstop = function () {
        window.__camDriver = null; Object.assign(cam, start);
        var type = (rec.mimeType || mime || 'video/webm').split(';')[0];
        res(new Blob(chunks, { type: type }));
      };
      rec.onerror = function (e) { window.__camDriver = null; Object.assign(cam, start); rej(e.error || e); };
      rec.start(500);
    }).then(function (blob) {
      var ext = /mp4/.test(blob.type) ? 'mp4' : 'webm';
      return deliver(blob, 'Room-360-' + slug(cust().name) + '.' + ext, target, '360° view of the room design for ' + (cust().name || '') + ' — 4S Interiors');
    });
  }

  /* ---------- item list PDF ---------- */
  function orderLines() {
    var s = P.state(), groups = {}, order = [];
    s.items.filter(function (i) { return i.src !== 'photo' && i.pid != null; }).forEach(function (i) {
      var p = P.BYID[i.pid], v = p && p.v[i.vi];
      var k = [i.pid, i.vi, i.shade || '', Math.round(i.w * 100), Math.round(i.d * 100), Math.round(i.h * 100)].join('|');
      if (!groups[k]) {
        groups[k] = { product: p ? p.name : i.name, range: p ? p.sub : '', variant: v ? v.n : '', size: Math.round(i.w * 100) + ' × ' + Math.round(i.d * 100) + ' × ' + Math.round(i.h * 100) + ' cm' + (i.est ? ' (approx.)' : ''),
          colour: i.shade || 'As catalogue', page: p && p.page ? 'p.' + p.page : '', qty: 0 };
        order.push(k);
      }
      groups[k].qty++;
    });
    return order.map(function (k) { return groups[k]; });
  }
  function existingLines() { return P.state().items.filter(function (i) { return i.src === 'photo'; }).map(function (i) { return i.name.replace(/^Existing /, '').replace(/ \(from photo\)$/, ''); }); }

  function ensureJsPDF() {
    if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'vendor/jspdf.umd.min.js';
      s.onload = function () { res(window.jspdf.jsPDF); }; s.onerror = function () { rej(new Error('PDF library failed to load')); };
      document.head.appendChild(s);
    });
  }
  function clean(t) { return String(t || '').replace(/[≈]/g, '~').replace(/[^\x20-\x7E -ÿ–—‘’“”•×]/g, ''); }

  function makePdf() {
    P.select(null);
    var img = snapshotCanvas(false).toDataURL('image/jpeg', .85), c = cust(), lines = orderLines(), ex = existingLines();
    return ensureJsPDF().then(function (JsPDF) {
      var doc = new JsPDF({ unit: 'mm', format: 'a4' }), W = 210, M = 14, y = 0;
      doc.setFillColor(138, 21, 56); doc.rect(0, 0, W, 26, 'F');
      doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text('4S Interiors – Room Plan', M, 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text('Interio by Godrej Patia', M, 19);
      doc.text(dateStr(), W - M, 12, { align: 'right' });
      y = 36; doc.setTextColor(40);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Customer', M, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      y += 6; doc.text(clean('Name: ' + (c.name || '-')), M, y);
      y += 5.5; doc.text(clean('Mobile: ' + (c.mobile ? '+91 ' + c.mobile : '-')), M, y);
      y += 5.5; doc.text(clean('Email: ' + (c.email || '-')), M, y);
      y += 5.5; doc.text(clean(roomTxt().replace(/×/g, 'x')), M, y);
      if (c.by) { y += 5.5; doc.text(clean('Prepared by: ' + c.by), M, y); }
      // room picture
      var cv = P.renderer.domElement, ar = cv.height / cv.width, iw = W - 2 * M, ih = Math.min(95, iw * ar); iw = ih / ar;
      y += 6; doc.addImage(img, 'JPEG', (W - iw) / 2, y, iw, ih); y += ih + 8;
      // items table
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Items for the order (' + lines.reduce(function (a, l) { return a + l.qty; }, 0) + ')', M, y); y += 3;
      var cols = [{ h: '#', w: 8 }, { h: 'Product', w: 58 }, { h: 'Size / variant', w: 46 }, { h: 'W × D × H', w: 34 }, { h: 'Colour', w: 26 }, { h: 'Qty', w: 10 }];
      var row = function (vals, bold, shade) {
        var lh = 4.6, wrapped = vals.map(function (v, i) { return doc.splitTextToSize(clean(v), cols[i].w - 2); });
        var h = Math.max.apply(null, wrapped.map(function (w) { return w.length; })) * lh + 2.4;
        if (y + h > 285) { doc.addPage(); y = 16; }
        if (shade) { doc.setFillColor(shade[0], shade[1], shade[2]); doc.rect(M, y, W - 2 * M, h, 'F'); }
        doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(9);
        var x = M; wrapped.forEach(function (w, i) { doc.text(w, x + 1, y + 4.2); x += cols[i].w; });
        y += h; doc.setDrawColor(225); doc.line(M, y, W - M, y);
      };
      y += 2; row(cols.map(function (c) { return c.h.replace(/×/g, 'x'); }), true, [243, 239, 233]);
      if (!lines.length) row(['', 'No catalogue items added yet', '', '', '', ''], false);
      lines.forEach(function (l, i) { row([String(i + 1), l.product + (l.range ? ' (' + l.range + ')' : '') + (l.page ? ' ' + l.page : ''), l.variant || '-', l.size.replace(/×/g, 'x'), l.colour, String(l.qty)], false); });
      if (ex.length) {
        y += 6; if (y > 270) { doc.addPage(); y = 16; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Customer’s existing furniture (from room photos, not for order)'.replace('’', "'"), M, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); y += 5; doc.text(doc.splitTextToSize(clean(ex.join(', ')), W - 2 * M), M, y); y += 8;
      }
      y += 6; if (y > 280) { doc.addPage(); y = 16; }
      doc.setFontSize(8.5); doc.setTextColor(110);
      doc.text(doc.splitTextToSize('Sizes are from the Interio catalogue (W x D x H). Prices, exact item codes and availability are confirmed when the order is booked in the 4S Orders app.', W - 2 * M), M, y);
      return doc.output('blob');
    });
  }
  function pdf(target) {
    return makePdf().then(function (blob) {
      var c = cust(), n = orderLines().reduce(function (a, l) { return a + l.qty; }, 0);
      return deliver(blob, 'Room-items-' + slug(c.name) + '.pdf', target, 'Dear ' + (c.name || 'Customer') + ', here is the list of ' + n + ' item' + (n === 1 ? '' : 's') + ' for your room from 4S Interiors (Interio by Godrej Patia).');
    });
  }

  /* ---------- panel in the "List & share" tab ---------- */
  function panel() {
    var c = cust(), n = orderLines().reduce(function (a, l) { return a + l.qty; }, 0);
    return '<div class="card sharecard"><div class="hd"><span>Share with ' + P.esc(c.name || 'the customer') + '</span></div>' +
      '<div class="shrow"><b>📷 Picture of the room</b><div><button data-sh="pic:save">Download</button><button data-sh="pic:whatsapp">WhatsApp</button><button data-sh="pic:email">Email</button></div></div>' +
      '<div class="shrow"><b>🎬 360° video</b><div><button data-sh="vid:save">Download</button><button data-sh="vid:whatsapp">WhatsApp</button><button data-sh="vid:email">Email</button></div></div>' +
      '<div class="shrow"><b>📄 Item list (PDF) · ' + n + ' item' + (n === 1 ? '' : 's') + '</b><div><button data-sh="pdf:save">Download</button><button data-sh="pdf:whatsapp">WhatsApp</button><button data-sh="pdf:email">Email</button></div></div>' +
      '<div id="shBusy" class="note" style="margin:6px 0 0"></div>' +
      (c.mobile || c.email ? '<p class="note" style="margin:6px 0 0">WhatsApp goes to +91 ' + P.esc(c.mobile || '') + (c.email ? ', email to ' + P.esc(c.email) : '') + '.</p>' : '') + '</div>';
  }
  var css = document.createElement('style');
  css.textContent = '.sharecard .shrow{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0;border-top:1px solid var(--line);flex-wrap:wrap}' +
    '.sharecard .shrow b{font-size:12.5px}.sharecard .shrow div{display:flex;gap:5px}' +
    '.sharecard button{border:1px solid var(--line);background:#fff;border-radius:8px;padding:7px 9px;font-size:12px;font-weight:600;color:var(--ink)}' +
    '.sharecard button[data-sh$=whatsapp]{color:#128c4b}.sharecard button:disabled{opacity:.5}' +
    '#recOv{position:absolute;inset:auto 10px 10px 10px;z-index:6;background:rgba(42,38,34,.9);color:#fff;border-radius:12px;padding:10px 12px;font-size:13px;display:none}' +
    '#recOv i{display:block;height:4px;background:rgba(255,255,255,.25);border-radius:2px;margin-top:6px;overflow:hidden}#recOv i b{display:block;height:100%;width:0;background:#fff}';
  document.head.appendChild(css);
  var ov = document.createElement('div'); ov.id = 'recOv'; ov.innerHTML = '<span>Recording 360° video…</span><i><b></b></i>';
  document.getElementById('stage').appendChild(ov);

  document.getElementById('p-items').addEventListener('click', function (e) {
    var b = e.target.closest('[data-sh]'); if (!b || busy) return;
    var a = b.dataset.sh.split(':'), what = a[0], target = a[1], info = document.getElementById('shBusy');
    var btns = document.querySelectorAll('[data-sh]'); busy = true; btns.forEach(function (x) { x.disabled = true; });
    var done = function (err) {
      busy = false; ov.style.display = 'none'; document.querySelectorAll('[data-sh]').forEach(function (x) { x.disabled = false; });
      var i2 = document.getElementById('shBusy'); if (i2) i2.textContent = err ? 'Could not create it: ' + (err.message || err) : '';
    };
    var job;
    if (what === 'pic') { info.textContent = 'Creating picture…'; job = picture(target); }
    if (what === 'pdf') { info.textContent = 'Creating PDF…'; job = pdf(target); }
    if (what === 'vid') {
      info.textContent = 'Recording — keep the app open…';
      if (!P.wide()) P.setTab(null);
      ov.style.display = 'block';
      // let the panel close and the 3D view settle at its final size before recording
      job = new Promise(function (r) { setTimeout(r, 450); }).then(function () {
        return video(target, function (f) { ov.querySelector('b').style.width = Math.round(f * 100) + '%'; });
      });
    }
    job.then(function () { done(); }, done);
  });

  window.RPShare = { panel: panel, picture: picture, video: video, pdf: pdf, makePdf: makePdf, orderLines: orderLines };
})();
