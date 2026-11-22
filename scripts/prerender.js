// Runs on Vercel before deploy. Copies the site into dist/ and puts today's matches and the league table
// into each league page's HTML (so Google sees real content). If ESPN fails, pages stay as they are.
const fs = require("fs"), path = require("path");
const { getJson } = require("../api/_espn");
const FX = require("../assets/kp-fixtures.v3.js");
const MLS = require("../assets/kp-mls.v1.js");
const STD = require("../assets/kp-standings.v2.js");
const STAT = {}; // how ESPN answered during this build (printed at the end, visible in the Vercel build log)
const gj = (u, ms) => getJson(u, ms).then((r) => { STAT[r.status] = (STAT[r.status] || 0) + 1; return r; });
const R = path.join(__dirname, ".."), OUT = path.join(R, "dist");
const SKIP = new Set([".git", ".github", ".vercel", "node_modules", "dist", "api", "scripts", "_pages"]);
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
  const lv = fs.readdirSync(path.join(OUT, "assets")).map((n) => (n.match(/^league-table\.b5e8a2e2\.v([0-9]+)\.js$/) || [])[1]).filter(Boolean).map(Number), ltop = lv.length ? Math.max.apply(null, lv) : 0;
  const pv = fs.readdirSync(path.join(OUT, "assets")).map((n) => (n.match(/^pn\.v([0-9]+)\.js$/) || [])[1]).filter(Boolean).map(Number), ptop = pv.length ? Math.max.apply(null, pv) : 0;
  for (const f of walk(OUT)) { const h = fs.readFileSync(f, "utf8"); let n = h; if (top) n = n.replace(/app\.e2b39741\.v[0-9]+\.min\.js/g, "app.e2b39741.v" + top + ".min.js"); if (ltop) n = n.replace(/league-table\.b5e8a2e2\.v[0-9]+\.js/g, "league-table.b5e8a2e2.v" + ltop + ".js"); if (ptop) n = n.replace(/assets\/pn\.v[0-9]+\.js/g, "assets/pn.v" + ptop + ".js"); if (n !== h) fs.writeFileSync(f, n); }
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
      const fxm = html.match(/<section class="kpfx" id="kpfx" data-slug="([^"]+)" data-name="([^"]*)" data-team="([^"]*)"/);
      const fxP = fxm ? FX.collect(fxm[1], fxm[3], (u) => gj(u, 6000), { strict: true }).catch(() => null) : Promise.resolve(null);
      const tdm = html.match(/<section class="kptd" id="kptd" data-slug="([^"]+)"/), rsm = html.match(/<section class="kpres" id="kpres" data-slug="([^"]+)"/);
      const tdP = tdm ? FX.collect(tdm[1], "", (u) => gj(u, 6000), { strict: true, nR: 1, nU: 12, maxBack: 3 }).catch(() => null) : Promise.resolve(null);
      const rsP = rsm ? FX.collect(rsm[1], "", (u) => gj(u, 6000), { strict: true, nR: 40, nU: 1, maxBack: 30, maxFwd: 3 }).catch(() => null) : Promise.resolve(null);
      const stm = /<section class="kpst" id="kpst"/.test(html), clm = html.match(/<section class="kpcl" id="kpcl" data-slug="[^"]+" data-team="([^"]*)" data-name="([^"]*)"/);
      const stP = (stm || clm) ? getJson("https://site.api.espn.com/apis/v2/sports/soccer/usa.1/standings", 6000).then((r) => r.data).catch(() => null) : Promise.resolve(null);
      const [sb, st] = await Promise.all([getJson(b + "site/v2/sports/soccer/" + m[1] + "/scoreboard", 6000), getJson(b + "v2/sports/soccer/" + m[1] + "/standings", 6000)]);
      let n = swap(swap(html, "MATCHES", matchesHtml(sb.data)), "TABLE", tableHtml(st.data));
      // If the dated ESPN requests fail at build time, fall back to what the plain scoreboard already returned.
      const L = ((sb.data && sb.data.events) || []).map(FX.norm).filter((x) => x && !x.bad);
      const lite = (team) => { const t = (team || "").toLowerCase(), A = L.filter((x) => !t || (x.h.n + " " + x.a.n).toLowerCase().indexOf(t) > -1); return { res: A.filter((x) => x.state === "post").sort((x, y) => y.ms - x.ms), up: A.filter((x) => x.state === "pre").sort((x, y) => x.ms - y.ms), live: A.filter((x) => x.state === "in"), all: A.slice().sort((x, y) => x.ms - y.ms) }; };
      const fx = (await fxP) || (fxm ? lite(fxm[3]) : null);
      if (fx && fxm) n = swap(swap(n, "FXRES", fx.res.length ? FX.list(fx.res, "res", fxm[2], FX.fmtUtc) : ""), "FXUP", fx.up.length ? FX.list(fx.up, "up", fxm[2], FX.fmtUtc) : "");
      const td = (await tdP) || (tdm ? lite("") : null), rs = (await rsP) || (rsm ? lite("") : null);
      if (td && tdm && td.all.length) { const v = MLS.today(td, Date.now()); n = swap(swap(n, "TDANS", esc(MLS.ans(v))), "TDTBL", MLS.tbl(v, "")); n = n.replace('id="kptdAns" data-ph="1"', 'id="kptdAns"'); }
      if (rs && rsm && rs.res.length) { n = swap(swap(n, "RESANS", esc(MLS.resAns(rs))), "RESLIST", MLS.resHtml(rs)); n = n.replace('id="kpresAns" data-ph="1"', 'id="kpresAns"'); }
      const sd = await stP;
      if (sd && clm && STD.find(sd, clm[1])) { n = swap(swap(n, "CLANS", esc(STD.clubAns(sd, clm[1], clm[2]))), "CLCARD", STD.clubCard(sd, clm[1])); n = n.replace('id="kpclAns" data-ph="1"', 'id="kpclAns"'); }
      if (sd && stm && STD.groups(sd).length) { n = swap(swap(n, "STANS", esc(STD.ans(sd))), "STTBL", STD.tbl(sd)); n = n.replace('id="kpstAns" data-ph="1"', 'id="kpstAns"'); }
      if (n !== html) { fs.writeFileSync(f, n); ok++; }
    } catch (e) { /* keep the page as it is */ }
  }));
  try { // pages whose HTML changes every build get today's date in the sitemap
    const smp = path.join(OUT, "sitemap.xml"), today = new Date().toISOString().slice(0, 10);
    if (fs.existsSync(smp)) {
      let sm = fs.readFileSync(smp, "utf8");
      ["", "mls-live-scores/", "mls-matches-today/", "mls-results/", "mls-standings/", "mls-schedule/", "mls-playoffs/", "inter-miami-live-score/"].forEach((u) => {
        const loc = "https://kickpulse-football.vercel.app/" + u;
        sm = sm.replace(new RegExp("(<loc>" + loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "</loc>\\s*<lastmod>)[^<]*(</lastmod>)"), "$1" + today + "$2");
      });
      fs.writeFileSync(smp, sm);
    }
  } catch (e) { /* sitemap stays as it is */ }
  console.log("ESPN answers during this build (status: count):", JSON.stringify(STAT));
  console.log("prerender done, pages with live data:", ok);
})().catch((e) => console.log("prerender skipped:", e.message));
