/**
 * GhostEyesSnap v3.0.0 - Browser Compatibility Layer
 * Injected into Page Context
 *
 * This script runs in the PAGE context (not content script context)
 * and provides cross-browser compatibility patches for features
 * that differ between Chrome, Firefox, Edge, and Safari.
 *
 * Key fixes:
 * - Navigator.prototype.userAgent override (Firefox/Safari compatibility)
 * - Permissions API handling
 * - getUserMedia legacy API support
 * - Anti-blur for unfocused tab
 * - Visibility API override
 * - Clipboard API enhancements
 */

(function () {
  "use strict";

  // Prevent double injection
  if (window.__GhostEyesSnapCompatLoaded) return;
  window.__GhostEyesSnapCompatLoaded = true;

  /**
   * Detect browser from page context
   */
  const BrowserDetect = {
    _cache: null,

    detect() {
      if (this._cache) return this._cache;
      const ua = navigator.userAgent;
      this._cache = {
        isFirefox: ua.includes("Firefox"),
        isSafari: ua.includes("Safari") && !ua.includes("Chrome"),
        isChrome: ua.includes("Chrome") && !ua.includes("Edg/") && !ua.includes("OPR/"),
        isEdge: ua.includes("Edg/"),
        isOpera: ua.includes("OPR/") || ua.includes("Opera"),
        isBrave: navigator.brave && typeof navigator.brave.isBrave === "function",
      };
      this._cache.isChromiumBased = this._cache.isChrome || this._cache.isEdge || this._cache.isOpera;
      this._cache.isWebKitBased = this._cache.isSafari;
      this._cache.isGeckoBased = this._cache.isFirefox;
      return this._cache;
    },

    get canOverrideUserAgent() {
      try {
        const testDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, "userAgent");
        if (testDesc && testDesc.configurable === false) return false;
        return true;
      } catch {
        return false;
      }
    },

    get supportsProxy() {
      return typeof Proxy !== "undefined";
    },

    get supportsBroadcastChannel() {
      return typeof BroadcastChannel !== "undefined";
    },

    get supportsPermissionsAPI() {
      return "permissions" in navigator && typeof navigator.permissions.query === "function";
    },

    get supportsMediaDevices() {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    },
  };

  // ========== Settings Reader ==========
  function getSetting(key, defaultVal) {
    try {
      const data = window.localStorage.getItem("bs_settings");
      if (data) {
        const settings = JSON.parse(data);
        if (settings[key] !== undefined) return settings[key];
      }
    } catch {}
    return defaultVal;
  }

  // ========== Anti-Blur Feature ==========
  // Snapchat Web blurs the page when the tab loses focus
  // This patch prevents the blur by intercepting visibility changes
  function installAntiBlur() {
    if (!getSetting("ANTI_BLUR", false)) return;

    // Method 1: Override document.visibilityState
    try {
      Object.defineProperty(document, "visibilityState", {
        get: function () { return "visible"; },
        configurable: true,
      });
    } catch {}

    // Method 2: Override document.hidden
    try {
      Object.defineProperty(document, "hidden", {
        get: function () { return false; },
        configurable: true,
      });
    } catch {}

    // Method 3: Intercept visibilitychange events
    document.addEventListener("visibilitychange", function (e) {
      if (getSetting("ANTI_BLUR", false)) {
        e.stopImmediatePropagation();
      }
    }, true);

    // Method 4: Override window blur events that Snapchat uses
    const originalBlur = window.blur;
    window.blur = function () {
      if (getSetting("ANTI_BLUR", false)) return;
      return originalBlur.apply(this, arguments);
    };

    // Method 5: Intercept CSS blur on the body
    const observer = new MutationObserver(function (mutations) {
      if (!getSetting("ANTI_BLUR", false)) return;
      mutations.forEach(function (mutation) {
        if (mutation.type === "attributes" && mutation.attributeName === "style") {
          const target = mutation.target;
          if (target.style && target.style.filter && target.style.filter.includes("blur")) {
            target.style.filter = target.style.filter.replace(/blur\([^)]*\)/g, "");
          }
        }
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          const target = mutation.target;
          if (target.classList && (
            target.classList.contains("blur") ||
            target.classList.contains("blurred") ||
            target.classList.contains("unfocused")
          )) {
            target.classList.remove("blur", "blurred", "unfocused");
          }
        }
      });
    });

    // Start observing when DOM is ready
    if (document.body) {
      observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["style", "class"] });
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["style", "class"] });
      });
    }

    // Method 6: Inject CSS to counteract blur
    const style = document.createElement("style");
    style.textContent = `
      body.blur, body.blurred, body.unfocused,
      [class*="blur"], [class*="Blur"],
      [style*="blur"], [style*="Blur"] {
        filter: none !important;
        -webkit-filter: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);

    console.log("[GhostEyesSnap] Anti-blur protection installed");
  }

  // ========== Stealth Mode ==========
  // When stealth mode is enabled, prevent all detection signals
  function installStealthMode() {
    if (!getSetting("STEALTH_MODE", false)) return;

    // Prevent screenshot detection
    try {
      // Override the Screen Capture API
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
      if (originalGetDisplayMedia) {
        navigator.mediaDevices.getDisplayMedia = function () {
          // Block screen capture detection
          return Promise.reject(new Error("Screen capture blocked by GhostEyesSnap Stealth Mode"));
        };
      }
    } catch {}

    // Prevent focus detection
    window.addEventListener("focus", function (e) {
      if (getSetting("STEALTH_MODE", false)) {
        e.stopImmediatePropagation();
      }
    }, true);

    window.addEventListener("blur", function (e) {
      if (getSetting("STEALTH_MODE", false)) {
        e.stopImmediatePropagation();
      }
    }, true);

    console.log("[GhostEyesSnap] Stealth mode initialized");
  }

  // ========== Clipboard Enhancement ==========
  // Allow copying text from Snapchat Web which sometimes blocks it
  function installClipboardEnhancement() {
    // Re-enable copy/paste/cut events
    ["copy", "paste", "cut"].forEach(function (eventName) {
      document.addEventListener(eventName, function (e) {
        e.stopPropagation();
      }, true);
    });

    // Re-enable context menu
    document.addEventListener("contextmenu", function (e) {
      e.stopPropagation();
    }, true);
  }

  // Export to page context
  window.__GhostEyesSnapCompat = {
    BrowserDetect: BrowserDetect,

    /**
     * Safely override Navigator.prototype.userAgent
     */
    overrideUserAgent(userAgentString) {
      const canOverride = BrowserDetect.canOverrideUserAgent;

      if (canOverride) {
        try {
          Object.defineProperty(Navigator.prototype, "userAgent", {
            get: function () {
              return userAgentString;
            },
            configurable: true,
          });
          return true;
        } catch (e) {
          console.warn("[GhostEyesSnap] Cannot override Navigator.prototype.userAgent:", e.message);
        }
      }

      try {
        Object.defineProperty(navigator, "userAgent", {
          get: function () {
            return userAgentString;
          },
          configurable: true,
        });
        return true;
      } catch (e) {
        console.warn("[GhostEyesSnap] Cannot override navigator.userAgent:", e.message);
      }

      return false;
    },

    /**
     * Get a Chrome-like User-Agent string
     * Updated to Chrome 131 for 2025
     */
    getChromeUserAgent() {
      const platform = navigator.platform || "";
      const isMac = platform.includes("Mac");
      const isWin = platform.includes("Win");
      const isLinux = platform.includes("Linux");

      if (isMac) {
        return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
      }
      if (isWin) {
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
      }
      if (isLinux) {
        return "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
      }
      return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    },

    /**
     * Fix getUserMedia for Firefox/Safari compatibility
     */
    fixGetUserMedia() {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        if (!navigator.getUserMedia) {
          navigator.getUserMedia = function (constraints, success, error) {
            navigator.mediaDevices
              .getUserMedia(constraints)
              .then(success)
              .catch(error);
          };
        }
        if (!navigator.webkitGetUserMedia) {
          navigator.webkitGetUserMedia = navigator.getUserMedia;
        }
        if (!navigator.mozGetUserMedia) {
          navigator.mozGetUserMedia = navigator.getUserMedia;
        }
      }
    },

    /**
     * Fix permissions API for Firefox
     */
    fixPermissionsAPI() {
      if (!BrowserDetect.supportsPermissionsAPI) return;

      if (BrowserDetect.detect().isFirefox) {
        const originalQuery = navigator.permissions.query.bind(navigator.permissions);

        navigator.permissions.query = function (descriptor) {
          if (descriptor.name === "camera" || descriptor.name === "microphone") {
            return new Promise((resolve) => {
              const constraints = {};
              if (descriptor.name === "camera") constraints.video = true;
              if (descriptor.name === "microphone") constraints.audio = true;

              navigator.mediaDevices
                .getUserMedia(constraints)
                .then((stream) => {
                  stream.getTracks().forEach((track) => track.stop());
                  resolve({ state: "granted" });
                })
                .catch(() => {
                  resolve({ state: "denied" });
                });
            });
          }

          return originalQuery(descriptor);
        };
      }
    },

    /**
     * Initialize all compatibility patches
     */
    init() {
      this.fixGetUserMedia();
      this.fixPermissionsAPI();

      // Install enhanced features
      installAntiBlur();
      installStealthMode();
      installClipboardEnhancement();

      // Log compatibility status
      const browser = BrowserDetect.detect();
      console.log("[GhostEyesSnap v3.0] Compatibility layer initialized", {
        browser: browser,
        canOverrideUA: BrowserDetect.canOverrideUserAgent,
        supportsProxy: BrowserDetect.supportsProxy,
        supportsBroadcastChannel: BrowserDetect.supportsBroadcastChannel,
        supportsPermissionsAPI: BrowserDetect.supportsPermissionsAPI,
        supportsMediaDevices: BrowserDetect.supportsMediaDevices,
        antiBlur: getSetting("ANTI_BLUR", false),
        stealthMode: getSetting("STEALTH_MODE", false),
      });
    },
  };

  // Auto-initialize
  window.__GhostEyesSnapCompat.init();
})();
