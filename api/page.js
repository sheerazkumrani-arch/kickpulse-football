// Serves each page with fresh scores and the league table already in the HTML (so Google sees real content).
// If anything fails, the plain page is sent, so the site never breaks.
const fs = require("fs"), path = require("path");
const { getJson } = require("./_espn");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const stat = (e, n) => { const s = (e.stats || []).find((x) => x.name === n); return s ? (s.displayValue != null ? s.displayValue : s.value) : ""; };

function tableHtml(data) {
  const groups = (data && data.children) || [];
  return groups.map((g) => {
    const rows = ((g.standings && g.standings.entries) || []).map((e, i) =>
      "<tr><td class=\"c\">" + esc(stat(e, "rank") || i + 1) + "</td><td class=\"tn\">" + esc(e.team && (e.team.displayName || e.team.name)) + "</td><td>" + esc(stat(e, "gamesPlayed")) + "</td><td>" + esc(stat(e, "wins")) + "</td><td>" + esc(stat(e, "ties")) + "</td><td>" + esc(stat(e, "losses")) + "</td><td class=\"gf\">" + esc(stat(e, "pointDifferential")) + "</td><td class=\"pts\">" + esc(stat(e, "points")) + "</td></tr>").join("");
    if (!rows) return "";
    return (groups.length > 1 ? "<div class=\"lt-g\">" + esc(g.name) + "</div>" : "") + "<div class=\"lt-wrap\"><table class=\"lt-t\"><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th class=\"gf\">GD</th><th>Pts</th></tr></thead><tbody>" + rows + "</tbody></table></div>";
  }).join("");
}
function matchesHtml(data) {
  const ev = ((data && data.events) || []).slice(0, 30).map((e) => {
    const c = (e.competitions && e.competitions[0]) || {}, t = c.competitors || [];
    const h = t.find((x) => x.homeAway === "home") || t[0], a = t.find((x) => x.homeAway === "away") || t[1];
    if (!h || !a || !h.team || !a.team) return "";
    const st = (e.status && e.status.type) || {};
    const when = st.state === "pre" ? new Date(e.date).toISOString().slice(0, 16).replace("T", " ") + " UTC" : st.shortDetail || "";
    const sc = st.state === "pre" ? "vs" : esc(h.score) + " - " + esc(a.score);
    return "<div class=\"m\"><div class=\"st\">" + esc(when) + "</div><div class=\"tm\"><div class=\"t\"><span class=\"nm\">" + esc(h.team.displayName) + "</span></div><div class=\"t\"><span class=\"nm\">" + esc(a.team.displayName) + "</span></div></div><div class=\"sc\"><b>" + sc + "</b></div></div>";
  }).join("");
  return ev ? "<div class=\"group\"><div class=\"rows\">" + ev + "</div></div>" : "";
}
const swap = (html, tag, body) => body ? html.replace(new RegExp("<!--KP:" + tag + "-->[\\s\\S]*?<!--/KP:" + tag + "-->"), () => body) : html;

module.exports = async (req, res) => {
  const p = String((req.query || {}).p || "home");
  if (!/^[a-z0-9-]{1,60}$/.test(p)) { res.statusCode = 404; return res.end("Not found"); }
  let html;
  try { html = fs.readFileSync(path.join(process.cwd(), "_pages", p + ".html"), "utf8"); }
  catch (e) { res.statusCode = 404; return res.end("Not found"); }
  try {
    const m = html.match(/<body[^>]*data-league="([a-z0-9._-]+)"/);
    if (m) {
      const b = "https://site.api.espn.com/apis/";
      const [sb, st] = await Promise.all([getJson(b + "site/v2/sports/soccer/" + m[1] + "/scoreboard", 4000), getJson(b + "v2/sports/soccer/" + m[1] + "/standings", 4000)]);
      html = swap(swap(html, "MATCHES", matchesHtml(sb.data)), "TABLE", tableHtml(st.data));
    }
  } catch (e) { /* send the plain page */ }
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
  res.end(html);
};
