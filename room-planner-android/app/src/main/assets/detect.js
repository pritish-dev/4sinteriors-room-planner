/* ===================== ROOM PHOTOS → FURNITURE =====================
 * Recognises furniture in the customer's room photos with an on-device model
 * (COCO-SSD, bundled in vendor/ — nothing is uploaded anywhere) and places a matching
 * piece in the 3D room:
 *   • what it is (sofa, bed, dining table, chair, TV…) → the matching 3D shape,
 *   • where it is in the photo → its position along the wall the photo faces, and
 *     how far into the room (lower in the photo = nearer the camera),
 *   • how wide it looks → its width (within sensible limits for that furniture),
 *   • its colour → sampled from the photo.
 * A single photo has no depth information, so positions and sizes are a starting
 * point: the pieces can be dragged, resized or removed like any other item.
 */
(function () {
  var P = window.__planner, modelP = null;

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.onload = res;
      s.onerror = function () { rej(new Error('could not load ' + src)); }; document.head.appendChild(s);
    });
  }
  function model(progress) {
    if (!modelP) {
      progress('Loading the furniture recogniser (first time only)…');
      modelP = (window.tf ? Promise.resolve() : loadScript('vendor/tf.min.js'))
        .then(function () { return window.cocoSsd ? 0 : loadScript('vendor/coco-ssd.min.js'); })
        .then(function () { return cocoSsd.load({ base: 'lite_mobilenet_v2', modelUrl: 'vendor/cocossd/model.json' }); })
        .catch(function (e) { modelP = null; throw e; });
    }
    return modelP;
  }

  // COCO class → planner furniture (typical size in m, used when the photo can't tell).
  var KIND = {
    'couch':        { t: 'sofa', s: 3, name: 'Sofa', w: 2.0, d: .9, h: .85, min: 1.0, max: 3.2 },
    'bed':          { t: 'bed', name: 'Bed', w: 1.8, d: 2.0, h: 1.0, min: .95, max: 2.0, deep: true },
    'dining table': { t: 'table', name: 'Table', w: 1.5, d: .9, h: .75, min: .6, max: 2.4 },
    'chair':        { t: 'dchair', name: 'Chair', w: .55, d: .55, h: .9, min: .45, max: .9 },
    'bench':        { t: 'bench', name: 'Bench', w: 1.2, d: .4, h: .45, min: .6, max: 2 },
    'tv':           { t: 'tv', name: 'TV unit', w: 1.5, d: .4, h: .5, min: .9, max: 2.4, wallOnly: true },
    'refrigerator': { t: 'cabinet', name: 'Refrigerator', w: .7, d: .7, h: 1.8, min: .55, max: 1.0, color: '#d9dcdf', wallOnly: true },
    'potted plant': { t: 'ottoman', name: 'Plant (planter)', w: .4, d: .4, h: .5, min: .3, max: .6, color: '#4b6b4f' },
    'toilet': null, 'sink': null, 'oven': null, 'microwave': null
  };

  function avgColour(img, b) {
    var c = document.createElement('canvas'), w = 24, h = 24; c.width = w; c.height = h;
    var g = c.getContext('2d');
    // centre half of the box: mostly the object itself
    g.drawImage(img, b[0] + b[2] * .25, b[1] + b[3] * .3, b[2] * .5, b[3] * .45, 0, 0, w, h);
    var d = g.getImageData(0, 0, w, h).data, r = 0, gg = 0, bb = 0, n = 0;
    for (var i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; n++; }
    var hx = function (v) { return ('0' + Math.round(v / n).toString(16)).slice(-2); };
    return '#' + hx(r) + hx(gg) + hx(bb);
  }

  function place(photo, img, dets) {
    var s = P.state(), R = s.room, wall = photo.wall || 'N', placed = 0;
    var len = (wall === 'N' || wall === 'S') ? R.w : R.l, room = (wall === 'N' || wall === 'S') ? R.l : R.w;
    dets.filter(function (d) { return d.score >= .45 && KIND[d.class]; })
      .sort(function (a, b) { return b.bbox[2] * b.bbox[3] - a.bbox[2] * a.bbox[3]; })
      .slice(0, 12)
      .forEach(function (d, k) {
        var K = KIND[d.class], b = d.bbox, W = img.width, H = img.height;
        var fx = (b[0] + b[2] / 2) / W, fy = (b[1] + b[3]) / H, fw = b[2] / W;
        var w = Math.max(K.min, Math.min(K.max, fw * len * 1.05));
        var dep = K.deep ? Math.max(1.9, K.d) : K.d * (w / K.w > 1.3 ? 1.1 : 1);
        if (K.t === 'bed') w = Math.max(.95, Math.min(2.0, w));
        var near = K.wallOnly ? 0 : Math.max(0, Math.min(1, (fy - .55) / .45));
        var u = (fx - .5) * len * .92, v = dep / 2 + .06 + near * Math.max(0, room - dep - .3) * .75;
        var x, z, rot;
        if (wall === 'N') { x = u; z = -R.l / 2 + v; rot = 0; }
        else if (wall === 'S') { x = -u; z = R.l / 2 - v; rot = Math.PI; }
        else if (wall === 'E') { z = u; x = R.w / 2 - v; rot = -Math.PI / 2; }
        else { z = -u; x = -R.w / 2 + v; rot = Math.PI / 2; }
        var m = { t: K.t };
        if (K.t === 'sofa') m.s = w < 1.1 ? 1 : w < 1.7 ? 2 : 3;
        if (K.t === 'table') { m.low = 0; m.round = 0; m.top = null; }
        if (K.t === 'cabinet') { m.mirror = 0; }
        var nm = K.name; if (K.t === 'sofa') nm = m.s + '-seater sofa';
        P.addCustom({ src: 'photo', photo: photo.id, name: 'Existing ' + nm.toLowerCase() + ' (from photo)', m: m, w: +w.toFixed(2), d: +dep.toFixed(2), h: K.h,
          color: K.color || avgColour(img, b), x: x, z: z, rot: rot });
        placed++;
      });
    return placed;
  }

  function loadImg(src) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; }); }

  function run(list, progress) {
    progress = progress || function () {};
    return model(progress).then(function (mdl) {
      var chain = Promise.resolve(), total = 0;
      list.forEach(function (p, i) {
        chain = chain.then(function () {
          progress('Reading photo ' + (i + 1) + ' of ' + list.length + '…');
          return loadImg(p.img || p.thumb).then(function (img) {
            return mdl.detect(img, 20, .4).then(function (dets) {
              removeFor(p.id);
              p.found = place(p, img, dets); p.done = true; total += p.found;
            });
          });
        });
      });
      return chain.then(function () { P.save(); P.renderItems(); progress(''); return total; });
    });
  }

  function removeFor(photoId) {
    P.state().items.filter(function (it) { return it.photo === photoId; }).forEach(function (it) { P.removeItem(it.id); });
  }

  window.RPDetect = { run: run, removeFor: removeFor };
})();
