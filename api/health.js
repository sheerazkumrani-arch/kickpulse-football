// Open /api/health in the browser: shows whether this Vercel server can reach ESPN, and how fast, for 12 leagues at once.
const { getJson, send } = require("./_espn");
const B = "https://site.api.espn.com/apis/site/v2/sports/soccer/";
module.exports = async (req, res) => {
  const t0 = Date.now(), slugs = ["usa.1", "eng.1", "esp.1", "ita.1", "ger.1", "fra.1", "uefa.champions", "uefa.europa", "sau.1", "ned.1", "por.1", "all"];
  const rs = await Promise.all(slugs.map(async (s) => { const t = Date.now(), r = await getJson(B + s + "/scoreboard", 8000); return { s, status: r.status, ms: Date.now() - t, events: r.data && r.data.events ? r.data.events.length : null }; }));
  const bad = rs.filter((x) => x.events === null && x.status !== 404);
  send(res, 200, {
    ok: bad.length === 0, failed: bad.map((x) => x.s + ":" + x.status), total_ms: Date.now() - t0,
    note: bad.length ? "ESPN failed or was slow for some leagues from the server. The site keeps the last good copy and retries." : "ESPN reachable from server for all tested leagues",
    leagues: rs,
  });
};
