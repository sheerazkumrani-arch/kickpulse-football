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
  var api = { ans: ans, tbl: tbl, groups: groups };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;
  function init() {
    var box = document.getElementById("kpst"); if (!box) return;
    var a = document.getElementById("kpstAns"), t = document.getElementById("kpstTbl");
    var fail = function () { if (a.getAttribute("data-ph")) { a.removeAttribute("data-ph"); a.textContent = "Could not load the MLS standings right now. Please refresh the page in a minute."; } };
    var run = function () { fetch(URL_).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (!d || !groups(d).length) { fail(); return; } a.removeAttribute("data-ph"); a.textContent = ans(d); t.innerHTML = tbl(d); }).catch(fail); };
    run(); setInterval(run, 180000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(this);
