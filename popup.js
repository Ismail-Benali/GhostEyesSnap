/**
 * GhostEyesSnap v3.0.0 - Popup Script
 * Handles settings UI, tab navigation, OSINT tools, and storage sync
 */

"use strict";

// ========== Browser API ==========
const browserAPI = (typeof browser !== "undefined" && browser.runtime)
  ? browser
  : (typeof chrome !== "undefined" && chrome.runtime) ? chrome : null;

if (!browserAPI) {
  document.body.innerHTML = '<div style="padding:20px;color:red;">Error: Browser API not available</div>';
}

// ========== Default Settings ==========
const DEFAULTS = {
  ALLOW_SCREENSHOT: true,
  SAVE_IMAGE: true,
  ALWAYS_PRESENT: true,
  SEND_UNSAVEABLE_MESSAGES: false,
  SNAP_AS_MOBILE: false,
  PRIVATE_STORIES: false,
  UPLOAD_SNAPS: false,
  PREVENT_TYPING_NOTIFICATION: false,
  PREVENT_TYPING: false,
  HIDE_BITMOJI: false,
  MOBILE_BITMOJI: false,
  AUTO_SAVE_CHATS: false,
  SHOW_STREAKS: true,
  PREVENT_CHAT_READ_RECEIPTS: false,
  UNLIMITED_FILE_SIZE: false,
  ALLOW_CROSS_TAB: true,
  PREVENT_STORY_READ_RECEIPTS: false,
  HALF_SWIPE_NOTIFICATION: false,
  OPEN_CHAT_NOTIFICATION: false,
  BITMOJI_PRESENCE: "DEFAULT",
  CHAT_HANDLING: "DEFAULT",
  STEALTH_MODE: false,
  ANTI_BLUR: false,
};

// ========== Storage ==========
const STORAGE_PREFIX = "bs_";

function getStorage() {
  return new Promise((resolve) => {
    try {
      if (browserAPI.storage && browserAPI.storage.local) {
        browserAPI.storage.local.get("settings", (result) => {
          resolve(result.settings || null);
        });
      } else {
        const data = localStorage.getItem(STORAGE_PREFIX + "settings");
        resolve(data ? JSON.parse(data) : null);
      }
    } catch {
      const data = localStorage.getItem(STORAGE_PREFIX + "settings");
      resolve(data ? JSON.parse(data) : null);
    }
  });
}

function setStorage(settings) {
  return new Promise((resolve) => {
    try {
      if (browserAPI.storage && browserAPI.storage.local) {
        browserAPI.storage.local.set({ settings }, resolve);
      } else {
        localStorage.setItem(STORAGE_PREFIX + "settings", JSON.stringify(settings));
        resolve();
      }
    } catch {
      localStorage.setItem(STORAGE_PREFIX + "settings", JSON.stringify(settings));
      resolve();
    }
  });
}

function getOSINTHistory() {
  return new Promise((resolve) => {
    try {
      if (browserAPI.storage && browserAPI.storage.local) {
        browserAPI.storage.local.get("osint_history", (result) => {
          resolve(result.osint_history || []);
        });
      } else {
        const data = localStorage.getItem(STORAGE_PREFIX + "osint_history");
        resolve(data ? JSON.parse(data) : []);
      }
    } catch {
      resolve([]);
    }
  });
}

function addOSINTHistory(username, data) {
  return new Promise(async (resolve) => {
    try {
      let history = await getOSINTHistory();
      // Remove duplicate
      history = history.filter(h => h.username !== username);
      // Add to front
      history.unshift({
        username,
        displayName: data.displayName || username,
        timestamp: Date.now(),
        available: data.available,
      });
      // Keep max 20
      history = history.slice(0, 20);

      if (browserAPI.storage && browserAPI.storage.local) {
        browserAPI.storage.local.set({ osint_history: history }, resolve);
      } else {
        localStorage.setItem(STORAGE_PREFIX + "osint_history", JSON.stringify(history));
        resolve();
      }
    } catch {
      resolve();
    }
  });
}

// ========== Tab Navigation ==========
function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => c.classList.remove("active"));

      tab.classList.add("active");
      const tabId = "tab-" + tab.dataset.tab;
      document.getElementById(tabId).classList.add("active");
    });
  });
}

// ========== Settings Sync ==========
let currentSettings = { ...DEFAULTS };

async function loadSettings() {
  const stored = await getStorage();
  if (stored) {
    currentSettings = { ...DEFAULTS, ...stored };
  } else {
    currentSettings = { ...DEFAULTS };
  }
  updateUI();
}

