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

  // get(url) -> Promise<{status, data}>. status 400/404 = ESPN has nothing for these dates (not an error).
  function collect(slug, team, get, opt) {
    opt = opt || {};
    var nR = opt.nR || (team ? 5 : 10), nU = opt.nU || (team ? 5 : 10);
    var maxB = Math.ceil((opt.maxBack || 70) / WIN), maxF = 1 + Math.ceil(((opt.maxFwd || (slug === "usa.1" ? 126 : 56)) - WIN) / (2 * WIN));
    var T0 = Math.floor((opt.now || Date.now()) / DAY) * DAY, pool = {}, errs = 0, okc = 0;
    var tm = (team || "").toLowerCase();
    var mine = function (m) { return !tm || (m.h.n + " " + m.a.n).toLowerCase().indexOf(tm) > -1; };
    function counts() { var r = 0, u = 0; for (var k in pool) { var m = pool[k]; if (m.bad || !mine(m)) continue; if (m.state === "post") r++; else if (m.state === "pre") u++; } return [r, u]; }
    function chunk(a, b) {
      var u = B + slug + "/scoreboard?dates=" + ymd(a) + "-" + ymd(b);
      return get(u + "&limit=300").then(function (r) { return r.data ? r : get(u); }).then(function (r) {
        if (r.data) { okc++; (r.data.events || []).forEach(function (e) { var m = norm(e); if (m) pool[m.id || m.ms + m.h.n] = m; }); }
        else if (r.status === 400 || r.status === 404) okc++;
        else errs++;
      }, function () { errs++; });
    }
    function loop(dir) {
      var k = 0;
      function next() {
        var max = dir < 0 ? maxB : maxF;
        if (k >= max || (k > 0 && counts()[dir < 0 ? 0 : 1] >= (dir < 0 ? nR : nU))) return Promise.resolve();
        var len = dir < 0 || k === 0 ? WIN : 2 * WIN, from = dir < 0 ? T0 - (k + 1) * WIN * DAY : T0 + (k === 0 ? 0 : WIN + (k - 1) * 2 * WIN) * DAY, to = from + (len - 1) * DAY;
        k++;
        return chunk(from, to).then(next);
      }
      return next();
    }
    return Promise.all([loop(-1), loop(1)]).then(function () {
      var all = Object.keys(pool).map(function (k) { return pool[k]; }).filter(function (m) { return !m.bad && mine(m); });
      var res = all.filter(function (m) { return m.state === "post"; }).sort(function (x, y) { return y.ms - x.ms; }).slice(0, nR);
      var up = all.filter(function (m) { return m.state === "pre"; }).sort(function (x, y) { return x.ms - y.ms; }).slice(0, nU);
      if (!okc || (errs && !res.length && !up.length)) return null; // ESPN not reachable: keep what the page already shows
      return { res: res, up: up, t: Date.now() };
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
  var api = { collect: collect, list: list, fmtUtc: fmtUtc, fmtLocal: fmtLocal };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;

  function init() {
    var box = document.getElementById("kpfx"); if (!box) return;
    var slug = box.getAttribute("data-slug"), tm = box.getAttribute("data-team") || "", name = box.getAttribute("data-name") || "league";
    var rEl = document.getElementById("kpfxRes"), uEl = document.getElementById("kpfxUp"), key = "kpfx1:" + slug + ":" + tm;
    function show(d) { rEl.innerHTML = list(d.res, "res", name, fmtLocal); uEl.innerHTML = list(d.up, "up", name, fmtLocal); }
    try { var c = JSON.parse(sessionStorage.getItem(key) || "null"); if (c && Date.now() - c.t < 3e5) { show(c); return; } } catch (e) {}
    var get = function (u) { return fetch(u).then(function (r) { return r.ok ? r.json().then(function (d) { return { status: 200, data: d }; }) : { status: r.status, data: null }; }).catch(function () { return { status: 0, data: null }; }); };
    collect(slug, tm, get).then(function (d) {
      if (!d) return;
      show(d);
      try { sessionStorage.setItem(key, JSON.stringify(d)); } catch (e) {}
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(this);
