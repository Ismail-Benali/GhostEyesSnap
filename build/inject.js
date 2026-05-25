/**
 * GhostEyesSnap v3.0.0 - Content Script Injector (Enhanced)
 *
 * Cross-browser compatible content script that:
 * 1. Detects if running in the main frame (prevents iframe execution)
 * 2. Loads the browser compatibility layer into the page context
 * 3. Loads the main application script into the page context
 * 4. Loads the OSINT intelligence module into the page context
 * 5. Loads the enhanced settings overlay into the page context
 * 6. Bridges messages between popup ↔ content script ↔ page context
 *
 * Compatible with: Chrome, Firefox, Edge, Safari, Opera, Brave
 */

"use strict";

(function () {
  // ========== Frame Detection ==========
  if (window.self !== window.top) {
    return;
  }

  // ========== Cross-Browser API Access ==========
  const runtimeAPI =
    (typeof browser !== "undefined" && browser.runtime) ||
    (typeof chrome !== "undefined" && chrome.runtime);

  if (!runtimeAPI || !runtimeAPI.getURL) {
    console.error("[GhostEyesSnap] Runtime API not available");
    return;
  }

  /**
   * Inject a script file into the page context
   */
  function injectScript(scriptPath) {
    try {
      const scriptURL = runtimeAPI.getURL(scriptPath);
      const script = document.createElement("script");
      script.src = scriptURL;
      script.type = "text/javascript";

      const target =
        document.documentElement || document.head || document.body;

      if (target) {
        target.insertBefore(script, target.firstChild);
        script.addEventListener("load", function () {
          script.remove();
        });
        script.addEventListener("error", function () {
          console.error("[GhostEyesSnap] Failed to load:", scriptPath);
          script.remove();
        });
      } else {
        document.addEventListener("DOMContentLoaded", function () {
          const t =
            document.documentElement || document.head || document.body;
          if (t) {
            t.insertBefore(script, t.firstChild);
          }
        });
      }
    } catch (e) {
      console.error("[GhostEyesSnap] Script injection failed:", e);
    }
  }

  // ========== Inject Scripts in Order ==========
  // 1. Browser compatibility layer (must be first)
  injectScript("build/browser-compat.js");

  // 2. Main application script
  injectScript("build/script.js");

  // 3. OSINT intelligence module
  setTimeout(function () {
    injectScript("build/osint.js");
  }, 50);

  // 3. Enhanced settings overlay (loads after a delay to wait for DOM)
  setTimeout(function () {
    injectScript("build/inject-settings.js");
  }, 100);

  console.log("[GhostEyesSnap] All content scripts injected successfully");

  // ========== Message Bridge ==========
  // Bridge messages between popup ↔ content script ↔ page context

  // Pending requests map (requestId → resolve function)
  const pendingRequests = new Map();
  let requestIdCounter = 0;

  // Listen for responses from the OSINT module in page context
  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== "GhostEyesSnap-OSINT") return;

    const { requestId, success, data, error } = event.data;

    if (requestId && pendingRequests.has(requestId)) {
      const resolve = pendingRequests.get(requestId);
      pendingRequests.delete(requestId);
      resolve({ success, data, error });
    }
  });

  /**
   * Send a request to the OSINT module in page context and get a response
   */
  function sendToPageContext(type, payload = {}) {
    return new Promise((resolve) => {
      const requestId = "osint_" + (++requestIdCounter) + "_" + Date.now();
      pendingRequests.set(requestId, resolve);

      // Set timeout to avoid hanging
      setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          resolve({ success: false, error: "Request timed out" });
        }
      }, 15000);

      window.postMessage({
        source: "GhostEyesSnap-CS",
        type: type,
        requestId: requestId,
        ...payload,
      }, "*");
    });
  }

  // Listen for messages from the popup
  const runtimeOnMessage = runtimeAPI.onMessage || (chrome.runtime && chrome.runtime.onMessage);

  if (runtimeOnMessage) {
    runtimeOnMessage.addListener(function (message, sender, sendResponse) {
      if (!message || !message.type) return false;

      // Handle OSINT requests from popup
      if (message.type === "OSINT_LOOKUP") {
        sendToPageContext("OSINT_LOOKUP", { username: message.username })
          .then((result) => {
            sendResponse(result);
          });
        return true; // Keep message channel open for async response
      }

      if (message.type === "OSINT_AVAILABILITY") {
        sendToPageContext("OSINT_AVAILABILITY", { username: message.username })
          .then((result) => {
            sendResponse(result);
          });
        return true;
      }

      // Handle setting updates from popup
      if (message.type === "SETTING_UPDATE") {
        // Forward to page context via localStorage + custom event
        try {
          // Read current settings from localStorage
          const STORAGE_PREFIX = "bs_";
          let settings = {};
          try {
            const data = window.localStorage.getItem(STORAGE_PREFIX + "settings");
            if (data) settings = JSON.parse(data);
          } catch {}

          // Update the specific setting
          settings[message.key] = message.value;
          window.localStorage.setItem(STORAGE_PREFIX + "settings", JSON.stringify(settings));

          // Dispatch custom event for the main script to pick up
          window.dispatchEvent(new CustomEvent("ghosteyessnap:setting:update", {
            detail: { key: message.key, value: message.value },
          }));

          // Also dispatch a custom event on the document for the settings panel
          window.postMessage({
            source: "GhostEyesSnap-CS",
            type: "SETTING_UPDATE_FROM_POPUP",
            key: message.key,
            value: message.value,
            allSettings: message.allSettings,
          }, "*");

          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        return false;
      }

      return false;
    });
  }
})();
