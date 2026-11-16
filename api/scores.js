// One request from the browser -> many ESPN scoreboard calls made here, answered together and cached on Vercel's edge.
// Example: /api/scores?leagues=eng.1,esp.1&dates=20261110-20261112&limit=300
// If ESPN answers "400 bad request" for a league (it does this for some leagues/dates, e.g. outside a season),
// we quietly try simpler versions of the same question before giving up, and treat a final 400 as "no matches".
const { SLUG, DATES, getJson, send } = require("./_espn");
const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/";

const pad = (n) => (n < 10 ? "0" : "") + n;
function days(range) {
  const [a, b] = range.split("-");
  if (!b) return [a];
  const d = (s) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
  const out = [];
  for (let t = d(a), end = d(b), n = 0; t <= end && n < 8; t = new Date(t.getTime() + 864e5), n++) out.push(t.getUTCFullYear() + pad(t.getUTCMonth() + 1) + pad(t.getUTCDate()));
  return out;
}

const MEMO = new Map(); // finished league answers kept for 10 seconds (also remembers "ESPN says 400")
async function league(slug, dates, limit) {
  const key = slug + "|" + dates + "|" + limit, hit = MEMO.get(key);
  if (hit && Date.now() - hit.t < 10000) return hit.v;
  const one = (d, lim) => getJson(BASE + slug + "/scoreboard" + (d ? "?dates=" + d + (lim ? "&limit=" + lim : "") : ""), 5000, 10000);
  let v;
  const r1 = await one(dates, limit);
  if (r1.data) v = r1.data;
  else if (r1.status === 404) v = { events: [] };
  else if (r1.status === 400) {
    // simpler versions of the same question
    let r = limit ? await one(dates, "") : { data: null, status: 400 };
    if (r.data) v = r.data;
    else {
      const parts = await Promise.all(days(dates).map((d) => one(d, "")));
      const ok = parts.filter((x) => x.data);
      if (ok.length) v = { events: [].concat.apply([], ok.map((x) => x.data.events || [])) };
      else if (parts.every((x) => x.status === 400 || x.status === 404)) {
        r = await one("", ""); // ESPN's own default day
        v = r.data ? r.data : r.status === 400 || r.status === 404 ? { events: [] } : null;
      } else v = null;
    }
  } else v = null; // timeout or ESPN error: browser may retry directly
  MEMO.set(key, { t: Date.now(), v });
  if (MEMO.size > 300) { for (const k of MEMO.keys()) if (Date.now() - MEMO.get(k).t > 10000) MEMO.delete(k); }
  return v;
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const leagues = String(q.leagues || "").split(",").filter(Boolean);
  const dates = String(q.dates || "");
  const limit = String(q.limit || "");
  if (!leagues.length || leagues.length > 60 || !leagues.every((s) => SLUG.test(s)) || !DATES.test(dates) || (limit && !/^\d{1,3}$/.test(limit))) {
    return send(res, 400, { error: "bad request" });
  }
  const out = {};
  let transient = 0;
  await Promise.all(
    leagues.map(async (slug) => {
      const v = await league(slug, dates, limit);
      out[slug] = v;
      if (!v) transient++;
    })
  );
  send(res, 200, out, transient ? "public, s-maxage=5" : "public, s-maxage=20, stale-while-revalidate=120");
};
