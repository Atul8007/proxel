/**
 * Proxel — admin MAIN-world capture (runs on admin.shopify.com, document_start).
 *
 * "Share preview -> Copy link" copies a key-bearing preview URL to the clipboard without
 * opening a tab. This script passively intercepts that copy (layered across the Clipboard
 * API, document.execCommand, and the copy event) and forwards any URL containing
 * `preview_theme_id` to the isolated bridge via window.postMessage.
 *
 * MAIN world cannot use chrome.* APIs — it only posts a message; admin-bridge.js stores it.
 */
(() => {
  "use strict";

  function post(url) {
    try {
      window.postMessage({ __proxel: true, kind: "share", url }, location.origin);
    } catch (_) {}
  }

  function grab(text) {
    if (typeof text === "string" && text.indexOf("preview_theme_id") !== -1) post(text);
  }

  // Clipboard API
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    const orig = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = function (text) {
      grab(text);
      return orig(text);
    };
  }

  // Legacy execCommand('copy')
  if (typeof document.execCommand === "function") {
    const origExec = document.execCommand.bind(document);
    document.execCommand = function (cmd) {
      try {
        if (/copy/i.test(cmd)) {
          const sel = document.getSelection && document.getSelection().toString();
          grab(sel);
          const focused = document.querySelector("textarea:focus, input:focus");
          if (focused) grab(focused.value);
        }
      } catch (_) {}
      return origExec.apply(document, arguments);
    };
  }

  // Copy event (covers selection-based copies)
  document.addEventListener(
    "copy",
    () => {
      try {
        grab(document.getSelection().toString());
      } catch (_) {}
    },
    true
  );
})();
