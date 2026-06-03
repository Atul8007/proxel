/* Minimal dependency-free unit tests for buildShareLink. Run: node tests/urlbuilder.test.js */
const assert = require("assert");
const { buildShareLink } = require("../lib/urlbuilder");

let passed = 0;
function eq(actual, expected, msg) {
  assert.strictEqual(actual, expected, msg);
  passed++;
}
function ok(cond, msg) {
  assert.ok(cond, msg);
  passed++;
}

// Homepage (empty path)
eq(
  buildShareLink({ domain: "shop.myshopify.com", params: { preview_theme_id: "123" } }, ""),
  "https://shop.myshopify.com/?preview_theme_id=123",
  "empty path -> homepage"
);

// Deep path with leading slash
eq(
  buildShareLink({ domain: "shop.myshopify.com", params: { preview_theme_id: "123" } }, "/products/x"),
  "https://shop.myshopify.com/products/x?preview_theme_id=123",
  "deep path"
);

// Path without leading slash
eq(
  buildShareLink({ domain: "shop.myshopify.com", params: { preview_theme_id: "9" } }, "pages/about"),
  "https://shop.myshopify.com/pages/about?preview_theme_id=9",
  "no leading slash"
);

// Locale-prefixed path
eq(
  buildShareLink({ domain: "shop.myshopify.com", params: { preview_theme_id: "9" } }, "/en-gb/pages/about"),
  "https://shop.myshopify.com/en-gb/pages/about?preview_theme_id=9",
  "locale prefix preserved"
);

// Collapses repeated / trailing slashes
eq(
  buildShareLink({ domain: "shop.myshopify.com", params: { preview_theme_id: "9" } }, "//collections//sale//"),
  "https://shop.myshopify.com/collections/sale?preview_theme_id=9",
  "slash normalisation"
);

// Preserves the shareable key and other params (order-independent check)
const link = buildShareLink(
  { domain: "shop.myshopify.com", params: { preview_theme_id: "123", key: "abc", _ab: "0" } },
  "products/x"
);
ok(link.startsWith("https://shop.myshopify.com/products/x?"), "host + path correct");
ok(link.includes("preview_theme_id=123"), "preview_theme_id preserved");
ok(link.includes("key=abc"), "key preserved");
ok(link.includes("_ab=0"), "flag preserved");

// Skips empty/nullish param values
const link2 = buildShareLink(
  { domain: "shop.myshopify.com", params: { preview_theme_id: "1", key: "", pb: null } },
  "/"
);
ok(!link2.includes("key="), "empty key skipped");
ok(!link2.includes("pb="), "null param skipped");

console.log(`All ${passed} urlbuilder assertions passed`);
