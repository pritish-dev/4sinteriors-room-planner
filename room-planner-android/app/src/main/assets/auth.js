/* ===================== LOGIN (shared with the 4S Orders app) =====================
 * Staff sign in with the SAME username + password they use in the 4S Orders app.
 * The check is done by the 4S Orders backend (Google Apps Script, APP_ORDERING_CREDS
 * sheet), so adding, removing or deactivating someone there applies here too.
 *
 *  • The backend returns a signed session token (valid 30 days). It is kept on the
 *    device so the planner opens straight away next time, even offline.
 *  • Whenever the phone is online the token is re-checked with the backend; if it
 *    was revoked (TOKEN_VERSION bumped in the backend) the user is signed out.
 *  • If the backend is ever redeployed to a new URL, the current one is looked up
 *    from the 4s-orders repository automatically.
 */
(function () {
  var DEFAULT_API = 'https://script.google.com/macros/s/AKfycby4BXBlxp8fzQrXYR1U8OGt9GVM6ysEkoMVRtskw8_zc0JRzGKcoVd_GZgdl-1NZ_zlMA/exec';
  var DEPLOYMENT_ID_URL = 'https://raw.githubusercontent.com/pritish-dev/4s-orders/master/.apps_script_deployment_id';
  var KEY = 'rp_auth', API_KEY = 'rp_api';

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { return null; }
  }
  function apiUrl() { return ls(API_KEY) || DEFAULT_API; }

  function decodeToken(tok) {
    try {
      var p = String(tok).split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
      p += '==='.slice(0, (4 - p.length % 4) % 4);
      return JSON.parse(decodeURIComponent(escape(atob(p))));
    } catch (e) { return null; }
  }

  function readSession() {
    try {
      var s = JSON.parse(ls(KEY) || 'null');
      if (!s) return null;
      var exp = s.token ? (decodeToken(s.token) || {}).exp : s.exp;
      if (!exp || Date.now() > exp) return null;
      return s;
    } catch (e) { return null; }
  }

  function withTimeout(ms) {
    var c = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (c) c.abort(); }, ms);
    return { signal: c ? c.signal : undefined, done: function () { clearTimeout(t); } };
  }

  // POST the same way the 4S Orders app does (text/plain avoids a CORS preflight).
  function post(url, body) {
    var to = withTimeout(45000);
    return fetch(url, {
      method: 'POST', body: JSON.stringify(body), redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' }, signal: to.signal
    }).then(function (r) {
      to.done();
      if (!r.ok) throw new Error('Server error ' + r.status);
      return r.json();
    }, function (e) { to.done(); throw e; });
  }

  // JSONP GET — used for the background session check (works from any origin).
  function jsonp(url, params, ms) {
    return new Promise(function (res, rej) {
      var cb = 'rpcb' + Date.now() + Math.random().toString(36).slice(2);
      var q = Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
      var s = document.createElement('script');
      var t = setTimeout(function () { clean(); rej(new Error('timeout')); }, ms || 30000);
      function clean() { clearTimeout(t); try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); }
      window[cb] = function (d) { clean(); res(d); };
      s.onerror = function () { clean(); rej(new Error('network')); };
      s.src = url + '?' + q + '&callback=' + cb;
      document.head.appendChild(s);
    });
  }

  // Look up the backend's current deployment (in case it moved) and remember it.
  function refreshApiUrl() {
    return fetch(DEPLOYMENT_ID_URL + '?t=' + Date.now()).then(function (r) { return r.text(); }).then(function (id) {
      id = String(id || '').trim();
      if (!/^AKfyc[0-9A-Za-z_-]{20,}$/.test(id)) throw new Error('bad id');
      var u = 'https://script.google.com/macros/s/' + id + '/exec';
      if (u === apiUrl()) throw new Error('unchanged');
      ls(API_KEY, u);
      return u;
    });
  }

  // Try a normal POST first; if the browser/WebView blocks it (CORS, redirects),
  // fall back to the JSONP GET login the backend also accepts.
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function loginAt(url, body) {
    var viaGet = function () { return jsonp(url, { action: 'login', username: body.username, password: body.password }, 45000); };
    // POST (like the 4S Orders app), then GET, then both again after a pause — the
    // backend can take 20-30 s to wake up and phone networks drop the odd request.
    return post(url, body)
      .catch(viaGet)
      .catch(function () { return wait(1500).then(function () { return post(url, body); }); })
      .catch(function () { return wait(2500).then(viaGet); });
  }
  function login(username, password) {
    var body = { action: 'login', username: username, password: password };
    return loginAt(apiUrl(), body).catch(function (e) {
      // Still unreachable: the backend may have a new URL — look it up and retry once.
      return refreshApiUrl().then(function (u) { return loginAt(u, body); }, function () { throw e; });
    });
  }

  /* ---------- UI ---------- */
  var gate, form, err, btn, onUnlock = [];
  var session = null;

  function setErr(m) { err.textContent = m || ''; err.style.display = m ? 'block' : 'none'; }

  function unlock(s) {
    session = s;
    document.documentElement.classList.remove('locked');
    var chip = document.getElementById('userchip');
    if (chip) { chip.querySelector('span').textContent = (s.user && (s.user.name || s.user.username)) || 'Signed in'; chip.style.display = ''; }
    onUnlock.splice(0).forEach(function (f) { try { f(s); } catch (e) {} });
  }

  function lock(message) {
    session = null;
    ls(KEY, null);
    document.documentElement.classList.add('locked');
    var chip = document.getElementById('userchip');
    if (chip) chip.style.display = 'none';
    if (form) { form.reset(); setErr(message || ''); }
  }

  function verifyInBackground(s) {
    if (navigator.onLine === false || !s.token) return;
    jsonp(apiUrl(), { action: 'getAppSerial', token: s.token }, 30000).then(function (d) {
      if (d && d.ok === false && d.code === 'AUTH_REQUIRED') lock('Your session has ended — please sign in again.');
    }, function () { /* offline / backend unreachable: keep working until the token expires */ });
  }

  function init() {
    gate = document.getElementById('gate');
    form = document.getElementById('gateForm');
    err = document.getElementById('gateErr');
    btn = document.getElementById('gateBtn');

    document.getElementById('gateEye').addEventListener('click', function () {
      var p = form.password; p.type = p.type === 'password' ? 'text' : 'password';
      this.textContent = p.type === 'password' ? 'Show' : 'Hide';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var u = form.username.value.trim(), p = form.password.value;
      if (!u || !p) { setErr('Enter your username and password.'); return; }
      setErr(''); btn.disabled = true; btn.textContent = 'Signing in…';
      login(u, p).then(function (res) {
        if (res && res.ok) {
          // exp is only used when the backend returns no session token.
          var s = { token: res.token || '', user: res.user || { name: u }, at: Date.now(), exp: Date.now() + 30 * 864e5 };
          ls(KEY, JSON.stringify(s));
          unlock(s);
        } else {
          setErr((res && res.error) || 'Sign in failed. Check your username and password.');
        }
      }, function (e) {
        setErr('Could not reach the 4S Orders server. Check the internet connection and try again.' +
          (e && e.message ? ' (' + e.message + ')' : ''));
      }).then(function () { btn.disabled = false; btn.textContent = 'Sign in'; });
    });

    var out = document.getElementById('signout');
    if (out) out.addEventListener('click', function () {
      if (confirm('Sign out of the Room Planner?')) lock('');
    });

    var s = readSession();
    if (s) { unlock(s); verifyInBackground(s); }
    else { lock(ls(KEY) ? 'Your session has expired — please sign in again.' : ''); }
  }

  window.AUTH = {
    user: function () { return session && session.user; },
    whenUnlocked: function (f) { if (session) f(session); else onUnlock.push(f); },
    signOut: function () { lock(''); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
