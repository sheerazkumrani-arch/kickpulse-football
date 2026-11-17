// Pitchside Notes slider for KickPulse. Reads ALL articles from the blog's articles.json and slides through them:
//  - the top bar changes to the next article every 5 s,
//  - the "Read the preview" box becomes a swipeable slider (arrows, dots, auto-slide every 6 s).
// If the blog cannot be reached, the built-in text stays exactly as it was.
(function () {
  var B = "https://kickpulse-final.vercel.app";
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(d) { var x = new Date(d + "T00:00:00Z"); return isNaN(x) ? d : x.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); }
  function safe(u) { return /^https:\/\/kickpulse-final\.vercel\.app\//.test(u) ? u : B + "/"; }

  var css = document.createElement("style");
  css.textContent =
    ".pn2{position:relative;margin:4px 0 14px}" +
    ".pn2-track{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch}" +
    ".pn2-track::-webkit-scrollbar{display:none}" +
    ".pn2-s{flex:0 0 100%;scroll-snap-align:start;box-sizing:border-box;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;display:grid;gap:5px;align-content:start;min-height:128px}" +
    ".pn2-s .t{font-weight:800;font-size:17px;line-height:1.3;color:#0f172a;text-decoration:none}.pn2-s .t:hover{color:#b45309}" +
    ".pn2-s span{font-size:13.5px;line-height:1.5;color:#64748b}.pn2-s small{font-size:12px;color:#94a3b8}" +
    ".pn2-s .rd{font-size:13px;font-weight:800;color:#b45309;text-decoration:none}" +
    ".pn2-nav{display:flex;align-items:center;gap:10px;margin-top:10px}" +
    ".pn2-nav button{width:34px;height:34px;border-radius:50%;border:1px solid #fcd34d;background:#fffbeb;color:#78350f;font-size:16px;font-weight:800;cursor:pointer}" +
    ".pn2-nav button:hover{background:#f59e0b;color:#1c1917}" +
    ".pn2-dots{display:flex;gap:6px;flex-wrap:wrap;flex:1;justify-content:center}" +
    ".pn2-dots i{width:8px;height:8px;border-radius:50%;background:#e2e8f0;cursor:pointer}.pn2-dots i.on{background:#f59e0b;width:20px;border-radius:6px}" +
    ".pn2-cnt{font-size:12px;color:#64748b;min-width:44px;text-align:right}";
  document.head.appendChild(css);

  var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 7000);
  fetch(B + "/articles.json", { signal: ctl.signal, cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (d) {
    clearTimeout(to);
    var a = ((d && d.articles) || []).filter(function (x) { return x && x.title && x.url; }).slice(0, 30);
    if (!a.length) return;
    bar(a); box(a);
  }).catch(function () {});

  // ---- top bar: slides through every article
  function bar(a) {
    var tx = document.getElementById("pnBarTxt"), lk = document.getElementById("pnBarLink");
    if (!tx) return;
    var i = 0, held = false;
    function show(first) {
      var x = a[i];
      tx.innerHTML = '<b>New on Pitchside Notes:</b> ' + esc(x.title);
      if (lk) lk.href = safe(x.url);
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
      return '<div class="pn2-s"><a class="t" href="' + esc(safe(x.url)) + '">' + esc(x.title) + '</a><span>' + esc(x.description || "") + '</span><small>' + esc(fmt(x.date)) + (x.category ? " · " + esc(x.category) : "") + '</small><a class="rd" href="' + esc(safe(x.url)) + '">Read article &rarr;</a></div>';
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
})();
