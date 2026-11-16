// Shared helpers for the KickPulse API routes (files starting with _ are not public routes).
const SLUG = /^[a-z0-9._-]{1,40}$/;
const DATES = /^\d{8}(-\d{8})?$/;

// Small memory cache inside the running server: many visitors in the same few seconds share ONE ESPN call,
// and if ESPN is slow or fails we can still answer with the last good copy (up to 2 minutes old).
const MEM = new Map();
async function getJson(url, ms, ttl) {
  const now = Date.now(), hit = MEM.get(url);
  if (ttl && hit && now - hit.t < ttl) return { status: 200, data: hit.d };
  if (ttl && hit && hit.p) return hit.p; // same request already running: wait for it instead of calling ESPN again
  const run = async () => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms || 8000);
    try {
      const r = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "accept-language": "en-US,en;q=0.9" } });
      if (!r.ok) return { status: r.status, data: null };
      const data = await r.json();
      if (ttl) MEM.set(url, { t: Date.now(), d: data });
      return { status: 200, data };
    } catch (e) {
      return { status: 0, data: null };
    } finally {
      clearTimeout(t);
    }
  };
  if (!ttl) return run();
  const p = run().then((res) => {
    const h2 = MEM.get(url);
    if (h2) delete h2.p;
    if (!res.data && h2 && Date.now() - h2.t < 120000) return { status: 200, data: h2.d }; // ESPN failed: serve last good copy
    return res;
  });
  const cur = MEM.get(url);
  MEM.set(url, cur ? Object.assign(cur, { p }) : { t: 0, d: null, p });
  if (MEM.size > 400) { for (const k of MEM.keys()) { if (Date.now() - (MEM.get(k).t || 0) > 120000) MEM.delete(k); } }
  return p;
}

function send(res, code, body, cache) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", cache || "no-store");
  res.end(JSON.stringify(body));
}

module.exports = { SLUG, DATES, getJson, send };
