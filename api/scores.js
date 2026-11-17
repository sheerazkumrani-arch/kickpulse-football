// One request from the browser -> many ESPN scoreboard calls made here, answered together and cached on Vercel's edge.
// Example: /api/scores?leagues=eng.1,esp.1&dates=20261110-20261112&limit=300
// Reliability: calls ESPN in small groups (so ESPN does not block a burst of 50 calls), retries a failed league once,
// and if ESPN still fails it serves the last good copy this server remembers (up to 10 minutes) instead of nothing.
const { SLUG, DATES, getJson, send } = require("./_espn");
const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/";
const MEM = new Map(); // key -> { t, data }  (kept while this server instance stays warm)
const POOL = 10, STALE_MS = 10 * 60 * 1000, BUDGET_MS = 8500;

module.exports = async (req, res) => {
  const q = req.query || {};
  const leagues = String(q.leagues || "").split(",").filter(Boolean);
  const dates = String(q.dates || "");
  const limit = String(q.limit || "");
  if (!leagues.length || leagues.length > 60 || !leagues.every((s) => SLUG.test(s)) || !DATES.test(dates) || (limit && !/^\d{1,3}$/.test(limit))) {
    return send(res, 400, { error: "bad request" });
  }
  const t0 = Date.now(), out = {};
  let transient = 0, next = 0;
  async function one(slug) {
    const key = slug + "|" + dates + "|" + limit;
    const url = BASE + slug + "/scoreboard?dates=" + dates + (limit ? "&limit=" + limit : "");
    let r = await getJson(url, 5000);
    if (!r.data && r.status !== 404 && Date.now() - t0 < 5500) { await new Promise((ok) => setTimeout(ok, 350)); r = await getJson(url.replace("://site.api.", "://site.web.api."), 3000); } // second try uses ESPN's other host
    if (r.data) { MEM.set(key, { t: Date.now(), data: r.data }); if (MEM.size > 400) MEM.delete(MEM.keys().next().value); return r.data; }
    if (r.status === 404) return { events: [] }; // league really not offered by ESPN: treat as empty
    const old = MEM.get(key);
    if (old && Date.now() - old.t < STALE_MS) return old.data; // ESPN failed: show the last good copy
    transient++; return null; // browser may retry ESPN directly for this league
  }
  async function worker() { while (next < leagues.length && Date.now() - t0 < BUDGET_MS) { const s = leagues[next++]; out[s] = await one(s); } }
  await Promise.all(Array.from({ length: Math.min(POOL, leagues.length) }, worker));
  for (const s of leagues) if (!(s in out)) { out[s] = null; transient++; } // ran out of time budget
  send(res, 200, out, transient ? "public, s-maxage=5, stale-while-revalidate=30" : "public, s-maxage=20, stale-while-revalidate=60");
};
