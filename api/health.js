// Open /api/health in the browser: shows whether this Vercel server can reach ESPN.
const { getJson, send } = require("./_espn");
module.exports = async (req, res) => {
  const r = await getJson("https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard", 8000);
  send(res, 200, { espn_status: r.status, ok: !!r.data, events_found: r.data && r.data.events ? r.data.events.length : null, note: r.data ? "ESPN reachable from server" : "ESPN not reachable from server: the browser will load ESPN directly" });
};
