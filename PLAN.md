# Shopify Theme Deep Preview — Build Plan

A Chrome (MV3) browser extension that captures a Shopify theme **preview context** the
moment you open a preview, then lets you copy a **direct, shareable link to whatever page
you're currently on** inside that preview — so recipients land on the exact page in the
exact theme with no manual navigation.

---

## 1. Problem & goal

**Problem.** A store has many duplicated themes. To share a specific page from a theme
preview, you must open the preview and manually navigate to the page every time.

**Goal.** One click → a shareable URL to the current page within the current theme preview.

**Non-goals.** Firefox support, Admin API / custom app, reverse-proxying storefront pages,
theme editing.

---

## 2. Core approach (decided)

Do **not** scrape theme IDs from the admin DOM. Instead **capture the preview context from
the preview tab itself**: when a preview opens, the storefront URL on
`*.myshopify.com` already carries the working params (`preview_theme_id`, and `key` for
shared previews). A content script reads them — this is the real, valid URL Shopify
produced, so it is robust against admin markup changes.

A floating **"Copy preview URL"** button on the preview page combines the captured params
with the **current path** to produce the shareable link. That link *is* the direct link —
no server or middleware in the default design.

```
https://{shop}.myshopify.com/{current-path}?preview_theme_id={id}&key={token}&...
```

---

## 3. Two preview actions — who can open the link

| Admin action          | Captured URL contains            | Who can open the shared link |
|-----------------------|----------------------------------|------------------------------|
| **Preview** (eye)     | `preview_theme_id` only          | Logged-in staff only         |
| **Share preview**     | `preview_theme_id` **+ `key=`**  | Anyone (key is the token)    |

For external sharing the user must start from **Share preview** so the `key` is captured.
The extension prefers a context that contains a `key`.

---

## 4. Architecture (Chrome MV3, no service worker)

```
shopify-theme-deep-preview/
├── manifest.json
├── content/
│   ├── storefront.js          # *.myshopify.com: capture ctx, track path, inject Copy button
│   ├── admin-capture-main.js  # admin.shopify.com MAIN world: intercept "Share preview" copy
│   └── admin-bridge.js        # admin.shopify.com ISOLATED: relay captured link → storage
├── popup/
│   ├── popup.html
│   ├── popup.js               # list captured previews, manual copy, clear keys, status
│   └── popup.css
├── lib/
│   └── urlbuilder.js          # pure buildShareLink() — unit tested
├── tests/
│   └── urlbuilder.test.js
├── assets/
│   └── floating-button.css
├── icons/  (16 / 48 / 128)
└── README.md
```

**Why no service worker:** all flow is content-script ↔ `chrome.storage.local` ↔ popup.
Nothing to keep alive or rehydrate.

### Data model (chrome.storage.local)

Keyed per domain + theme so multiple duplicated themes can each be remembered:

```js
"ctx:{domain}:{themeId}": {
  domain: "shop.myshopify.com",
  themeId: "123456789",
  params: { preview_theme_id: "123456789", key: "abc", _ab: "0", _fd: "0", _sc: "1" },
  source: "url" | "clipboard",
  capturedAt: 1733250000000
}
```

Storage is **local only** (never `sync`) because `key=` is effectively a credential.

---

## 5. Permissions (minimal)

```json
{
  "permissions": ["storage"],
  "host_permissions": [
    "https://admin.shopify.com/*",
    "https://*.myshopify.com/*"
  ]
}
```

- `*.myshopify.com` — required: we inject the capture script + Copy button there.
- `admin.shopify.com` — required: intercept the "Share preview" clipboard copy (no tab opens).
- No `clipboardRead` (we intercept writes in MAIN world, never read the clipboard).
- No `<all_urls>`, no service worker.

---

## 6. Key mechanisms

### 6.1 Pure link builder (`lib/urlbuilder.js`)