function updateUI() {
  // Update toggles
  document.querySelectorAll('.toggle input[type="checkbox"]').forEach((input) => {
    const key = input.dataset.key;
    if (key && currentSettings[key] !== undefined) {
      input.checked = !!currentSettings[key];
    }
  });

  // Update radio groups
  document.querySelectorAll(".radio-group").forEach((group) => {
    const key = group.dataset.setting;
    if (key && currentSettings[key] !== undefined) {
      group.querySelectorAll(".radio-option").forEach((opt) => {
        opt.classList.toggle("active", opt.dataset.value === currentSettings[key]);
      });
    }
  });
}

async function saveSetting(key, value) {
  currentSettings[key] = value;

  // Stealth mode special logic
  if (key === "STEALTH_MODE" && value === true) {
    currentSettings.PREVENT_TYPING_NOTIFICATION = true;
    currentSettings.PREVENT_CHAT_READ_RECEIPTS = true;
    currentSettings.PREVENT_STORY_READ_RECEIPTS = true;
    currentSettings.ALWAYS_PRESENT = true;
    currentSettings.PREVENT_TYPING = true;
    updateUI();
  }

  await setStorage(currentSettings);

  // Send to content script on active Snapchat tab
  try {
    const [tab] = await browserAPI.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab && tab.url && tab.url.includes("snapchat.com")) {
      browserAPI.tabs.sendMessage(tab.id, {
        type: "SETTING_UPDATE",
        key,
        value,
        allSettings: currentSettings,
      });
    }
  } catch {
    // Tab might not support messaging
  }

  showToast(`${key} ${value ? "enabled" : "disabled"}`);
}

// ========== Event Listeners ==========
function initEventListeners() {
  // Toggle switches
  document.querySelectorAll('.toggle input[type="checkbox"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      e.stopPropagation();
      saveSetting(input.dataset.key, input.checked);
    });
  });

  // Radio groups
  document.querySelectorAll(".radio-group").forEach((group) => {
    group.querySelectorAll(".radio-option").forEach((opt) => {
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        const key = group.dataset.setting;
        const value = opt.dataset.value;
        saveSetting(key, value);
        updateUI();
      });
    });
  });

  // Setting items (click to toggle)
  document.querySelectorAll(".setting-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (e.target.closest(".radio-group") || e.target.closest(".toggle")) return;
      const toggle = item.querySelector('.toggle input[type="checkbox"]');
      if (toggle) {
        toggle.checked = !toggle.checked;
        toggle.dispatchEvent(new Event("change"));
      }
    });
  });

  // Reset button
  document.getElementById("resetBtn").addEventListener("click", async () => {
    currentSettings = { ...DEFAULTS };
    await setStorage(currentSettings);
    updateUI();
    showToast("Settings reset to defaults");
  });

  // Export button
  document.getElementById("exportBtn").addEventListener("click", () => {
    const exportData = {
      version: "3.0.0",
      settings: currentSettings,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ghosteyessnap-settings.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Settings exported");
  });
}

// ========== OSINT Module ==========
const SNAPCHAT_API_BASE = "https://accounts.snapchat.com";
const SNAPCHAT_WEB_API = "https://www.snapchat.com";

/**
 * Lookup a Snapchat username via the public profile endpoint
 * Uses the same origin as the Snapchat web page to leverage existing auth
 */
async function lookupUsername(username) {
  const results = {
    username: username,
    available: null,
    exists: false,
    displayName: null,
    bitmojiUrl: null,
    snapcodeUrl: null,
    snapScore: null,
    isVerified: false,
    hasPublicStory: false,
    bio: null,
    timestamp: Date.now(),
  };

  try {
    // Method 1: Check via the public profile page (fetch from page context)
    // We send a message to the content script which runs on snapchat.com
    const [tab] = await browserAPI.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab && tab.url && tab.url.includes("snapchat.com")) {
      // Send OSINT request to content script
      const response = await browserAPI.tabs.sendMessage(tab.id, {
        type: "OSINT_LOOKUP",
        username: username,
      });

      if (response && response.success) {
        return { ...results, ...response.data };
      }
    }

    // Fallback: Try public endpoints directly
    // Snapchat's add friend endpoint can reveal if a username exists
    try {
      const profileUrl = `https://story.snapchat.com/s/${username}`;
      const profileResp = await fetch(profileUrl, {
        method: "HEAD",
        mode: "no-cors",
      });
      // If no error, profile likely exists
      results.exists = true;
      results.available = false;
    } catch {
      results.available = true;
      results.exists = false;
    }

    // Try getting snapcode SVG
    try {
      results.snapcodeUrl = `https://app.snapchat.com/web/deeplink/snapcode?username=${encodeURIComponent(username)}&type=SVG`;
    } catch {}

  } catch (error) {
    console.error("[GhostEyesSnap OSINT] Lookup error:", error);
  }

  return results;
}

