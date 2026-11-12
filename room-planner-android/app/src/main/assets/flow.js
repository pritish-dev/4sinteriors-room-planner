/* ===================== START-UP FLOW =====================
 * After sign-in:
 *   1. Customer details (name, mobile, email) — asked every time the app opens.
 *   2. Room size (width, length, height) + optional room photos.
 *      → an empty room is built with its measurements marked on the walls, and any
 *        furniture recognised in the photos is placed in it (detect.js).
 *   3. The catalogue opens so products can be added.
 * Designs are kept on the device (last 20) so a customer's room can be reopened.
 */
(function () {
  var P = window.__planner, FT = P.FT, PKEY = 'rp-projects-v1', MAXP = 20;
  var photos = [];            // {id, img (dataURL, max 1280px), thumb, wall, found}
  var el, body;

  function esc(s) { return P.esc(s == null ? '' : s); }
  function lsGet(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  /* ---------- saved designs ---------- */
  function projects() { return lsGet(PKEY, []); }
  function storeProject() {
    var s = P.state(); if (!s.customer) return;
    var list = projects().filter(function (p) { return p.id !== s.customer.id; });
    list.unshift({ id: s.customer.id, at: Date.now(), state: s });
    while (list.length > MAXP) list.pop();
    while (!lsSet(PKEY, list) && list.length > 1) list.pop();   // storage full: drop the oldest
  }
  var origSave = P.save;
  // Every save also updates this customer's entry in the saved designs.
  P.save = function () { origSave(); clearTimeout(storeProject.t); storeProject.t = setTimeout(storeProject, 400); };

  /* ---------- overlay ---------- */
  function ensure() {
    if (el) return;
    var css = document.createElement('style');
    css.textContent = [
      '#flow{position:fixed;inset:0;z-index:40;background:rgba(243,239,233,.97);overflow-y:auto;padding:20px 16px;display:none}',
      '#flow.show{display:block}',
      '#flow .box{max-width:520px;margin:0 auto;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.08)}',
      '#flow .steps{display:flex;gap:6px;margin-bottom:14px}',
      '#flow .steps span{flex:1;height:4px;border-radius:2px;background:var(--line)}#flow .steps span.on{background:var(--accent)}',
      '#flow h2{font-size:18px;text-transform:none;letter-spacing:0;color:var(--ink);margin:0 0 4px}',
      '#flow p.sub{color:var(--mute);font-size:12.5px;margin:0 0 16px;line-height:1.45}',
      '#flow label.f{margin-bottom:12px}#flow label.f input,#flow label.f select{font-size:16px;padding:10px}',
      '#flow .err{display:none;background:#fdecef;color:#9b1030;border-radius:9px;padding:9px 10px;font-size:12.5px;margin-bottom:12px}',
      '#flow .row{display:flex;gap:8px;margin-top:6px}#flow .row .btn{flex:1;padding:12px;font-size:14.5px}',
      '#flow .recent{margin-top:18px;border-top:1px solid var(--line);padding-top:12px}',
      '#flow .recent button{display:flex;width:100%;justify-content:space-between;align-items:center;border:1px solid var(--line);background:var(--soft);border-radius:10px;padding:9px 11px;margin-bottom:6px;font-size:13px;color:var(--ink);text-align:left}',
      '#flow .recent small{color:var(--mute);font-size:11px;display:block}',
      '#flow .unitsw{display:flex;gap:6px;margin:0 0 10px}#flow .unitsw button{border:1px solid var(--line);background:var(--soft);border-radius:16px;padding:6px 12px;font-size:12.5px;color:var(--ink)}#flow .unitsw button.on{background:var(--ink);color:#fff;border-color:var(--ink)}',
      '.ph-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin:8px 0}',
      '.ph{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--soft);font-size:11.5px}',
      '.ph img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}',
      '.ph .pb{padding:6px;display:flex;flex-direction:column;gap:4px}',
      '.ph select{width:100%;padding:5px;border:1px solid var(--line);border-radius:7px;font-size:12px;background:#fff}',
      '.ph .x{border:0;background:none;color:#b00020;font-weight:600;font-size:12px;text-align:left;padding:2px 0}',
      '.ph .found{color:var(--mute)}',
      '.addph{display:flex;align-items:center;justify-content:center;gap:6px;border:1.5px dashed var(--line);border-radius:10px;padding:14px;font-weight:600;color:var(--accent);background:#fff;cursor:pointer;font-size:13.5px}',
      '#flowBusy{display:none;margin-top:10px;font-size:12.5px;color:var(--mute)}'
    ].join('\n');
    document.head.appendChild(css);
    el = document.createElement('div'); el.id = 'flow';
    el.innerHTML = '<div class="box"><div class="steps"><span></span><span></span><span></span></div><div id="flowBody"></div></div>';
    document.body.appendChild(el);
    body = el.querySelector('#flowBody');
  }
  function step(n) { el.querySelectorAll('.steps span').forEach(function (s, i) { s.classList.toggle('on', i < n); }); }
  function show() { ensure(); el.classList.add('show'); el.scrollTop = 0; }
  function hide() { el.classList.remove('show'); }

  /* ---------- step 1: customer ---------- */
  function showCustomer() {
    show(); step(1);
    var recent = projects();
    body.innerHTML =
      '<h2>Customer details</h2><p class="sub">Who is this room design for?</p>' +
      '<div class="err" id="cErr"></div>' +
      '<label class="f">Customer name *<input id="cName" autocomplete="off" autocapitalize="words" placeholder="e.g. Rakesh Mohanty"></label>' +
      '<label class="f">Mobile number *<input id="cMob" type="tel" inputmode="tel" autocomplete="off" placeholder="10-digit mobile"></label>' +
      '<label class="f">Email id<input id="cMail" type="email" inputmode="email" autocomplete="off" autocapitalize="none" placeholder="name@example.com"></label>' +
      '<div class="row"><button class="btn" id="cGo">Next: room size →</button></div>' +
      (recent.length ? '<div class="recent"><h2 style="font-size:13px;color:var(--mute);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Saved designs on this phone</h2>' +
        recent.map(function (p, i) {
          var c = p.state.customer || {}, n = (p.state.items || []).filter(function (x) { return x.src !== 'photo'; }).length;
          return '<button data-open="' + i + '"><span>' + esc(c.name) + '<small>' + esc(c.mobile) + ' · ' + n + ' item' + (n === 1 ? '' : 's') + '</small></span><small>' + new Date(p.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ›</small></button>';
        }).join('') + '</div>' : '');
    var err = body.querySelector('#cErr');
    function fail(m) { err.textContent = m; err.style.display = 'block'; }
    body.querySelector('#cGo').onclick = function () {
      var name = body.querySelector('#cName').value.trim().replace(/\s+/g, ' ');
      var mob = body.querySelector('#cMob').value.replace(/[^\d+]/g, '');
      var mail = body.querySelector('#cMail').value.trim();
      var digits = mob.replace(/^\+?91/, '').replace(/^0/, '');
      if (name.length < 2) return fail('Please enter the customer name.');
      if (!/^[6-9]\d{9}$/.test(digits)) return fail('Please enter a valid 10-digit mobile number.');
      if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return fail('Please check the email id.');
      var unit = P.state().unit || 'ft';
      var s = P.blankState(null, unit);
      s.customer = { id: 'c' + Date.now().toString(36), name: name, mobile: digits, email: mail, by: (window.AUTH && AUTH.user() && AUTH.user().name) || '' };
      photos = [];
      P.setProject(s);
      updateChip();
      showRoom(false);
    };
    body.querySelectorAll('[data-open]').forEach(function (b) {
      b.onclick = function () {
        var p = projects()[+b.dataset.open]; if (!p) return;
        photos = (p.state.photos || []).map(function (x) { return Object.assign({}, x); });
        P.setProject(p.state); updateChip(); hide(); P.setTab(P.wide() ? 'cat' : 'cat');
        P.toast('Opened ' + (p.state.customer && p.state.customer.name) + '’s design');
      };
    });
    setTimeout(function () { var i = body.querySelector('#cName'); if (i && P.wide()) i.focus(); }, 50);
  }

  /* ---------- step 2: room size + photos ---------- */
  var unit = 'ft';
  function showRoom(editing) {
    show(); step(2);
    var s = P.state(), R = s.room; unit = s.unit || 'ft';
    var toU = function (m) { return unit === 'ft' ? +(m / FT).toFixed(1) : +m.toFixed(2); };
    var c = s.customer || {};
    body.innerHTML =
      '<h2>Room size' + (c.name ? ' for ' + esc(c.name) : '') + '</h2>' +
      '<p class="sub">Measure the room wall to wall. The room is drawn to these sizes with the measurements marked on it.</p>' +
      '<div class="err" id="rErr"></div>' +
      '<div class="unitsw"><button data-u="ft" class="' + (unit === 'ft' ? 'on' : '') + '">Feet</button><button data-u="m" class="' + (unit === 'm' ? 'on' : '') + '">Metres</button></div>' +
      '<div class="grid3"><label class="f">Width (<span class="uu">' + unit + '</span>) *<input id="rW" type="number" inputmode="decimal" step="0.1" value="' + (editing ? toU(R.w) : '') + '" placeholder="e.g. 14"></label>' +
      '<label class="f">Length (<span class="uu">' + unit + '</span>) *<input id="rL" type="number" inputmode="decimal" step="0.1" value="' + (editing ? toU(R.l) : '') + '" placeholder="e.g. 12"></label>' +
      '<label class="f">Height (<span class="uu">' + unit + '</span>) *<input id="rH" type="number" inputmode="decimal" step="0.1" value="' + (editing ? toU(R.h) : (unit === 'ft' ? 10 : 3)) + '"></label></div>' +
      '<h2 style="font-size:14px;margin-top:6px">Photos of the room <span style="font-weight:400;color:var(--mute)">(optional)</span></h2>' +
      '<p class="sub" style="margin-bottom:6px">Add one or more photos of the customer’s room. Sofas, beds, tables, chairs, TVs and other furniture recognised in them are placed in the layout. Choose which wall each photo faces.</p>' +
      '<div id="flowPhotos"></div>' +
      '<div id="flowBusy"></div>' +
      '<div class="row"><button class="btn ghost" id="rBack">← Back</button><button class="btn" id="rGo">' + (editing ? 'Update room' : 'Create room layout →') + '</button></div>';
    renderPhotos(body.querySelector('#flowPhotos'), true);
    body.querySelectorAll('.unitsw button').forEach(function (b) {
      b.onclick = function () {
        var nu = b.dataset.u; if (nu === unit) return;
        ['rW', 'rL', 'rH'].forEach(function (id) {
          var i = body.querySelector('#' + id), v = parseFloat(i.value);
          if (isFinite(v)) i.value = nu === 'm' ? (v * FT).toFixed(2) : (v / FT).toFixed(1);
        });
        unit = nu; body.querySelectorAll('.unitsw button').forEach(function (x) { x.classList.toggle('on', x.dataset.u === unit); });
        body.querySelectorAll('.uu').forEach(function (x) { x.textContent = unit; });
      };
    });
    body.querySelector('#rBack').onclick = function () { if (editing) hide(); else showCustomer(); };
    body.querySelector('#rGo').onclick = function () {
      var err = body.querySelector('#rErr');
      var k = unit === 'ft' ? FT : 1, rd = function (id) { return parseFloat(body.querySelector('#' + id).value) * k; };
      var w = rd('rW'), l = rd('rL'), h = rd('rH');
      if (!(w >= 1.5 && w <= 20 && l >= 1.5 && l <= 20)) { err.textContent = 'Enter a width and length between ' + (unit === 'ft' ? '5 and 65 ft' : '1.5 and 20 m') + '.'; err.style.display = 'block'; return; }
      if (!(h >= 2.1 && h <= 6)) { err.textContent = 'Enter a height between ' + (unit === 'ft' ? '7 and 19 ft' : '2.1 and 6 m') + '.'; err.style.display = 'block'; return; }
      var st = P.state();
      st.unit = unit; st.room.w = w; st.room.l = l; st.room.h = h;
      P.setProject(st);
      var todo = photos.filter(function (p) { return !p.done; });
      var finish = function () {
        st.photos = photos.map(function (p) { return { id: p.id, thumb: p.thumb, wall: p.wall, found: p.found, done: p.done }; });
        P.save(); hide(); P.setTab('cat');
        var n = P.state().items.filter(function (x) { return x.src === 'photo'; }).length;
        P.toast(n ? n + ' item' + (n === 1 ? '' : 's') + ' from the photos placed — now add furniture' : 'Room ready — now add furniture from the catalogue');
      };
      if (!todo.length || !window.RPDetect) return finish();
      var busy = body.querySelector('#flowBusy'), btn = body.querySelector('#rGo');
      busy.style.display = 'block'; btn.disabled = true;
      RPDetect.run(todo, function (msg) { busy.textContent = msg; }).then(function () { renderPhotos(body.querySelector('#flowPhotos'), true); finish(); },
        function (e) { busy.textContent = 'Could not read the photos (' + (e && e.message || e) + '). The room was created without them.'; btn.disabled = false; setTimeout(finish, 2500); });
    };
  }

  /* ---------- photo list (used in step 2 and in the Room tab) ---------- */
  var WALLS = [['N', 'Back wall'], ['W', 'Left wall'], ['E', 'Right wall'], ['S', 'Front wall']];
  function renderPhotos(box, inFlow) {
    if (!box) return;
    var list = photos;
    box.innerHTML = '<div class="ph-grid">' + list.map(function (p, i) {
      return '<div class="ph"><img src="' + (p.thumb || p.img) + '" alt=""><div class="pb">' +
        '<select data-wall="' + i + '">' + WALLS.map(function (w) { return '<option value="' + w[0] + '"' + (p.wall === w[0] ? ' selected' : '') + '>Faces ' + w[1].toLowerCase() + '</option>'; }).join('') + '</select>' +
        (p.done ? '<span class="found">' + (p.found ? p.found + ' item' + (p.found === 1 ? '' : 's') + ' placed' : 'No furniture recognised') + '</span>' : '<span class="found">Will be read when the room is created</span>') +
        '<button class="x" data-rm="' + i + '">Remove photo</button></div></div>';
    }).join('') + '</div>' +
      '<label class="addph">＋ Add room photo(s)<input type="file" accept="image/*" multiple hidden></label>' +
      (!inFlow && list.some(function (p) { return !p.done; }) ? '<button class="btn" id="phRun" style="margin-top:8px;width:100%">Place furniture from new photos</button><div id="phBusy" class="note"></div>' : '');
    box.querySelector('input[type=file]').onchange = function (e) {
      var files = Array.prototype.slice.call(e.target.files || []); e.target.value = '';
      Promise.all(files.map(readPhoto)).then(function (ps) {
        ps.forEach(function (p, k) { if (p) { p.wall = WALLS[(photos.length) % 4][0]; photos.push(p); } });
        renderPhotos(box, inFlow);
      });
    };
    box.querySelectorAll('[data-wall]').forEach(function (s) {
      s.onchange = function () {
        var p = photos[+s.dataset.wall]; p.wall = s.value;
        if (p.done && window.RPDetect) { RPDetect.removeFor(p.id); p.done = false; p.found = 0; }
        renderPhotos(box, inFlow);
      };
    });
    box.querySelectorAll('[data-rm]').forEach(function (b) {
      b.onclick = function () {
        var p = photos[+b.dataset.rm]; if (window.RPDetect) RPDetect.removeFor(p.id);
        photos.splice(+b.dataset.rm, 1); syncPhotos(); renderPhotos(box, inFlow);
      };
    });
    var run = box.querySelector('#phRun');
    if (run) run.onclick = function () {
      var busy = box.querySelector('#phBusy'); run.disabled = true;
      RPDetect.run(photos.filter(function (p) { return !p.done; }), function (m) { busy.textContent = m; })
        .then(function () { syncPhotos(); renderPhotos(box, inFlow); P.toast('Furniture from the photos placed'); },
          function (e) { busy.textContent = 'Could not read the photos: ' + (e && e.message || e); run.disabled = false; });
    };
  }
  function syncPhotos() { var s = P.state(); s.photos = photos.map(function (p) { return { id: p.id, thumb: p.thumb, wall: p.wall, found: p.found, done: p.done }; }); P.save(); }

  // Read a picked file, scaled down (detection works on ≤1280 px; a small thumbnail is saved with the design).
  function readPhoto(file) {
    return new Promise(function (res) {
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var sc = function (max, q) {
            var k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
            c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
            c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', q);
          };
          res({ id: 'ph' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), img: sc(1280, .88), thumb: sc(360, .7), done: false, found: 0 });
        };
        im.onerror = function () { res(null); };
        im.src = fr.result;
      };
      fr.onerror = function () { res(null); };
      fr.readAsDataURL(file);
    });
  }

  /* ---------- header chip ---------- */
  function updateChip() {
    var chip = document.getElementById('custchip'), c = P.state().customer;
    if (!chip) return;
    chip.style.display = c ? '' : 'none';
    if (c) chip.querySelector('span').textContent = '👤 ' + c.name;
  }
  document.getElementById('newcust').addEventListener('click', function () { showCustomer(); });

  window.RPFlow = { showCustomer: showCustomer, showRoom: showRoom, renderPhotos: function (box) { renderPhotos(box, false); }, photos: function () { return photos; } };

  // Ask for the customer every time the app is opened (after sign-in).
  if (window.AUTH) AUTH.whenUnlocked(function () { showCustomer(); });
})();
