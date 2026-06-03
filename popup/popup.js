/* Proxel popup. Lists captured preview contexts and builds a link for the active tab. */
(() => {
  "use strict";

  const PARAM_KEYS = ["preview_theme_id", "key", "_ab", "_fd", "_sc", "pb"];

  function fmtAge(ts) {
    if (!ts) return "";
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return s + "s ago";
    const m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    return Math.floor(h / 24) + "d ago";
  }

  function status(msg) {
    const el = document.getElementById("status");
    el.textContent = msg;
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.textContent = ""), 2000);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }

  function paramsFromUrl(urlStr) {
    try {
      const u = new URL(urlStr);
      if (!u.searchParams.has("preview_theme_id")) return null;
      const p = {};
      for (const k of PARAM_KEYS) if (u.searchParams.has(k)) p[k] = u.searchParams.get(k);
      return p;
    } catch (_) {
      return null;
    }
  }

  async function loadContexts() {
    const all = await chrome.storage.local.get(null);
    return Object.entries(all)
      .filter(([k]) => k.startsWith("ctx:"))
      .map(([k, v]) => Object.assign({ _key: k }, v))
      .sort((a, b) => b.capturedAt - a.capturedAt);
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function renderCurrent(ctxs) {
    const box = document.getElementById("current");
    const tab = await getActiveTab();
    const isStore = tab && tab.url && /^https:\/\/[^/]+\.myshopify\.com/.test(tab.url);
    if (!isStore) {
      box.innerHTML =
        '<div class="empty">Open a theme preview tab, then reopen Proxel to copy a link for the current page.</div>';
      return;
    }
    const u = new URL(tab.url);
    let params = paramsFromUrl(tab.url);
    if (!params) {
      const m =
        ctxs.find((c) => c.domain === u.host && c.params && c.params.key) ||
        ctxs.find((c) => c.domain === u.host);
      if (m) params = m.params;
    }
    if (!params) {
      box.innerHTML = '<div class="empty">No preview captured for ' + u.host + " yet.</div>";
      return;
    }
    const link = buildShareLink({ domain: u.host, params }, u.pathname);
    box.innerHTML =
      '<div class="lbl">Current page</div><div class="link" id="curlink"></div>';
    box.querySelector("#curlink").textContent = link;
    const btn = document.createElement("button");
    btn.className = "primary";
    btn.textContent = params.key ? "Copy shareable link" : "Copy link (staff only)";
    btn.onclick = () => {
      copyText(link);
      status("Copied!");
    };
    box.appendChild(btn);
  }

  function renderList(ctxs) {
    const list = document.getElementById("list");
    list.innerHTML = "";
    if (!ctxs.length) {
      list.innerHTML = '<div class="empty">No captured previews yet.</div>';
      return;
    }
    for (const c of ctxs) {
      const row = document.createElement("div");
      row.className = "row";

      const meta = document.createElement("div");
      meta.className = "meta";
      const shareable = c.params && c.params.key ? "shareable" : "staff-only";
      meta.innerHTML =
        "<b>" + c.domain + "</b><span>#" + c.themeId + " · " + shareable + " · " + fmtAge(c.capturedAt) + "</span>";

      const home = buildShareLink({ domain: c.domain, params: c.params }, "/");
      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copy home";
      copyBtn.onclick = () => {
        copyText(home);
        status("Copied!");
      };

      const del = document.createElement("button");
      del.className = "ghost";
      del.textContent = "✕";
      del.title = "Remove";
      del.onclick = async () => {
        await chrome.storage.local.remove(c._key);
        render();
      };

      row.appendChild(meta);
      row.appendChild(copyBtn);
      row.appendChild(del);
      list.appendChild(row);
    }
  }

  async function render() {
    const ctxs = await loadContexts();
    await renderCurrent(ctxs);
    renderList(ctxs);
  }

  document.getElementById("clear").onclick = async () => {
    const ctxs = await loadContexts();
    if (ctxs.length) await chrome.storage.local.remove(ctxs.map((c) => c._key));
    await chrome.storage.local.remove("lastCtx");
    render();
    status("Cleared");
  };

  render();
})();