```js
export function buildShareLink({ domain, params }, pathname) {
  const u = new URL(`https://${domain}`);
  u.pathname = "/" + (pathname || "").split("/").filter(Boolean).join("/");
  for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, v);
  return u.toString();
}
```

Unit cases: empty path → homepage; `/products/x`; locale prefix; preserves `key=` and all
preview params; idempotent on already-correct paths.

### 6.2 Storefront capture + path tracking (`content/storefront.js`)

- On load, if URL has `preview_theme_id`, persist the context (params + themeId), because
  Shopify may keep params in the URL **or** move them to a session cookie as you navigate.
- Track the current path (full-page nav for storefront; add `history` hooks if needed).
- Build-from: prefer **live URL params** if present on the current page; else fall back to
  the **stored context** for this domain/tab.

### 6.3 Floating "Copy preview URL" button

- Injected only when a preview context exists (live URL params or stored).
- Click → `buildShareLink(ctx, location.pathname)` → write to clipboard (user gesture) →
  toast "Preview link copied".

### 6.4 Share-preview key capture (`content/admin-*.js`)

"Share preview → Copy link" copies to clipboard without opening a tab. A MAIN-world script
intercepts the copy (layered: `navigator.clipboard.writeText`, `document.execCommand('copy')`,
and the `copy` event) and, if the text contains `preview_theme_id`, posts it to the
ISOLATED bridge, which stores it as a context (with `key`).

---

## 7. The one pre-build validation (gates the redirect fallback)

**Test:** take a real **Share preview** link, change its path to `/products/<handle>`, open
in an **incognito** window.

- **Lands on the product in-theme** → key survives path injection → extension alone solves
  everything; **Phase 6 (redirect) not needed.**
- **Bounces to homepage/login** → key is root-bound → build the two-hop redirect fallback
  (Phase 6): hit root with `key` to set the preview session cookie, then forward to the
  deep path (now authorized by the cookie). No server required — a static launcher page.

Internal (staff-only) deep links work regardless of this result.

---

## 8. Phased delivery

| Phase | Scope | Needs live store? | Output |
|------|-------|-------------------|--------|
| **0** | Run the incognito key-path spike (§7) | yes (manual) | decision: Phase 6 needed or not |
| **1** | Scaffold + manifest + `urlbuilder.js` + unit tests | no | tested pure builder |
| **2** | `storefront.js`: capture context + path tracking | yes | context captured & logged on real preview |
| **3** | Floating **Copy URL** button + toast (core UX) | yes | end-to-end copy → open → correct page |
| **4** | Share-preview **key** capture from admin | yes | shareable (anyone) links captured |
| **5** | Popup: list captured previews, manual copy, clear keys, status/age | yes | management UI |
| **6** | *(conditional)* two-hop redirect launcher | only if §7 fails | external deep links for root-bound keys |
| **7** | Polish: per-tab context, stale/expiry warnings, errors, icons, sideload packaging, README | yes | shippable build |

Phases 1–3 alone already eliminate the manual-navigation step for you and staff.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| `key=` doesn't survive path injection | §7 spike → Phase 6 redirect fallback |
| `key=` expires / view-capped | store `capturedAt`; popup shows age; one-click re-capture |
| Preview params drop to a cookie mid-navigation | persist context on first load; build from stored ctx |
| Previewing multiple duplicated themes at once | per-tab context (use `sender.tab.id`); live URL params win |
| Admin markup drift | we no longer scrape admin for themes; clipboard intercept is markup-agnostic |
| Staff-only vs anyone confusion | popup/button label states which mode a link is |
| `key=` is a credential | local-only storage; "clear stored keys" button; no sync |
| Slug typo → 404 in-theme | acceptable; current-page capture avoids manual typing entirely |

---

## 10. Security & privacy

- `chrome.storage.local` only; never `chrome.storage.sync`.
- `key=` links are treated as credentials: visible age, manual clear, optional
  "don't persist keys" mode.
- No external network calls in the default design (no telemetry, no server).

---

## 11. Inputs needed before/at start

1. Result of the **§7 incognito spike** (decides Phase 6).
2. Confirm **Chrome only**.
3. Confirm project path: `c:\Shopify\AiLab\proxel\shopify-theme-deep-preview`.
4. Recipients you share with: **staff / external / both** (decides weight on Phases 4 & 6).
5. UX preference: floating button (recommended) vs popup-only.
```