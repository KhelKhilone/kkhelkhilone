/* KhelKhilone floating WhatsApp button.
   Always renders a fixed bottom-right chat button. The number comes from /api/content
   (whatsapp.number or contact.whatsapp); if that is empty or the request fails,
   the built-in fallback number below is used so the button never disappears. */
(function () {
  if (window.__kkWaLoaded) return;
  window.__kkWaLoaded = true;

  var FALLBACK_NUMBER = "919420101924";
  var MESSAGE = "Hi KhelKhilone! I have a question about a toy.";

  var CSS =
    "#kk-wa{position:fixed!important;right:16px!important;left:auto!important;top:auto!important;bottom:calc(16px + env(safe-area-inset-bottom,0px))!important;z-index:2147483000!important;" +
    "width:56px;height:56px;border-radius:50%;background:#25D366;display:flex!important;align-items:center;justify-content:center;visibility:visible!important;opacity:1!important;" +
    "box-shadow:0 6px 18px rgba(0,0,0,.28);text-decoration:none;transition:transform .2s,box-shadow .2s;transform:none}" +
    "#kk-wa:hover{transform:scale(1.08);box-shadow:0 8px 22px rgba(0,0,0,.34)}" +
    "#kk-wa svg{width:30px;height:30px;fill:#fff;display:block}" +
    "#kk-wa .kk-wa-tip{position:absolute;right:66px;top:50%;transform:translateY(-50%);background:#001031;color:#fff;" +
    "font:700 13px Quicksand,system-ui,sans-serif;padding:7px 12px;border-radius:20px;white-space:nowrap;opacity:0;" +
    "pointer-events:none;transition:opacity .2s}" +
    "#kk-wa:hover .kk-wa-tip{opacity:1}" +
    "@media(max-width:767px){#kk-wa{width:52px;height:52px;right:12px!important;bottom:calc(12px + env(safe-area-inset-bottom,0px))!important}#kk-wa .kk-wa-tip{display:none}}";

  var ICON =
    '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.2 1.6 6L4 29l8.2-1.5c1.2.6 2.5.9 3.8.9 6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-1.2 0-2.4-.3-3.5-.9l-.8-.5-4.9.9 1-4.7-.5-.8c-.9-1.5-1.4-3.2-1.4-5 0-5.5 4.5-10 10-10s10 4.5 10 10-4.4 9.9-9.9 10zm5.5-7.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.6-.1-.2-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.7s1.2 3.1 1.3 3.3c.2.2 2.3 3.5 5.5 4.9.8.3 1.4.5 1.9.7.8.2 1.5.2 2.1.1.6-.1 1.8-.7 2.1-1.5.3-.7.3-1.3.2-1.5-.1-.1-.3-.2-.6-.4z"/></svg>';

  function clean(number) {
    var d = String(number || "").replace(/[^\d]/g, "");
    return d.length >= 8 ? d : "";
  }
  function link(digits) {
    return "https://wa.me/" + digits + "?text=" + encodeURIComponent(MESSAGE);
  }

  function mount(digits) {
    var existing = document.getElementById("kk-wa");
    if (existing) { existing.href = link(digits); return; }
    if (!document.getElementById("kk-wa-style")) {
      var style = document.createElement("style");
      style.id = "kk-wa-style";
      style.textContent = CSS;
      (document.head || document.documentElement).appendChild(style);
    }
    var a = document.createElement("a");
    a.id = "kk-wa";
    a.href = link(digits);
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", "Chat with KhelKhilone on WhatsApp");
    a.innerHTML = ICON + '<span class="kk-wa-tip">Chat with us</span>';
    (document.body || document.documentElement).appendChild(a);
  }

  function start() {
    mount(FALLBACK_NUMBER);
    fetch("/api/content", { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (c) {
        var d = c && (clean(c["whatsapp.number"]) || clean(c["contact.whatsapp"]));
        if (d) mount(d);
      })
      .catch(function () {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
