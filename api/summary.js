// /api/summary?league=eng.1&event=123456  -> match details (timeline, stats, lineups), cached for 15 seconds.
// If ESPN fails, tries ESPN's other host, then the last good copy this server remembers (30 minutes), before giving up.
const { SLUG, getJson, send } = require("./_espn");
const MEM = new Map();
module.exports = async (req, res) => {
  const q = req.query || {};
  const slug = String(q.league || "");
  const ev = String(q.event || "");
  if (!SLUG.test(slug) || !/^\d{1,12}$/.test(ev)) return send(res, 400, { error: "bad request" });
  const path = "/apis/site/v2/sports/soccer/" + slug + "/summary?event=" + ev;
  let r = await getJson("https://site.api.espn.com" + path, 6000);
  if (!r.data) r = await getJson("https://site.web.api.espn.com" + path, 5000);
  const key = slug + "|" + ev;
  if (r.data) { MEM.set(key, { t: Date.now(), data: r.data }); if (MEM.size > 200) MEM.delete(MEM.keys().next().value); return send(res, 200, r.data, "public, s-maxage=15, stale-while-revalidate=60"); }
  const old = MEM.get(key);
  if (old && Date.now() - old.t < 30 * 60 * 1000) return send(res, 200, old.data, "public, s-maxage=5");
  send(res, 502, { error: "upstream unavailable" }, "public, s-maxage=3");
};
