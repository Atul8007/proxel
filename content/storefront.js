/**
 * Proxel — storefront content script (runs on *.myshopify.com).
 *
 * 1. Captures the preview context (preview_theme_id + key + flags) from the URL the
 *    moment a preview tab loads, and persists it (params may later move to a cookie).
 * 2. Injects a floating "Copy preview URL" button.
 * 3. On click, builds a shareable link for the CURRENT path using the active context.
 *
 * `buildShareLink` is provided by lib/urlbuilder.js (same content-script scope).
 */
(() => {
  "use strict";

  const PARAM_KEYS = ["preview_theme_id", "key", "_ab", "_fd", "_sc", "pb"];
  const ctxKey = (domain, themeId) => `ctx:${domain}:${themeId}`;

  function extractParams(urlStr) {
    let u;
    try {
      u = new URL(urlStr);
    } catch (_) {
      return null;
    }
    if (!u.searchParams.has("preview_theme_id")) return null;
    const params = {};
    for (const k of PARAM_KEYS) {
      if (u.searchParams.has(k)) params[k] = u.searchParams.get(k);
    }
    return params;
  }

  function readLiveParams() {
    return extractParams(location.href);
  }

  // If Shopify stripped the param from this page but we arrived from a preview URL,
  // recover it from the referrer (same store, so we keep the current host).
  function readReferrerParams() {
    return document.referrer ? extractParams(document.referrer) : null;
  }

  async function persist(params) {
    const themeId = params.preview_theme_id;
    const ctx = {
      domain: location.host,
      themeId,
      params,
      source: params.key ? "url+key" : "url",
      capturedAt: Date.now()
    };
    await chrome.storage.local.set({ [ctxKey(location.host, themeId)]: ctx, lastCtx: ctx });
    return ctx;
  }

  async function storedCtxForDomain() {
    const all = await chrome.storage.local.get(null);
    const matches = Object.entries(all)
      .filter(([k, v]) => k.startsWith("ctx:") && v && v.domain === location.host && v.params)
      .map(([, v]) => v);
    if (!matches.length) return null;
    // Prefer a shareable (key) context, then the most recently captured.
    matches.sort((a, b) =>
      (Number(!!b.params.key) - Number(!!a.params.key)) || (b.capturedAt - a.capturedAt));
    return matches[0];
  }

  async function activeParams() {
    const live = readLiveParams() || readReferrerParams();
    if (live) {
      await persist(live);
      return live;
    }
    const stored = await storedCtxForDomain();
    return stored ? stored.params : null;
  }

  // ---------- UI ----------
  function showToast(msg) {
    let el = document.getElementById("proxel-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "proxel-toast";
      document.documentElement.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }

  async function onCopy() {
    const params = await activeParams();
    if (!params) {
      showToast("Proxel: no preview context found");
      return;
    }
    const link = buildShareLink({ domain: location.host, params }, location.pathname);
    await copyText(link);
    showToast(params.key ? "Shareable preview link copied" : "Preview link copied (staff only)");
  }

  function injectButton() {
    if (document.getElementById("proxel-btn")) return;
    const btn = document.createElement("button");
    btn.id = "proxel-btn";
    btn.type = "button";
    btn.textContent = "Copy preview URL";
    btn.addEventListener("click", onCopy);
    document.documentElement.appendChild(btn);
  }

  function whenReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  async function init() {
    // Capture as early as possible (runs at document_start) before Shopify can strip params.
    const live = readLiveParams() || readReferrerParams();
    if (live) await persist(live);
    const params = await activeParams();
    console.debug(
      "[Proxel] storefront",
      location.href,
      "| live:", !!readLiveParams(),
      "| referrer:", !!readReferrerParams(),
      "| active:", params
    );
    if (params) whenReady(injectButton);
  }

  init();
})();
