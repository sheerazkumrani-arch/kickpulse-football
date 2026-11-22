// Run:  node scripts/check-site.js     (no installs needed)
// Checks the whole site folder before you upload: every page has the new design files, every file a page asks for exists,
// every internal link points to a real page, the JSON-LD is valid, canonical addresses match the folder, sitemap lists every page.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const BASE = "https://kickpulse-football.vercel.app";
const bad = [], warn = [];
const pages = [];
(function walk(d) { for (const n of fs.readdirSync(d)) { if (["node_modules", ".git", "dist"].includes(n)) continue; const p = path.join(d, n); const s = fs.statSync(p); if (s.isDirectory()) walk(p); else if (n === "index.html") pages.push(p); } })(ROOT);
if (fs.existsSync(path.join(ROOT, "404.html"))) pages.push(path.join(ROOT, "404.html"));
const exists = (u) => fs.existsSync(path.join(ROOT, u.replace(/^\//, "").split("#")[0].split("?")[0]));
const dirOk = (u) => { const x = u.split("#")[0].split("?")[0].replace(/^\//, ""); return x === "" || fs.existsSync(path.join(ROOT, x, "index.html")) || fs.existsSync(path.join(ROOT, x)); };
const sm = fs.existsSync(path.join(ROOT, "sitemap.xml")) ? fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8") : "";
const NEWDESIGN = ["/assets/kp-theme.v1.css", "/assets/kp-side.v2.css", "/assets/pn.v"];
for (const f of pages) {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/"), h = fs.readFileSync(f, "utf8");
  const slug = rel === "index.html" ? "" : rel === "404.html" ? null : rel.replace(/index\.html$/, "");
  const where = (m) => rel + ": " + m;
  if (rel !== "404.html") for (const k of NEWDESIGN) if (h.indexOf(k) < 0) bad.push(where("missing new-design file " + k + " (page looks like the OLD design)"));
  for (const m of h.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[#?][^"]*)?"/g)) { const u = m[1]; if (u.startsWith("//")) continue; if (u.startsWith("/assets/") || /\.[a-z0-9]{2,5}$/i.test(u)) { if (!exists(u)) { if (/\.(js|css)$/.test(u) && /(app\.e2b39741\.v|pn\.v|league-table\.b5e8a2e2\.v)/.test(u)) warn.push(where("old version file not in repo (the build swaps it): " + u)); else bad.push(where("file not found: " + u)); } } else if (!dirOk(u)) bad.push(where("link to a page that does not exist: " + u)); }
  for (const m of h.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) { try { JSON.parse(m[1]); } catch (e) { bad.push(where("JSON-LD is not valid JSON")); } }
  if (slug !== null) {
    const c = (h.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    if (!c) bad.push(where("no canonical")); else if (c !== BASE + "/" + slug) bad.push(where("canonical " + c + " does not match the folder"));
    if (!/<title>[^<]{10,}<\/title>/.test(h)) bad.push(where("title missing or too short"));
    if (!/<meta name="description" content="[^"]{50,}"/.test(h)) bad.push(where("meta description missing or too short"));
    if ((h.match(/<h1[ >]/g) || []).length !== 1) bad.push(where("page must have exactly one h1"));
    if (!sm.includes("<loc>" + BASE + "/" + slug + "</loc>")) warn.push(where("not listed in sitemap.xml"));
  }
}
for (const m of sm.matchAll(/<loc>([^<]+)<\/loc>/g)) { const u = m[1].replace(BASE, ""); if (!dirOk(u)) bad.push("sitemap.xml lists a page that does not exist: " + m[1]); }
// Update 20: files the build needs must be in the right folder (a file in the wrong folder broke the deploy).
for (const f of ["scripts/prerender.js", "api/_espn.js", "assets/kp-fixtures.v3.js", "assets/kp-mls.v1.js", "assets/kp-standings.v2.js", "assets/kp-club.v1.css", "site-config.js"]) if (!fs.existsSync(path.join(ROOT, f))) bad.push("required file missing: " + f + (fs.existsSync(path.join(ROOT, path.basename(f))) ? " (a copy is in the main folder: upload it into " + path.dirname(f) + "/)" : ""));
for (const n of fs.readdirSync(ROOT)) if (/\.(js|css)$/.test(n) && n !== "site-config.js" && fs.statSync(path.join(ROOT, n)).isFile()) warn.push("file in the main folder that belongs in assets/ or scripts/: " + n);
if (fs.existsSync(path.join(ROOT, "github"))) warn.push("folder \"github\" (without dot) should be deleted; workflows belong in .github/workflows/");
if (!fs.existsSync(path.join(ROOT, ".github", "workflows", "refresh.yml"))) warn.push(".github/workflows/refresh.yml missing: the hourly refresh does not run");
if (process.argv.includes("--warn-only")) { bad.forEach((b) => warn.push("PROBLEM (not blocking): " + b)); bad.length = 0; }
console.log("pages checked:", pages.length);
warn.forEach((w) => console.log("  note:", w));
if (bad.length) { bad.forEach((b) => console.log("  PROBLEM:", b)); console.log(bad.length + " problem(s)"); process.exit(1); }
console.log("all good");
