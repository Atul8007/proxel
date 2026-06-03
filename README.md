# Proxel

A Chrome (Manifest V3) extension that captures a **Shopify theme preview** the moment you
open it, then lets you **copy a direct, shareable link to whatever page you're currently
on** inside that preview — so recipients land on the exact page in the exact theme, with no
manual navigation.

## Why

A store can have many duplicated themes, each with its own preview. Sharing a specific page
normally means opening the preview and manually navigating to the page every time. Proxel
removes that step.

## How it works

1. **Capture.** When a theme preview opens, the storefront URL on `*.myshopify.com` carries
   the working params (`preview_theme_id`, plus `key` for *Share preview* links). A content
   script reads and stores them.
2. **Copy.** A floating **"Copy preview URL"** button appears on preview pages. As you
   navigate, clicking it builds a link for the **current path** using the captured params.
3. **Share.** The copied URL opens that exact page within that theme preview.

### Two kinds of link

| Admin action you used | Copied link contains       | Who can open it        |
| --------------------- | -------------------------- | ---------------------- |
| **Preview** (eye)     | `preview_theme_id`         | Logged-in staff only   |
| **Share preview**     | `preview_theme_id` + `key` | Anyone (key is public) |

For external sharing, start from **Share preview** so the `key` is captured. Proxel also
grabs that link directly from the admin clipboard action (no tab needs to open).

## Install (unpacked)

1. Go to `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Open a theme preview, browse to a page, click **Copy preview URL** (or use the popup).

## Project layout

```
manifest.json
content/
  storefront.js          # *.myshopify.com: capture context, inject Copy button
  admin-capture-main.js  # admin MAIN world: intercept Share-preview clipboard copy
  admin-bridge.js        # admin isolated world: relay captured link -> storage
popup/                   # list captured previews, copy current page, clear
lib/urlbuilder.js        # pure link builder
tests/urlbuilder.test.js # unit tests (node tests/urlbuilder.test.js)
```

## Test

```
npm test
```

## Notes & limits

- **Chrome only** (uses MV3 `world: "MAIN"` content scripts).
- `key=` links can **expire**; re-capture if a shared link stops working.
- Whether a `key` link survives being pointed at a deep path depends on Shopify; if a
  shared deep link bounces to the homepage, open the homepage `key` link first (to set the
  preview session), then the deep path.
- Captured `key=` links are credentials — stored in `chrome.storage.local` only (never
  synced). Use **Clear all** in the popup to remove them.

See [PLAN.md](PLAN.md) for the full design.