/**
 * Check if a username is available on Snapchat
 */
async function checkAvailability(username) {
  try {
    const [tab] = await browserAPI.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab && tab.url && tab.url.includes("snapchat.com")) {
      const response = await browserAPI.tabs.sendMessage(tab.id, {
        type: "OSINT_AVAILABILITY",
        username: username,
      });

      if (response && response.success) {
        return response.data;
      }
    }
  } catch {}

  // Fallback
  const result = await lookupUsername(username);
  return { available: result.available, exists: result.exists };
}

/**
 * Format timestamp for display
 */
function formatTime(ts) {
  const date = new Date(ts);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

/**
 * Render OSINT results in the popup
 */
function renderOSINTResult(data) {
  const container = document.getElementById("osintResults");

  if (!data) {
    container.innerHTML = `
      <div class="osint-empty">
        <div class="icon">👻</div>
        <p>No results found</p>
      </div>`;
    return;
  }

  let html = `<div class="osint-result-card">`;

  // Profile header
  html += `<div class="osint-profile">`;
  if (data.bitmojiUrl) {
    html += `<div class="osint-avatar"><img src="${data.bitmojiUrl}" style="width:100%;border-radius:50%;"></div>`;
  } else {
    html += `<div class="osint-avatar">👻</div>`;
  }
  html += `<div class="osint-profile-info">`;
  html += `<h3>${data.displayName || data.username}</h3>`;
  html += `<p>@${data.username}</p>`;
  if (data.isVerified) {
    html += ` <span class="osint-badge verified">Verified</span>`;
  }
  if (data.available === true) {
    html += ` <span class="osint-badge available">Available</span>`;
  } else if (data.exists === true || data.available === false) {
    html += ` <span class="osint-badge taken">Taken</span>`;
  }
  html += `</div></div>`;

  // Details grid
  html += `<div class="osint-details">`;
  if (data.snapScore !== null && data.snapScore !== undefined) {
    html += `<div class="osint-detail-item"><div class="label">Snap Score</div><div class="value">${data.snapScore}</div></div>`;
  }
  if (data.hasPublicStory !== undefined) {
    html += `<div class="osint-detail-item"><div class="label">Public Story</div><div class="value">${data.hasPublicStory ? "Yes" : "No"}</div></div>`;
  }
  if (data.bio) {
    html += `<div class="osint-detail-item" style="grid-column: span 2;"><div class="label">Bio</div><div class="value">${data.bio}</div></div>`;
  }
  html += `<div class="osint-detail-item"><div class="label">Lookup Time</div><div class="value">${formatTime(data.timestamp)}</div></div>`;
  html += `<div class="osint-detail-item"><div class="label">Profile</div><div class="value"><a href="https://snapchat.com/add/${data.username}" target="_blank" style="color:var(--cyan);">Open</a></div></div>`;
  html += `</div>`;

  // Action buttons
  html += `<div class="osint-actions">`;
  html += `<button class="osint-action-btn" data-username="${data.username}" data-action="copy">📋 Copy Info</button>`;
  html += `<button class="osint-action-btn" data-username="${data.username}" data-action="profile">🔗 Open Profile</button>`;
  html += `<button class="osint-action-btn" data-username="${data.username}" data-action="snapcode">🖼️ Snapcode</button>`;
  html += `</div>`;

  html += `</div>`;
  container.innerHTML = html;

  // Bind action buttons
  container.querySelectorAll(".osint-action-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      const user = btn.dataset.username;

      if (action === "copy") {
        const info = JSON.stringify(data, null, 2);
        try {
          await navigator.clipboard.writeText(info);
          showToast("Info copied to clipboard");
        } catch {
          showToast("Failed to copy");
        }
      } else if (action === "profile") {
        browserAPI.tabs.create({ url: `https://snapchat.com/add/${user}` });
      } else if (action === "snapcode") {
        browserAPI.tabs.create({ url: `https://app.snapchat.com/web/deeplink/snapcode?username=${encodeURIComponent(user)}&type=SVG` });
      }
    });
  });
}

/**
 * Show loading state in OSINT results
 */
function showOSINTLoading() {
  const container = document.getElementById("osintResults");
  container.innerHTML = `
    <div class="osint-loader">
      <div class="osint-spinner"></div>
      <span>Searching...</span>
    </div>`;
}

/**
 * Show error state in OSINT results
 */
function showOSINTError(message) {
  const container = document.getElementById("osintResults");
  container.innerHTML = `
    <div class="osint-error">
      ${message || "Search failed. Make sure you're on snapchat.com for full OSINT features."}
    </div>`;
}

/**
 * Load and render OSINT search history
 */
