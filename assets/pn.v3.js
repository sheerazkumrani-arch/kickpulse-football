// Pitchside Notes slider for KickPulse. Reads ALL articles from the blog's articles.json and slides through them:
//  - the top bar changes to the next article every 5 s,
//  - the "Read the preview" box becomes a swipeable slider (arrows, dots, auto-slide every 6 s).
// If the blog cannot be reached, the built-in text stays exactly as it was.
// v3: Pitch Green colours, plus French and Urdu messages (bar, slider and a "Also available in" line).
// TODO: put the exact French and Urdu page addresses of the blog here (until then both open the blog home page).
(function () {
  var B = "https://kickpulse-final.vercel.app";
  var FR_URL = B + "/", UR_URL = B + "/";
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(d) { var x = new Date(d + "T00:00:00Z"); return isNaN(x) ? d : x.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); }
  function safe(u) { return /^https:\/\/kickpulse-final\.vercel\.app\//.test(u) ? u : B + "/"; }

  var css = document.createElement("style");
  css.textContent =
    ".pn2{position:relative;margin:4px 0 14px}" +
    ".pn2-track{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch}" +
    ".pn2-track::-webkit-scrollbar{display:none}" +
    ".pn2-s{flex:0 0 100%;scroll-snap-align:start;box-sizing:border-box;background:#fff;border:1px solid #d9e2da;border-radius:18px;padding:16px 18px;display:grid;gap:5px;align-content:start;min-height:128px}" +
    ".pn2-s .t{font-family:\"Barlow Condensed\",\"Arial Narrow\",Inter,sans-serif;font-weight:700;font-size:24px;line-height:1.1;letter-spacing:.02em;text-transform:uppercase;color:#062a20;text-decoration:none}.pn2-s .t:hover{color:#07694a}" +
    ".pn2-s span{font-size:14px;line-height:1.5;color:#566a61}.pn2-s small{font-size:12px;color:#8a9b92}" +
    ".pn2-s .rd{font-size:14px;font-weight:800;color:#07694a;text-decoration:none}" +
    ".pn2-nav{display:flex;align-items:center;gap:10px;margin-top:10px}" +
    ".pn2-nav button{width:34px;height:34px;border-radius:50%;border:1px solid #b7dcc8;background:#e3f2ea;color:#07694a;font-size:16px;font-weight:800;cursor:pointer}" +
    ".pn2-nav button:hover{background:#f4b400;color:#241a00}" +
    ".pn2-dots{display:flex;gap:6px;flex-wrap:wrap;flex:1;justify-content:center}" +
    ".pn2-dots i{width:8px;height:8px;border-radius:50%;background:#d9e2da;cursor:pointer}.pn2-dots i.on{background:#0b8f63;width:20px;border-radius:6px}" +
    ".pn2-cnt{font-size:12px;color:#566a61;min-width:44px;text-align:right}";
  document.head.appendChild(css);

  var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 7000);
  fetch(B + "/articles.json", { signal: ctl.signal, cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (d) {
    clearTimeout(to);
    var a = ((d && d.articles) || []).filter(function (x) { return x && x.title && x.url; }).slice(0, 30);
    if (!a.length) return;
    var L = withLang(a); bar(L); box(L);
  }).catch(function () {});

  // French + Urdu messages: shown in the bar after every third article, and as the last two slides.
  function withLang(a) {
    var fr = { h: '<b>Read in French:</b> Lisez les comptes rendus de matchs en fran\u00e7ais', url: FR_URL, cta: "Lire &rarr;", title: "Read match reports in French", description: "Comptes rendus de matchs, aper\u00e7us et analyses en fran\u00e7ais.", date: "", category: "Fran\u00e7ais", lang: 1 };
    var ur = { h: '<b>Read in Urdu:</b> <span dir="rtl" lang="ur">\u0645\u06cc\u0686 \u0631\u067e\u0648\u0631\u0679\u0633 \u0627\u0631\u062f\u0648 \u0645\u06cc\u06ba \u067e\u0691\u06be\u06cc\u06ba</span>', url: UR_URL, cta: "Urdu &rarr;", title: "Read match reports in Urdu", description: '<span dir="rtl" lang="ur">\u0645\u06cc\u0686 \u0631\u067e\u0648\u0631\u0679\u0633 \u0627\u0648\u0631 \u067e\u06cc\u0634 \u0646\u0638\u0627\u0631\u06d2 \u0627\u0628 \u0627\u0631\u062f\u0648 \u0645\u06cc\u06ba \u0628\u06be\u06cc \u062f\u0633\u062a\u06cc\u0627\u0628 \u06c1\u06cc\u06ba\u06d4</span>', date: "", category: "Urdu", html: 1, lang: 1 };
    var out = [];
    a.forEach(function (x, k) { out.push(x); if (k === 2) out.push(fr); if (k === 5) out.push(ur); });
    if (a.length < 3) out.push(fr); if (a.length < 6) out.push(ur);
    return out;
  }

  // ---- top bar: slides through every article
  function bar(a) {
    var tx = document.getElementById("pnBarTxt"), lk = document.getElementById("pnBarLink");
    if (!tx) return;
    var i = 0, held = false;
    function show(first) {
      var x = a[i];
      tx.innerHTML = x.h || ('<b>New on Pitchside Notes:</b> ' + esc(x.title));
      if (lk) { lk.href = safe(x.url); lk.innerHTML = x.cta || "Read &rarr;"; }
      if (!first && !still && tx.animate) tx.animate([{ transform: "translateY(70%)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 380, easing: "ease-out" });
    }
    show(true);
    if (a.length < 2 || still) return;
    var bx = tx.parentNode;
    bx.addEventListener("mouseenter", function () { held = true; }); bx.addEventListener("mouseleave", function () { held = false; });
    bx.addEventListener("focusin", function () { held = true; }); bx.addEventListener("focusout", function () { held = false; });
    setInterval(function () { if (held || document.hidden) return; i = (i + 1) % a.length; show(false); }, 5000);
  }

  // ---- box: swipeable slider of all articles
  function box(a) {
    var ul = document.getElementById("pnList");
    if (!ul || document.querySelector(".pn2")) return;
    var w = document.createElement("div"); w.className = "pn2"; w.setAttribute("role", "region"); w.setAttribute("aria-label", "Pitchside Notes articles");
    w.innerHTML = '<div class="pn2-track">' + a.map(function (x) {
      return '<div class="pn2-s"><a class="t" href="' + esc(safe(x.url)) + '">' + esc(x.title) + '</a><span>' + (x.html ? x.description : esc(x.description || "")) + '</span><small>' + esc(fmt(x.date)) + (x.category ? " · " + esc(x.category) : "") + '</small><a class="rd" href="' + esc(safe(x.url)) + '">' + (x.lang ? "Open &rarr;" : "Read article &rarr;") + '</a></div>';
    }).join("") + '</div><div class="pn2-nav"><button type="button" class="pv" aria-label="Previous article">&larr;</button><div class="pn2-dots">' +
      a.map(function (x, k) { return '<i data-k="' + k + '"' + (k ? "" : ' class="on"') + "></i>"; }).join("") +
      '</div><span class="pn2-cnt">1 / ' + a.length + '</span><button type="button" class="nx" aria-label="Next article">&rarr;</button></div>';
    ul.parentNode.insertBefore(w, ul); ul.style.display = "none";
    var tr = w.querySelector(".pn2-track"), dots = w.querySelectorAll(".pn2-dots i"), cnt = w.querySelector(".pn2-cnt"), idx = 0, held = false, tm;
    function go(k) { idx = (k + a.length) % a.length; tr.scrollTo({ left: idx * tr.clientWidth, behavior: still ? "auto" : "smooth" }); mark(); }
    function mark() { dots.forEach(function (d, k) { d.className = k === idx ? "on" : ""; }); cnt.textContent = (idx + 1) + " / " + a.length; }
    tr.addEventListener("scroll", function () { clearTimeout(tm); tm = setTimeout(function () { var k = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth)); if (k !== idx) { idx = k; mark(); } }, 80); }, { passive: true });
    w.querySelector(".pv").onclick = function () { go(idx - 1); };
    w.querySelector(".nx").onclick = function () { go(idx + 1); };
    dots.forEach(function (d) { d.onclick = function () { go(+d.getAttribute("data-k")); }; });
    ["mouseenter", "focusin", "touchstart"].forEach(function (ev) { w.addEventListener(ev, function () { held = true; }, { passive: true }); });
    ["mouseleave", "focusout"].forEach(function (ev) { w.addEventListener(ev, function () { held = false; }); });
    w.addEventListener("touchend", function () { setTimeout(function () { held = false; }, 8000); }, { passive: true });
    if (a.length > 1 && !still) setInterval(function () { if (!held && !document.hidden) go(idx + 1); }, 6000);
  }

  var pnp = document.querySelector("#pn p");
  if (pnp && !document.querySelector(".pn-lang")) {
    var ln = document.createElement("div"); ln.className = "pn-lang";
    ln.innerHTML = '<b>Also available in</b><a href="' + FR_URL + '" lang="fr">Fran\u00e7ais</a><a href="' + UR_URL + '" lang="ur">\u0627\u0631\u062f\u0648</a><span>match reports and previews in French and Urdu</span>';
    pnp.parentNode.insertBefore(ln, pnp.nextSibling);
  }
})();
