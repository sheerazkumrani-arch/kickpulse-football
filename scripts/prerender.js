// Runs on Vercel before deploy. Copies the site into dist/ and puts today's matches and the league table
// into each league page's HTML (so Google sees real content). If ESPN fails, pages stay as they are.
const fs = require("fs"), path = require("path");
const { getJson } = require("../api/_espn");
const R = path.join(__dirname, ".."), OUT = path.join(R, "dist");
const SKIP = new Set([".git", ".vercel", "node_modules", "dist", "api", "scripts", "_pages"]);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const stat = (e, n) => { const s = (e.stats || []).find((x) => x.name === n); return s ? (s.displayValue != null ? s.displayValue : s.value) : ""; };
function tableHtml(data) {
  const g = (data && data.children) || [];
  return g.map((c) => {
    const rows = ((c.standings && c.standings.entries) || []).map((e, i) => "<tr><td class=\"c\">" + esc(stat(e, "rank") || i + 1) + "</td><td class=\"tn\">" + esc(e.team && (e.team.displayName || e.team.name)) + "</td><td>" + esc(stat(e, "gamesPlayed")) + "</td><td>" + esc(stat(e, "wins")) + "</td><td>" + esc(stat(e, "ties")) + "</td><td>" + esc(stat(e, "losses")) + "</td><td class=\"gf\">" + esc(stat(e, "pointDifferential")) + "</td><td class=\"pts\">" + esc(stat(e, "points")) + "</td></tr>").join("");
    return rows ? (g.length > 1 ? "<div class=\"lt-g\">" + esc(c.name) + "</div>" : "") + "<div class=\"lt-wrap\"><table class=\"lt-t\"><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th class=\"gf\">GD</th><th>Pts</th></tr></thead><tbody>" + rows + "</tbody></table></div>" : "";
  }).join("");
}
function matchesHtml(data) {
  const ev = ((data && data.events) || []).slice(0, 30).map((e) => {
    const c = (e.competitions && e.competitions[0]) || {}, t = c.competitors || [], h = t.find((x) => x.homeAway === "home") || t[0], a = t.find((x) => x.homeAway === "away") || t[1];
    if (!h || !a || !h.team || !a.team) return "";
    const st = (e.status && e.status.type) || {}, when = st.state === "pre" ? new Date(e.date).toISOString().slice(0, 16).replace("T", " ") + " UTC" : st.shortDetail || "";
    return "<div class=\"m\"><div class=\"st\">" + esc(when) + "</div><div class=\"tm\"><div class=\"t\"><span class=\"nm\">" + esc(h.team.displayName) + "</span></div><div class=\"t\"><span class=\"nm\">" + esc(a.team.displayName) + "</span></div></div><div class=\"sc\"><b>" + (st.state === "pre" ? "vs" : esc(h.score) + " - " + esc(a.score)) + "</b></div></div>";
  }).join("");
  return ev ? "<div class=\"group\"><div class=\"rows\">" + ev + "</div></div>" : "";
}
const swap = (html, tag, body) => body ? html.replace(new RegExp("<!--KP:" + tag + "-->[\\s\\S]*?<!--/KP:" + tag + "-->"), () => body) : html;
(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const n of fs.readdirSync(R)) { if (SKIP.has(n) || /\.zip$|^README-DEPLOY\.txt$|^CHANGES-KICKPULSE\.txt$/.test(n)) continue; fs.cpSync(path.join(R, n), path.join(OUT, n), { recursive: true }); }
  // Always serve the newest script: the highest-numbered assets/app.e2b39741.vN.min.js is used by every page in the deployed copy (now v7).
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.html$/.test(e.name) ? [path.join(d, e.name)] : []));
  const vs = fs.readdirSync(path.join(OUT, "assets")).map((n) => (n.match(/^app\.e2b39741\.v([0-9]+)\.min\.js$/) || [])[1]).filter(Boolean).map(Number), top = vs.length ? Math.max.apply(null, vs) : 0;
  const pv = fs.readdirSync(path.join(OUT, "assets")).map((n) => (n.match(/^pn\.v([0-9]+)\.js$/) || [])[1]).filter(Boolean).map(Number), ptop = pv.length ? Math.max.apply(null, pv) : 0;
  for (const f of walk(OUT)) { const h = fs.readFileSync(f, "utf8"); let n = h; if (top) n = n.replace(/app\.e2b39741\.v[0-9]+\.min\.js/g, "app.e2b39741.v" + top + ".min.js"); if (ptop) n = n.replace(/assets\/pn\.v[0-9]+\.js/g, "assets/pn.v" + ptop + ".js"); if (n !== h) fs.writeFileSync(f, n); }
  const pages = [path.join(OUT, "index.html")].concat(fs.readdirSync(OUT).map((d) => path.join(OUT, d, "index.html")));
  let ok = 0, blogHtml = "";
  try { // latest Pitchside Notes articles, written into the HTML so Google sees them
    const bl = await getJson("https://kickpulse-final.vercel.app/articles.json", 6000), arr = (bl.data && bl.data.articles) || [];
    blogHtml = arr.slice(0, 3).map((x) => "<li><a href=\"" + esc(x.url) + "\">" + esc(x.title) + "</a><span>" + esc(x.description) + "</span><small>" + esc(String(x.date).slice(5)) + "</small></li>").join("");
  } catch (e) { blogHtml = ""; }
  await Promise.all(pages.filter((f) => fs.existsSync(f)).map(async (f) => {
    try {
      let html = fs.readFileSync(f, "utf8");
      if (blogHtml && html.includes("<!--KP:BLOG-->")) { html = swap(html, "BLOG", blogHtml); fs.writeFileSync(f, html); ok++; }
      const m = html.match(/<body[^>]*data-league="([a-z0-9._-]+)"/);
      if (!m) return;
      const b = "https://site.api.espn.com/apis/";
      const [sb, st] = await Promise.all([getJson(b + "site/v2/sports/soccer/" + m[1] + "/scoreboard", 6000), getJson(b + "v2/sports/soccer/" + m[1] + "/standings", 6000)]);
      const n = swap(swap(html, "MATCHES", matchesHtml(sb.data)), "TABLE", tableHtml(st.data));
      if (n !== html) { fs.writeFileSync(f, n); ok++; }
    } catch (e) { /* keep the page as it is */ }
  }));
  console.log("prerender done, pages with live data:", ok);
})().catch((e) => console.log("prerender skipped:", e.message));
