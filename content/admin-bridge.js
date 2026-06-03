/**
 * Proxel — admin isolated-world bridge (runs on admin.shopify.com, document_start).
 *
 * Receives captured share URLs from admin-capture-main.js (MAIN world) and stores them as
 * a preview context in chrome.storage.local, so the popup can offer shareable (key) links.
 */
(() => {
  "use strict";

  const PARAM_KEYS = ["preview_theme_id", "key", "_ab", "_fd", "_sc", "pb"];

  window.addEventListener("message", async (e) => {
    if (e.origin !== location.origin || e.source !== window) return;
    const d = e.data;
    if (!d || d.__proxel !== true || d.kind !== "share" || typeof d.url !== "string") return;

    let u;
    try {
      u = new URL(d.url, location.href);
    } catch (_) {
      return;
    }
    // Only accept storefront preview URLs (not relative admin links).
    if (!/\.myshopify\.com$/i.test(u.host)) return;
    const themeId = u.searchParams.get("preview_theme_id");
    if (!themeId) return;
    console.debug("[Proxel] captured preview context", u.host, themeId, Object.keys(Object.fromEntries(u.searchParams)));

    const params = {};
    for (const k of PARAM_KEYS) {
      if (u.searchParams.has(k)) params[k] = u.searchParams.get(k);
    }

    const ctx = {
      domain: u.host,
      themeId,
      params,
      source: "clipboard",
      capturedAt: Date.now()
    };
    try {
      await chrome.storage.local.set({ [`ctx:${u.host}:${themeId}`]: ctx, lastCtx: ctx });
    } catch (_) {}
  });
})();
