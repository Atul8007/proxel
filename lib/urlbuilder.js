/**
 * Proxel — pure link builder.
 *
 * Builds a Shopify theme-preview deep link from a captured context and a path.
 * Works both as a classic content-script global (no `export`) and as a Node module
 * (for unit tests) via the optional CommonJS export at the bottom.
 *
 * @param {{domain: string, params: Object}} ctx  captured preview context
 * @param {string} pathname  the storefront path to deep-link to (leading slash optional)
 * @returns {string} absolute preview URL, e.g.
 *   https://shop.myshopify.com/products/x?preview_theme_id=123&key=abc
 */
function buildShareLink(ctx, pathname) {
  const domain = ctx && ctx.domain;
  const params = (ctx && ctx.params) || {};
  const u = new URL("https://" + domain);
  // Normalise the path: collapse repeated/empty segments, always exactly one leading slash.
  u.pathname = "/" + String(pathname || "").split("/").filter(Boolean).join("/");
  for (const key of Object.keys(params)) {
    const v = params[key];
    if (v !== null && v !== undefined && v !== "") u.searchParams.set(key, v);
  }
  return u.toString();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { buildShareLink };
}
