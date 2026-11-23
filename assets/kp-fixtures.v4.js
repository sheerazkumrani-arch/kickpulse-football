/* KickPulse: recent results + upcoming matches block for league pages.
   Same code runs in the browser (live refresh) and in scripts/prerender.js (text written into the HTML for Google). */
(function (root) {
  var B = "https://site.api.espn.com/apis/site/v2/sports/soccer/", DAY = 864e5, WIN = 14;
  var p2 = function (n) { return n < 10 ? "0" + n : "" + n; };
  var ymd = function (t) { var d = new Date(t); return d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var BAD = /POSTPONED|CANCEL|SUSPEND|ABANDON|FORFEIT/;

  function norm(e) {
    var c = (e.competitions && e.competitions[0]) || {}, t = c.competitors || [];
    var h = t.filter(function (x) { return x.homeAway === "home"; })[0] || t[0], a = t.filter(function (x) { return x.homeAway === "away"; })[0] || t[1];
    if (!h || !a || !h.team || !a.team) return null;
    var st = (e.status && e.status.type) || {};
    var side = function (x) { return { n: x.team.displayName || x.team.name || "", l: x.team.logo || "", s: x.score == null ? "" : String(x.score), w: !!x.winner }; };
    return { id: e.id || "", ms: new Date(e.date).getTime(), state: st.state || "", bad: BAD.test(st.name || ""), h: side(h), a: side(a) };
  }

  // get(url) -> Promise<{status, data}>.
  // ESPN is asked in small 3-day windows (the way the main app does it). If ESPN refuses a date range we switch to one request per day.
  // A single day that answers 400/404 means "no games that day" (ESPN does this outside a season); a refused RANGE never counts as "no games".
  function collect(slug, team, get, opt) {
    opt = opt || {};
    var nR = opt.nR || (team ? 5 : 10), nU = opt.nU || (team ? 5 : 10), W = 3;
    var back = opt.maxBack || (team ? 45 : slug === "usa.1" ? 30 : 24), fwd = opt.maxFwd || (team || slug === "usa.1" ? 45 : 30);
    var maxB = Math.ceil(back / W), maxF = Math.ceil(fwd / W);
    var T0 = Math.floor((opt.now || Date.now()) / DAY) * DAY, pool = {}, errs = 0, okc = 0, range;
    var tm = (team || "").toLowerCase();
    var mine = function (m) { return !tm || (m.h.n + " " + m.a.n).toLowerCase().indexOf(tm) > -1; };
    function counts() { var r = 0, u = 0; for (var k in pool) { var m = pool[k]; if (m.bad || !mine(m)) continue; if (m.state === "post") r++; else if (m.state === "pre") u++; } return [r, u]; }
    function add(d) { (d.events || []).forEach(function (e) { var m = norm(e); if (m) pool[m.id || m.ms + m.h.n] = m; }); }
    function day(t) {
      return get(B + slug + "/scoreboard?dates=" + ymd(t)).then(function (r) {
        if (r.data) { okc++; add(r.data); } else if (r.status === 400 || r.status === 404) okc++; else errs++;
      }, function () { errs++; });
    }
    function days(a, b) { var o = []; for (var t = a; t <= b; t += DAY) o.push(day(t)); return Promise.all(o); }
    function win(a, b) {
      if (range === false) return days(a, b);
      var u = B + slug + "/scoreboard?dates=" + ymd(a) + "-" + ymd(b);
      return get(u + "&limit=300").then(function (r) { return r.data ? r : get(u); }).then(function (r) {
        if (r.data) { range = true; okc++; add(r.data); return; }
        if (range !== true) range = false; // ESPN refuses ranges: one request per day from now on
        return days(a, b);
      }, function () { errs++; });
    }
    function loop(dir) {
      var k = 0, max = dir < 0 ? maxB : maxF, need = dir < 0 ? nR : nU, idx = dir < 0 ? 0 : 1;
      function next() {
        if (k >= max || (k > 0 && counts()[idx] >= need) || (k > 0 && errs && !okc)) return Promise.resolve();
        var n = k === 0 ? 1 : 4, ps = [];
        for (var i = 0; i < n && k < max; i++, k++) {
          var from = dir < 0 ? T0 - (k + 1) * W * DAY : T0 + k * W * DAY;
          ps.push(win(from, from + (W - 1) * DAY));
        }
        return Promise.all(ps).then(next);
      }
      return next();
    }
    return Promise.all([loop(-1), loop(1)]).then(function () {
      var all = Object.keys(pool).map(function (k) { return pool[k]; }).filter(function (m) { return !m.bad && mine(m); });
      var res = all.filter(function (m) { return m.state === "post"; }).sort(function (x, y) { return y.ms - x.ms; }).slice(0, nR);
      var up = all.filter(function (m) { return m.state === "pre"; }).sort(function (x, y) { return x.ms - y.ms; }).slice(0, nU);
      var live = all.filter(function (m) { return m.state === "in"; });
      all.sort(function (x, y) { return x.ms - y.ms; });
      if (!okc || (errs && !res.length && !up.length)) return null; // ESPN not reachable: keep what the page already shows
      if (opt.strict && !res.length && !up.length && !live.length) return null;     // build time: never write "no matches" unless sure
      return { res: res, up: up, live: live, all: all, t: Date.now() };
    });
  }

  function fmtUtc(ms, kind) {
    var d = new Date(ms), D = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return kind === "time" ? p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes()) + " UTC" : D[d.getUTCDay()] + " " + d.getUTCDate() + " " + M[d.getUTCMonth()];
  }
  function fmtLocal(ms, kind) {
    try { var d = new Date(ms); return kind === "time" ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }); }
    catch (e) { return fmtUtc(ms, kind); }
  }
  function team(s) { return '<span class="' + (s.w ? "w" : "") + '">' + (s.l ? '<img src="' + esc(s.l) + '" alt="" width="20" height="20" loading="lazy">' : "") + esc(s.n) + "</span>"; }
  function row(m, kind, fmt) {
    var right = kind === "res" ? '<div class="kpfx-s"><b>' + esc(m.h.s) + "</b><b>" + esc(m.a.s) + "</b></div>" : '<div class="kpfx-k">' + esc(fmt(m.ms, "time")) + "</div>";
    return '<div class="kpfx-r"><time datetime="' + new Date(m.ms).toISOString() + '">' + esc(fmt(m.ms, "date")) + '</time><div class="kpfx-t">' + team(m.h) + team(m.a) + "</div>" + right + "</div>";
  }
  function list(arr, kind, name, fmt) {
    if (!arr.length) return '<p class="kpfx-empty">' + (kind === "res" ? "No recent " + esc(name) + " results found yet." : "No upcoming " + esc(name) + " matches are announced yet. Check back soon.") + "</p>";
    return '<div class="kpfx-box">' + arr.map(function (m) { return row(m, kind, fmt); }).join("") + "</div>";
  }
  // Browser: ask our own site first (/api/scores, same address as the page, cached on Vercel's edge),
  // so Google's renderer and visitors do not depend on a cross-site ESPN call. Direct ESPN only as a fallback.
  function direct(u) { return fetch(u).then(function (r) { return r.ok ? r.json().then(function (d) { return { status: 200, data: d }; }) : { status: r.status, data: null }; }).catch(function () { return { status: 0, data: null }; }); }
  function web(u) {
    var m = /\/soccer\/([a-z0-9._-]+)\/scoreboard(?:\?dates=(\d{8}(?:-\d{8})?)(?:&limit=(\d+))?)?$/.exec(u);
    if (!m || !m[2] || typeof location === "undefined" || !/^https?:$/.test(location.protocol)) return direct(u);
    var a = "/api/scores?leagues=" + m[1] + "&dates=" + m[2] + (m[3] ? "&limit=" + m[3] : "");
    return fetch(a).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      var v = d && d[m[1]];
      return v && v.events ? { status: 200, data: v } : direct(u);
    }).catch(function () { return direct(u); });
  }
  var api = { collect: collect, norm: norm, web: web, list: list, row: row, fmtUtc: fmtUtc, fmtLocal: fmtLocal };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;
  root.KPFX = api;

  function init() {
    var box = document.getElementById("kpfx"); if (!box) return;
    var slug = box.getAttribute("data-slug"), tm = box.getAttribute("data-team") || "", name = box.getAttribute("data-name") || "league";
    var rEl = document.getElementById("kpfxRes"), uEl = document.getElementById("kpfxUp"), key = "kpfx4:" + slug + ":" + tm;
    function show(d) { rEl.innerHTML = list(d.res, "res", name, fmtLocal); uEl.innerHTML = list(d.up, "up", name, fmtLocal); }
    try { var c = JSON.parse(sessionStorage.getItem(key) || "null"); if (c && Date.now() - c.t < 3e5) { show(c); return; } } catch (e) {}
    var get = web;
    collect(slug, tm, get).then(function (d) {
      if (!d) {
        var msg = '<p class="kpfx-empty">Could not load matches right now. Please refresh the page in a minute.</p>';
        if (!rEl.querySelector(".kpfx-r")) rEl.innerHTML = msg;
        if (!uEl.querySelector(".kpfx-r")) uEl.innerHTML = msg;
        return;
      }
      show(d);
      if (d.res.length || d.up.length) { try { sessionStorage.setItem(key, JSON.stringify({ res: d.res, up: d.up, t: d.t })); } catch (e) {} }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(this);
