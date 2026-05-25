/**
 * GhostEyesSnap v3.0.0 - OSINT Module
 * Runs in page context on snapchat.com
 * Provides intelligence gathering capabilities using authenticated session
 *
 * Features:
 * - Username lookup via Snapchat's internal API
 * - Profile metadata extraction
 * - Username availability checking
 * - Public story detection
 * - Snap Map data extraction
 * - Bitmoji & snapcode retrieval
 */

(function () {
  "use strict";

  // Prevent double injection
  if (window.__GhostEyesSnapOSINTLoaded) return;
  window.__GhostEyesSnapOSINTLoaded = true;

  // ========== Snapchat Web API Endpoints ==========
  const API = {
    // User profile lookup
    USER_SEARCH: "/bff/search?query=",
    USER_PROFILE: "/bff/user/",
    USER_STORY: "/bff/story/",
    // Friend info
    ADD_FRIEND: "/bff/friends/add",
    FRIEND_INFO: "/bff/friends/",
    // Snap Map
    SNAP_MAP: "https://map.snapchat.com",
    // Public profile
    PUBLIC_PROFILE: "https://story.snapchat.com/s/",
  };

  // ========== OSINT Engine ==========
  const OSINT = {
    /**
     * Extract auth headers from the current Snapchat session
     */
    getAuthHeaders() {
      try {
        // Try to extract from webpack modules
        const chunks = window.webpackChunk_snapchat_web_calling_app;
        if (chunks) {
          for (const chunk of chunks) {
            try {
              const modules = chunk[1];
              for (const [, mod] of Object.entries(modules)) {
                try {
                  const result = mod({});
                  // Look for auth token patterns
                  if (result && typeof result === "object") {
                    const keys = Object.keys(result);
                    for (const key of keys) {
                      if (typeof result[key] === "string" && result[key].startsWith("Bearer ")) {
                        return { Authorization: result[key] };
                      }
                    }
                  }
                } catch {}
              }
            } catch {}
          }
        }
      } catch {}

      // Fallback: try to extract from cookie or localStorage
      try {
        const authToken = localStorage.getItem("sc-auth-token") ||
          localStorage.getItem("access_token") ||
          document.cookie.match(/sc-auth-token=([^;]+)/)?.[1];
        if (authToken) {
          return { Authorization: `Bearer ${authToken}` };
        }
      } catch {}

      return {};
    },

    /**
     * Make an authenticated fetch request to Snapchat's API
     */
    async apiFetch(url, options = {}) {
      const authHeaders = this.getAuthHeaders();
      const defaultOptions = {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          ...authHeaders,
        },
      };

      try {
        const response = await fetch(url, { ...defaultOptions, ...options });
        if (!response.ok) {
          return { success: false, status: response.status, error: `HTTP ${response.status}` };
        }
        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Look up a Snapchat username using multiple methods
     */
    async lookupUsername(username) {
      const results = {
        username: username,
        exists: false,
        available: null,
        displayName: null,
        bitmojiUrl: null,
        snapcodeUrl: null,
        snapScore: null,
        isVerified: false,
        hasPublicStory: false,
        bio: null,
        addedDate: null,
        mutualFriends: 0,
        timestamp: Date.now(),
      };

      // Method 1: Try Snapchat's search API
      try {
        const searchResult = await this.apiFetch(
          `https://www.snapchat.com${API.USER_SEARCH}${encodeURIComponent(username)}`
        );
        if (searchResult.success && searchResult.data) {
          const users = searchResult.data.users || searchResult.data.results || [];
          const exactMatch = users.find(
            (u) => u.username?.toLowerCase() === username.toLowerCase() ||
                   u.name?.toLowerCase() === username.toLowerCase()
          );
          if (exactMatch) {
            results.exists = true;
            results.available = false;
            results.displayName = exactMatch.displayName || exactMatch.name || null;
            results.bitmojiUrl = exactMatch.bitmojiUrl || exactMatch.bitmoji?.avatarUrl || null;
            results.isVerified = exactMatch.isVerified || false;
            results.bio = exactMatch.bio || exactMatch.description || null;
          }
        }
      } catch {}

      // Method 2: Try the direct user profile endpoint
      try {
        const profileResult = await this.apiFetch(
          `https://www.snapchat.com${API.USER_PROFILE}${encodeURIComponent(username)}`
        );
        if (profileResult.success && profileResult.data) {
          const profile = profileResult.data;
          results.exists = true;
          results.available = false;
          results.displayName = results.displayName || profile.displayName || profile.name || null;
          results.bitmojiUrl = results.bitmojiUrl || profile.bitmojiUrl || profile.bitmoji?.avatarUrl || null;
          results.snapScore = profile.snapScore || profile.snap_score || profile.score || null;
          results.isVerified = results.isVerified || profile.isVerified || false;
          results.bio = results.bio || profile.bio || profile.description || null;
          results.hasPublicStory = profile.hasPublicStory || profile.has_story || false;
        }
      } catch {}

      // Method 3: Try story endpoint (public stories)
      try {
        const storyResult = await this.apiFetch(
          `https://www.snapchat.com${API.USER_STORY}${encodeURIComponent(username)}`
        );
        if (storyResult.success && storyResult.data) {
          results.hasPublicStory = true;
          results.exists = true;
          results.available = false;
        }
      } catch {}

      // Method 4: Try to check via the add-friend endpoint (reveals if user exists)
      if (!results.exists) {
        try {
          const addResult = await this.apiFetch(
            `https://www.snapchat.com${API.FRIEND_INFO}${encodeURIComponent(username)}`,
            { method: "GET" }
          );
          if (addResult.success) {
            results.exists = true;
            results.available = false;
          } else if (addResult.status === 404) {
            results.exists = false;
            results.available = true;
          }
        } catch {}
      }

      // Method 5: Try fetching the public story page (no auth needed)
      if (!results.exists) {
        try {
          const response = await fetch(
            `https://story.snapchat.com/s/${encodeURIComponent(username)}`,
            { method: "HEAD", mode: "no-cors" }
          );
          // no-cors always returns opaque, but we can check if it doesn't throw
          results.exists = true;
          results.available = false;
        } catch {
          results.exists = false;
          results.available = true;
        }
      }

      // Always set snapcode URL
      results.snapcodeUrl = `https://app.snapchat.com/web/deeplink/snapcode?username=${encodeURIComponent(username)}&type=SVG`;

      return results;
    },

    /**
     * Check if a username is available (not registered)
     */
    async checkAvailability(username) {
      const result = await this.lookupUsername(username);
      return {
        available: result.available !== null ? result.available : !result.exists,
        exists: result.exists,
      };
    },

    /**
     * Extract current user's information from the page
     */
    extractCurrentUser() {
      try {
        const chunks = window.webpackChunk_snapchat_web_calling_app;
        if (!chunks) return null;

        let currentUser = null;

        for (const chunk of chunks) {
          try {
            const modules = chunk[1];
            for (const [, mod] of Object.entries(modules)) {
              try {
                const result = mod({});
                if (result && typeof result === "object") {
                  // Look for user objects
                  if (result.username && result.userId) {
                    currentUser = result;
                    break;
                  }
                  // Search nested objects
                  for (const key of Object.keys(result)) {
                    if (result[key] && typeof result[key] === "object" && result[key].username) {
                      currentUser = result[key];
                      break;
                    }
                  }
                }
              } catch {}
              if (currentUser) break;
            }
          } catch {}
          if (currentUser) break;
        }

        return currentUser;
      } catch {
        return null;
      }
    },

    /**
     * Scan the current page DOM for profile information
     */
    scanPageForProfile() {
      const profile = {};

      try {
        // Look for username in URL
        const urlMatch = window.location.pathname.match(/\/add\/([^/]+)/);
        if (urlMatch) {
          profile.username = urlMatch[1];
        }

        // Look for display name in page
        const nameEl = document.querySelector('[data-testid="user-name"], .profile-name, h1');
        if (nameEl) {
          profile.displayName = nameEl.textContent.trim();
        }

        // Look for bio
        const bioEl = document.querySelector('[data-testid="user-bio"], .profile-bio');
        if (bioEl) {
          profile.bio = bioEl.textContent.trim();
        }

        // Look for snap score
        const scoreEl = document.querySelector('[data-testid="snap-score"], .snap-score');
        if (scoreEl) {
          const scoreMatch = scoreEl.textContent.match(/[\d,]+/);
          if (scoreMatch) {
            profile.snapScore = scoreMatch[0].replace(/,/g, "");
          }
        }

        // Look for bitmoji
        const bitmojiImg = document.querySelector('img[src*="bitmoji"], img[alt*="Bitmoji"]');
        if (bitmojiImg) {
          profile.bitmojiUrl = bitmojiImg.src;
        }
      } catch {}

      return Object.keys(profile).length > 0 ? profile : null;
    },

    /**
     * Extract all visible conversation data
     */
    extractConversations() {
      const conversations = [];

      try {
        // Look for conversation items in the DOM
        const chatItems = document.querySelectorAll(
          '[data-testid="conversation-item"], .conversation-item, .chat-list-item'
        );

        chatItems.forEach((item) => {
          const nameEl = item.querySelector(".conversation-name, .chat-name, h3, span");
          const msgEl = item.querySelector(".conversation-preview, .chat-preview, p");
          const timeEl = item.querySelector(".conversation-time, .chat-time, time");

          if (nameEl) {
            conversations.push({
              name: nameEl.textContent.trim(),
              lastMessage: msgEl ? msgEl.textContent.trim() : null,
              time: timeEl ? timeEl.textContent.trim() : null,
            });
          }
        });
      } catch {}

      return conversations;
    },
  };

  // ========== Message Bridge ==========
  // Listen for messages from the content script (which relays from popup)
  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== "GhostEyesSnap-CS") return;

    const { type, requestId, username } = event.data;

    try {
      let result = null;

      switch (type) {
        case "OSINT_LOOKUP":
          result = await OSINT.lookupUsername(username);
          break;

        case "OSINT_AVAILABILITY":
          result = await OSINT.checkAvailability(username);
          break;

        case "OSINT_CURRENT_USER":
          result = OSINT.extractCurrentUser();
          break;

        case "OSINT_SCAN_PAGE":
          result = OSINT.scanPageForProfile();
          break;

        case "OSINT_CONVERSATIONS":
          result = OSINT.extractConversations();
          break;

        default:
          return;
      }

      // Send response back through the page
      window.postMessage({
        source: "GhostEyesSnap-OSINT",
        requestId: requestId,
        success: true,
        data: result,
      }, "*");
    } catch (error) {
      window.postMessage({
        source: "GhostEyesSnap-OSINT",
        requestId: requestId,
        success: false,
        error: error.message,
      }, "*");
    }
  });

  console.log("[GhostEyesSnap] OSINT Module loaded - Intelligence gathering enabled");
})();
