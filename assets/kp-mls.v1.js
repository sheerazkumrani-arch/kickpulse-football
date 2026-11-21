/* KickPulse: "MLS matches today" and "MLS results" blocks. Same code runs in the browser and in scripts/prerender.js. */
(function (root) {
  var ET = "America/New_York", PT = "America/Los_Angeles", PK = "Asia/Karachi", FMT = {};
  var D = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var fx = function () { return typeof module !== "undefined" && module.exports ? require("./kp-fixtures.v3.js") : root.KPFX; };
  function dtf(tz, o) { var k = tz + JSON.stringify(o); return FMT[k] || (FMT[k] = new Intl.DateTimeFormat("en-US", Object.assign({ timeZone: tz }, o))); }
  function key(ms, tz) { var p = {}; dtf(tz || ET, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ms).forEach(function (x) { p[x.type] = x.value; }); return p.year + "-" + p.month + "-" + p.day; }
  function time(ms, tz) { return dtf(tz, { hour: "numeric", minute: "2-digit", hour12: true }).format(ms); }
  function label(k) { var a = k.split("-"), d = new Date(Date.UTC(+a[0], +a[1] - 1, +a[2], 12)); return D[d.getUTCDay()] + " " + d.getUTCDate() + " " + M[d.getUTCMonth()]; }
  var names = function (m) { return m.h.n + " vs " + m.a.n; };
  var score = function (m) { return m.h.s + "-" + m.a.s; };
  function more(arr, n, f) { var l = arr.slice(0, n).map(f).join(", "); return l + (arr.length > n ? " and " + (arr.length - n) + " more" : ""); }

  // Which MLS games belong to "today" (US Eastern date)? If none, the next match day.
  function today(d, now) {
    var tk = key(now), all = d.all || [], g = all.filter(function (m) { return key(m.ms) === tk; });
    if (g.length) return { mode: "today", key: tk, games: g };
    var nx = (d.up || [])[0];
    if (nx) { var nk = key(nx.ms); return { mode: "next", key: nk, tkey: tk, games: all.filter(function (m) { return key(m.ms) === nk; }) }; }
    return { mode: "none", key: tk, games: [], last: (d.res || [])[0] };
  }
  function ans(v) {
    var g = v.games, n = g.length, f = function (m) { return names(m) + " (" + time(m.ms, ET) + " ET)"; };
    if (v.mode === "today") return "There " + (n === 1 ? "is 1 MLS match" : "are " + n + " MLS matches") + " today (" + label(v.key) + "): " + more(g, 3, f) + ". Kick-off times are shown below in US Eastern, US Pacific and Pakistan time.";
    if (v.mode === "next") return "There are no MLS matches today (" + label(v.tkey) + "). The next MLS match day is " + label(v.key) + ", with " + (n === 1 ? "1 game" : n + " games") + ": " + more(g, 3, f) + ".";
    return "No MLS matches are scheduled in the coming weeks." + (v.last ? " The latest result was " + names(v.last) + " (" + score(v.last) + ")." : "");
  }
  function tbl(v, own) {
    if (!v.games.length) return "";
    var extra = own && own !== ET && own !== PT && own !== PK;
    var head = "<tr><th>Match</th><th>US Eastern (ET)</th><th>US Pacific (PT)</th><th>Pakistan (PKT)</th>" + (extra ? "<th>Your time</th>" : "") + "<th>Score</th></tr>";
    var rows = v.games.map(function (m) {
      var st = m.state === "post" ? esc(score(m)) + " <small>FT</small>" : m.state === "in" ? "<b class=\"kptd-live\">LIVE</b> " + esc(score(m)) : "<span class=\"kptd-na\">Not started</span>";
      var nd = key(m.ms, PK) !== key(m.ms, ET) ? " <small>+1 day</small>" : "";
      return "<tr><td class=\"kptd-m\"><b>" + esc(m.h.n) + "</b> <i>vs</i> <b>" + esc(m.a.n) + "</b></td><td>" + time(m.ms, ET) + "</td><td>" + time(m.ms, PT) + "</td><td>" + time(m.ms, PK) + nd + "</td>" + (extra ? "<td>" + time(m.ms, own) + "</td>" : "") + "<td>" + st + "</td></tr>";
    }).join("");
    return "<div class=\"kptd-w\"><table class=\"kptd-t\"><thead>" + head + "</thead><tbody>" + rows + "</tbody></table></div>";
  }

  // Results grouped by US Eastern match day, newest first.
  function groups(d) {
    var res = d.res || [], o = [], idx = {};
    res.forEach(function (m) { var k = key(m.ms); if (!(k in idx)) { idx[k] = o.length; o.push({ k: k, g: [] }); } o[idx[k]].g.push(m); });
    return o;
  }
  function resAns(d) {
    var o = groups(d); if (!o.length) return "No recent MLS results were found. New results appear here as soon as matches finish.";
    var f = function (m) { return m.h.n + " " + score(m) + " " + m.a.n; };
    return "Latest MLS results (" + label(o[0].k) + "): " + more(o[0].g, 3, f) + ". Older match days are listed below, newest first.";
  }
  function resHtml(d) {
    var o = groups(d), F = fx(), fmt = function () { return "FT"; };
    if (!o.length) return "<p class=\"kpfx-empty\">No recent MLS results found yet.</p>";
    return o.map(function (x) { return "<h3 class=\"kpres-d\">" + label(x.k) + "</h3><div class=\"kpfx-box\">" + x.g.map(function (m) { return F.row(m, "res", fmt); }).join("") + "</div>"; }).join("");
  }
  var api = { today: today, ans: ans, tbl: tbl, resAns: resAns, resHtml: resHtml, key: key, label: label };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;

  function init() {
    var td = document.getElementById("kptd"), rs = document.getElementById("kpres"), F = root.KPFX;
    if ((!td && !rs) || !F) return;
    var get = function (u) { return fetch(u).then(function (r) { return r.ok ? r.json().then(function (d) { return { status: 200, data: d }; }) : { status: r.status, data: null }; }).catch(function () { return { status: 0, data: null }; }); };
    var own = ""; try { own = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
    var fail = function (el) { if (el && el.getAttribute("data-ph")) { el.removeAttribute("data-ph"); el.textContent = "Could not load MLS matches right now. Please refresh the page in a minute."; } };
    if (td) {
      var a = document.getElementById("kptdAns"), t = document.getElementById("kptdTbl"), slug = td.getAttribute("data-slug");
      var run = function () { F.collect(slug, "", get, { nR: 1, nU: 12, maxBack: 3 }).then(function (d) { if (!d) { fail(a); return; } var v = today(d, Date.now()); a.removeAttribute("data-ph"); a.textContent = ans(v); t.innerHTML = tbl(v, own); }); };
      run(); setInterval(run, 120000);
    }
    if (rs) {
      var ra = document.getElementById("kpresAns"), rl = document.getElementById("kpresList"), rslug = rs.getAttribute("data-slug");
      F.collect(rslug, "", get, { nR: 40, nU: 1, maxBack: 30, maxFwd: 3 }).then(function (d) { if (!d) { fail(ra); return; } ra.removeAttribute("data-ph"); ra.textContent = resAns(d); rl.innerHTML = resHtml(d); });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(this);
