/* KickPulse: MLS standings (Eastern + Western Conference). Same code runs in the browser and in scripts/prerender.js. */
(function (root) {
  var URL_ = "https://site.api.espn.com/apis/v2/sports/soccer/usa.1/standings";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function stat(e, n) { var a = e.stats || []; for (var i = 0; i < a.length; i++) if (a[i].name === n || a[i].type === n) return a[i].displayValue != null && a[i].displayValue !== "" ? a[i].displayValue : a[i].value; return ""; }
  function num(e, n) { var v = parseFloat(stat(e, n)); return isNaN(v) ? 0 : v; }
  var nm = function (e) { return (e.team && (e.team.displayName || e.team.name)) || ""; };
  function groups(d) {
    return ((d && d.children) || []).map(function (c) {
      var rows = ((c.standings && c.standings.entries) || []).slice();
      rows.sort(function (a, b) { var ra = num(a, "rank"), rb = num(b, "rank"); return ra && rb ? ra - rb : num(b, "points") - num(a, "points") || num(b, "pointDifferential") - num(a, "pointDifferential"); });
      return { name: c.name || c.abbreviation || "", rows: rows };
    }).filter(function (g) { return g.rows.length; });
  }
  function ans(d) {
    var g = groups(d); if (!g.length) return "";
    var lead = function (x, w) { return nm(x) + " lead " + w + " on " + stat(x, "points") + " points after " + stat(x, "gamesPlayed") + " games"; };
    var all = [].concat.apply([], g.map(function (x) { return x.rows; })).sort(function (a, b) { return num(b, "points") - num(a, "points") || num(b, "pointDifferential") - num(a, "pointDifferential"); });
    if (g.length === 1) return "In the MLS table, " + lead(g[0].rows[0], "the league") + ".";
    var s = "In the MLS standings, " + g.map(function (x) { return lead(x.rows[0], "the " + x.name); }).join(", and ") + ".";
    return s + " " + nm(all[0]) + " have the most points in MLS overall (" + stat(all[0], "points") + ").";
  }
  function tbl(d) {
    var g = groups(d); if (!g.length) return "";
    return g.map(function (x) {
      var rows = x.rows.map(function (e, i) {
        return "<tr><td class=\"c\">" + esc(stat(e, "rank") || i + 1) + "</td><td class=\"tn\">" + esc(nm(e)) + "</td><td>" + esc(stat(e, "gamesPlayed")) + "</td><td>" + esc(stat(e, "wins")) + "</td><td>" + esc(stat(e, "ties")) + "</td><td>" + esc(stat(e, "losses")) + "</td><td class=\"gf\">" + esc(stat(e, "pointsFor")) + "</td><td class=\"gf\">" + esc(stat(e, "pointsAgainst")) + "</td><td class=\"gf\">" + esc(stat(e, "pointDifferential")) + "</td><td class=\"pts\">" + esc(stat(e, "points")) + "</td></tr>";
      }).join("");
      return (g.length > 1 ? "<h3 class=\"kpst-g\">" + esc(x.name) + "</h3>" : "") + "<div class=\"lt-wrap\"><table class=\"lt-t\"><thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th class=\"gf\">GF</th><th class=\"gf\">GA</th><th class=\"gf\">GD</th><th>Pts</th></tr></thead><tbody>" + rows + "</tbody></table></div>";
    }).join("");
  }
  // One club: where is it in its conference table?
  function find(d, team) {
    var t = (team || "").toLowerCase(), g = groups(d);
    for (var i = 0; i < g.length; i++) for (var j = 0; j < g[i].rows.length; j++) { var e = g[i].rows[j]; if (nm(e).toLowerCase().indexOf(t) > -1) return { conf: g[i].name, pos: num(e, "rank") || j + 1, size: g[i].rows.length, e: e }; }
    return null;
  }
  function ord(n) { var v = n % 100; return n + (["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th"); }
  function clubAns(d, team, name) {
    var f = find(d, team); if (!f) return "";
    return name + " are " + ord(f.pos) + " in the MLS " + f.conf + " with " + stat(f.e, "points") + " points from " + stat(f.e, "gamesPlayed") + " games (" + stat(f.e, "wins") + " wins, " + stat(f.e, "ties") + " draws, " + stat(f.e, "losses") + " losses, goal difference " + stat(f.e, "pointDifferential") + ").";
  }
  function clubCard(d, team) {
    var f = find(d, team); if (!f) return "";
    var c = function (b, l) { return "<div><b>" + esc(b) + "</b><span>" + esc(l) + "</span></div>"; };
    return "<div class=\"kpcl-g\">" + c(ord(f.pos), f.conf) + c(stat(f.e, "points"), "Points") + c(stat(f.e, "gamesPlayed"), "Played") + c(stat(f.e, "wins") + "-" + stat(f.e, "ties") + "-" + stat(f.e, "losses"), "W-D-L") + c(stat(f.e, "pointDifferential"), "Goal difference") + "</div>";
  }
  var api = { ans: ans, tbl: tbl, groups: groups, find: find, clubAns: clubAns, clubCard: clubCard };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;
  root.KPSTD = api;
  // Browser: our own /api/standings first (edge cached 60 s), direct ESPN only as a fallback.
  function load() {
    var dj = function () { return fetch(URL_).then(function (r) { return r.ok ? r.json() : null; }); };
    if (typeof location === "undefined" || !/^https?:$/.test(location.protocol)) return dj();
    return fetch("/api/standings?league=usa.1").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { return d && d.children ? d : dj(); }, dj);
  }
  function initClub(d0) {
    var box = document.getElementById("kpcl"); if (!box) return false;
    var a = document.getElementById("kpclAns"), c = document.getElementById("kpclCard"), team = box.getAttribute("data-team"), name = box.getAttribute("data-name");
    var run = function () { load().then(function (d) { if (!d || !find(d, team)) { if (a.getAttribute("data-ph")) { a.removeAttribute("data-ph"); a.textContent = "The table position could not be loaded right now. Open the MLS standings page for the full table."; } return; } a.removeAttribute("data-ph"); a.textContent = clubAns(d, team, name); c.innerHTML = clubCard(d, team); }).catch(function () {}); };
    run(); setInterval(run, 180000); return true;
  }
  function init() {
    if (initClub()) return;
    var box = document.getElementById("kpst"); if (!box) return;
    var a = document.getElementById("kpstAns"), t = document.getElementById("kpstTbl");
    var fail = function () { if (a.getAttribute("data-ph")) { a.removeAttribute("data-ph"); a.textContent = "Could not load the MLS standings right now. Please refresh the page in a minute."; } };
    var run = function () { load().then(function (d) { if (!d || !groups(d).length) { fail(); return; } a.removeAttribute("data-ph"); a.textContent = ans(d); t.innerHTML = tbl(d); }).catch(fail); };
    run(); setInterval(run, 180000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(this);