async function loadOSINTHistory() {
  const history = await getOSINTHistory();
  const container = document.getElementById("osintHistory");

  if (!history || history.length === 0) {
    container.innerHTML = `
      <div class="osint-empty">
        <div class="icon">📋</div>
        <p>No search history yet</p>
      </div>`;
    return;
  }

  let html = "";
  history.slice(0, 10).forEach((item) => {
    html += `
      <div class="osint-history-item" data-username="${item.username}">
        <span class="username">@${item.username}</span>
        <span class="time">${formatTime(item.timestamp)}</span>
      </div>`;
  });
  container.innerHTML = html;

  // Bind history items
  container.querySelectorAll(".osint-history-item").forEach((el) => {
    el.addEventListener("click", () => {
      const username = el.dataset.username;
      document.getElementById("osintUsername").value = username;
      performOSINTSearch(username);
    });
  });
}

/**
 * Main OSINT search function
 */
async function performOSINTSearch(username) {
  if (!username || username.trim().length < 2) {
    showToast("Enter a valid username (min 2 chars)");
    return;
  }

  username = username.trim().toLowerCase().replace("@", "");

  showOSINTLoading();

  try {
    const result = await lookupUsername(username);
    renderOSINTResult(result);
    await addOSINTHistory(username, result);
    await loadOSINTHistory();
  } catch (error) {
    showOSINTError("Search failed. Make sure you're on snapchat.com for full OSINT features.");
  }
}

/**
 * Initialize OSINT event listeners
 */
function initOSINT() {
  const searchInput = document.getElementById("osintUsername");
  const searchBtn = document.getElementById("osintSearchBtn");

  // Search button
  searchBtn.addEventListener("click", () => {
    performOSINTSearch(searchInput.value);
  });

  // Enter key in search input
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      performOSINTSearch(searchInput.value);
    }
  });

  // Quick tool: Check Availability
  document.getElementById("osintCheckAvail").addEventListener("click", async () => {
    const username = searchInput.value.trim().toLowerCase().replace("@", "");
    if (!username) {
      showToast("Enter a username first");
      return;
    }
    showOSINTLoading();
    try {
      const result = await checkAvailability(username);
      const container = document.getElementById("osintResults");
      if (result.available) {
        container.innerHTML = `
          <div class="osint-result-card">
            <div style="text-align:center;padding:10px;">
              <div style="font-size:32px;margin-bottom:8px;">✅</div>
              <h3 style="color:var(--success);">Username Available</h3>
              <p style="color:var(--text-secondary);font-size:12px;">@${username} is not taken on Snapchat</p>
            </div>
          </div>`;
      } else {
        container.innerHTML = `
          <div class="osint-result-card">
            <div style="text-align:center;padding:10px;">
              <div style="font-size:32px;margin-bottom:8px;">❌</div>
              <h3 style="color:var(--danger);">Username Taken</h3>
              <p style="color:var(--text-secondary);font-size:12px;">@${username} is already registered on Snapchat</p>
              <button class="osint-action-btn" style="margin-top:10px;" onclick="document.getElementById('osintSearchBtn').click()">View Details</button>
            </div>
          </div>`;
      }
    } catch {
      showOSINTError("Availability check failed. Try again on snapchat.com page.");
    }
  });

  // Quick tool: Profile Scanner
  document.getElementById("osintProfileScan").addEventListener("click", async () => {
    const username = searchInput.value.trim().toLowerCase().replace("@", "");
    if (!username) {
      showToast("Enter a username first");
      return;
    }
    performOSINTSearch(username);
  });

  // Quick tool: Story Viewer
  document.getElementById("osintStoryViewer").addEventListener("click", () => {
    const username = searchInput.value.trim().toLowerCase().replace("@", "");
    if (!username) {
      showToast("Enter a username first");
      return;
    }
    browserAPI.tabs.create({ url: `https://story.snapchat.com/s/${username}` });
  });

  // Quick tool: Snap Map
  document.getElementById("osintMapLookup").addEventListener("click", () => {
    browserAPI.tabs.create({ url: "https://map.snapchat.com" });
  });

  // Load history
  loadOSINTHistory();
}

// ========== Toast ==========
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

// ========== Browser Detection ==========
function detectBrowser() {
  const ua = navigator.userAgent;
  let name = "Unknown";
  if (ua.includes("Firefox")) name = "Firefox";
  else if (ua.includes("Edg/")) name = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) name = "Opera";
  else if (ua.includes("Brave")) name = "Brave";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) name = "Safari";
  else if (ua.includes("Chrome")) name = "Chrome";

  const el = document.getElementById("browserName");
  if (el) el.textContent = name;
}

// ========== Init ==========
document.addEventListener("DOMContentLoaded", async () => {
  detectBrowser();
  initTabs();
  initEventListeners();
  initOSINT();
  await loadSettings();
});
