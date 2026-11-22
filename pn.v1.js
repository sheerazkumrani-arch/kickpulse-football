// Shows the latest Pitchside Notes articles (from the blog's articles.json). If the blog is unreachable the built-in list stays.
(function () {
  var B = "https://kickpulse-final.vercel.app";
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(d) { var x = new Date(d + "T00:00:00Z"); return isNaN(x) ? d : x.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); }
  var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 6000);
  fetch(B + "/articles.json", { signal: ctl.signal }).then(function (r) { return r.json(); }).then(function (d) {
    clearTimeout(t);
    var a = (d && d.articles) || []; if (!a.length) return;
    var ul = document.getElementById("pnList");
    if (ul) ul.innerHTML = a.slice(0, 3).map(function (x) {
      return '<li><a href="' + esc(x.url) + '">' + esc(x.title) + '</a><span>' + esc(x.description || "") + '</span><small>' + fmt(x.date) + '</small></li>';
    }).join("");
    var tx = document.getElementById("pnBarTxt");
    if (tx) { tx.innerHTML = '<b>New on Pitchside Notes:</b> ' + esc(a[0].title); var l = document.getElementById("pnBarLink"); if (l) l.href = a[0].url; }
  }).catch(function () {});
})();
