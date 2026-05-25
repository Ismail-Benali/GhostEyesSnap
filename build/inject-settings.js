/**
 * GhostEyesSnap v3.0.0 - Enhanced Settings Overlay
 * Injected into Snapchat's page context with a professional tabbed UI
 * Includes OSINT intelligence tab for user investigations
 */

(function () {
  "use strict";

  // Prevent double injection
  if (window.__GhostEyesSnapSettingsLoaded) return;
  window.__GhostEyesSnapSettingsLoaded = true;

  // ========== Configuration ==========
  const SETTINGS_CONFIG = {
    // Privacy & Detection group
    ALLOW_SCREENSHOT: { group: "privacy", icon: "📸", label: "Screenshot Bypass", desc: "Bypass Snapchat's screenshot detection", type: "toggle", default: true },
    ALWAYS_PRESENT: { group: "privacy", icon: "👁️", label: "Always Present", desc: "Stay online without being detected as away", type: "toggle", default: true },
    PREVENT_CHAT_READ_RECEIPTS: { group: "privacy", icon: "💬", label: "Unread Chats", desc: "Prevent others from knowing you read their message", type: "toggle", default: false },
    PREVENT_STORY_READ_RECEIPTS: { group: "privacy", icon: "📖", label: "Story Anonymity", desc: "View stories without sending read receipts", type: "toggle", default: false },
    PREVENT_TYPING_NOTIFICATION: { group: "privacy", icon: "⌨️", label: "Hide Typing", desc: "Don't show typing indicator to others", type: "toggle", default: false },
    PREVENT_TYPING: { group: "privacy", icon: "🔕", label: "Block Typing Push", desc: "Block push notifications about typing", type: "toggle", default: false },

    // Media group
    SAVE_IMAGE: { group: "media", icon: "💾", label: "Save Media", desc: "Right-click to save images and videos", type: "toggle", default: true },
    UPLOAD_SNAPS: { group: "media", icon: "📤", label: "Upload as Snaps", desc: "Upload images as snap messages", type: "toggle", default: false },
    SNAP_AS_MOBILE: { group: "media", icon: "📱", label: "Send as Mobile", desc: "Snaps appear sent from mobile device", type: "toggle", default: false },
    UNLIMITED_FILE_SIZE: { group: "media", icon: "📦", label: "Unrestricted Files", desc: "Send media of any file size", type: "toggle", default: false },

    // Chat group
    SEND_UNSAVEABLE_MESSAGES: { group: "chat", icon: "🔒", label: "Unsaveable Messages", desc: "Send messages that cannot be saved", type: "toggle", default: false },
    SHOW_STREAKS: { group: "chat", icon: "🔥", label: "Show Streaks", desc: "Display streak counts", type: "toggle", default: true },
    HALF_SWIPE_NOTIFICATION: { group: "chat", icon: "👆", label: "Half-Swipe Alert", desc: "Get notified on half-swipe actions", type: "toggle", default: false },
    OPEN_CHAT_NOTIFICATION: { group: "chat", icon: "📂", label: "Open Chat Alert", desc: "Get notified when chats are opened", type: "toggle", default: false },
    CHAT_HANDLING: { group: "chat", icon: "⚙️", label: "Chat Mode", desc: "How to handle incoming messages", type: "radio", options: ["DEFAULT", "AUTO_SAVE", "UNREAD"], default: "DEFAULT" },

    // OSINT group
    OSINT_USERNAME_LOOKUP: { group: "osint", icon: "🔍", label: "Username Lookup", desc: "Search for Snapchat users", type: "toggle", default: true },
    OSINT_STORY_VIEWER: { group: "osint", icon: "📖", label: "Story Viewer", desc: "View public stories anonymously", type: "toggle", default: true },
    OSINT_PROFILE_SCAN: { group: "osint", icon: "👤", label: "Profile Scanner", desc: "Extract profile metadata", type: "toggle", default: true },
    OSINT_AVAILABILITY: { group: "osint", icon: "✅", label: "Availability Check", desc: "Check if usernames are available", type: "toggle", default: true },
    OSINT_SNAP_MAP: { group: "osint", icon: "📍", label: "Snap Map", desc: "Access Snap Map data", type: "toggle", default: true },
    OSINT_AUTO_LOG: { group: "osint", icon: "📋", label: "Auto-Log Searches", desc: "Save search history locally", type: "toggle", default: true },

    // Advanced group
    BITMOJI_PRESENCE: { group: "advanced", icon: "👻", label: "Bitmoji Mode", desc: "Control bitmoji appearance in chat", type: "radio", options: ["DEFAULT", "HIDE", "MOBILE"], default: "DEFAULT" },
    PRIVATE_STORIES: { group: "advanced", icon: "🔐", label: "Private Stories", desc: "Interact with private stories on web", type: "toggle", default: false },
    ALLOW_CROSS_TAB: { group: "advanced", icon: "🔀", label: "Multiple Tabs", desc: "Allow multiple Snapchat tabs simultaneously", type: "toggle", default: true },
    STEALTH_MODE: { group: "advanced", icon: "🥷", label: "Stealth Mode", desc: "Full privacy: no typing, no receipts, no presence", type: "toggle", default: false },
    ANTI_BLUR: { group: "advanced", icon: "👁️‍🗨️", label: "Anti-Blur", desc: "Remove blur when tab is unfocused", type: "toggle", default: false },
  };

  const GROUPS = {
    privacy: { label: "Privacy", icon: "🛡️", color: "#7c3aed" },
    media: { label: "Media", icon: "🖼️", color: "#22d3ee" },
    chat: { label: "Chat", icon: "💬", color: "#fbbf24" },
    osint: { label: "OSINT", icon: "🔍", color: "#f59e0b" },
    advanced: { label: "Advanced", icon: "⚡", color: "#f87171" },
  };

  // ========== Settings Storage ==========
  const STORAGE_PREFIX = "bs_";

  function getSettings() {
    try {
      const data = window.localStorage.getItem(STORAGE_PREFIX + "settings");
      if (data) {
        const parsed = JSON.parse(data);
        const defaults = {};
        Object.entries(SETTINGS_CONFIG).forEach(([key, cfg]) => {
          defaults[key] = cfg.default;
        });
        return { ...defaults, ...parsed };
      }
    } catch {}
    const defaults = {};
    Object.entries(SETTINGS_CONFIG).forEach(([key, cfg]) => {
      defaults[key] = cfg.default;
    });
    return defaults;
  }

  function saveSetting(key, value) {
    const settings = getSettings();
    settings[key] = value;
    window.localStorage.setItem(STORAGE_PREFIX + "settings", JSON.stringify(settings));

    // Dispatch custom event for the main script to pick up
    window.dispatchEvent(
      new CustomEvent("ghosteyessnap:setting:update", {
        detail: { key, value },
      })
    );
  }

  // ========== UI Builder ==========
  let isOpen = false;
  let activeTab = "privacy";
  let panelEl = null;
  let fabEl = null;

  function createStyles() {
    const style = document.createElement("style");
    style.id = "ghosteyessnap-styles";
    style.textContent = `
      @keyframes ges-fab-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.4); }
        50% { box-shadow: 0 0 0 10px rgba(124, 58, 237, 0); }
      }
      @keyframes ges-slide-in {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes ges-slide-out {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
      @keyframes ges-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes ges-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      #ghosteyessnap-fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 52px;
        height: 52px;
        border-radius: 16px;
        border: 2px solid rgba(124, 58, 237, 0.5);
        background: linear-gradient(135deg, #1a1128, #2d1f45);
        color: #a78bfa;
        font-size: 24px;
        cursor: pointer;
        z-index: 999998;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s;
        animation: ges-fab-pulse 3s infinite;
        box-shadow: 0 4px 20px rgba(124, 58, 237, 0.3);
      }
      #ghosteyessnap-fab:hover {
        transform: scale(1.1);
        border-color: #a78bfa;
        box-shadow: 0 4px 30px rgba(124, 58, 237, 0.5);
      }

      #ghosteyessnap-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 420px;
        height: 100vh;
        background: #0f0a1a;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #f1f0f5;
        overflow-y: auto;
        animation: ges-slide-in 0.3s ease-out;
        box-shadow: -4px 0 30px rgba(0,0,0,0.5);
        border-left: 1px solid rgba(124, 58, 237, 0.15);
      }
      #ghosteyessnap-panel.closing {
        animation: ges-slide-out 0.25s ease-in forwards;
      }
      #ghosteyessnap-panel::-webkit-scrollbar { width: 4px; }
      #ghosteyessnap-panel::-webkit-scrollbar-track { background: transparent; }
      #ghosteyessnap-panel::-webkit-scrollbar-thumb { background: #7c3aed; border-radius: 4px; }

      .ges-header {
        background: linear-gradient(135deg, #1a1128, #2d1f45);
        padding: 20px;
        border-bottom: 1px solid rgba(124, 58, 237, 0.15);
        display: flex;
        align-items: center;
        gap: 14px;
        position: relative;
      }
      .ges-header::before {
        content: '';
        position: absolute;
        top: -50%; left: -50%;
        width: 200%; height: 200%;
        background: radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 60%);
        animation: ges-fade-in 2s;
      }
      .ges-header h2 {
        font-size: 18px;
        font-weight: 700;
        background: linear-gradient(135deg, #a78bfa, #22d3ee);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0;
      }
      .ges-header .ges-version {
        font-size: 11px;
        color: #6b5f80;
        margin-top: 2px;
      }
      .ges-close {
        margin-left: auto;
        width: 32px; height: 32px;
        border-radius: 8px;
        border: 1px solid rgba(124, 58, 237, 0.2);
        background: rgba(35, 24, 56, 0.8);
        color: #a8a0b8;
        cursor: pointer;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .ges-close:hover { background: #7c3aed; color: white; }

      .ges-tabs {
        display: flex;
        background: #1a1128;
        border-bottom: 1px solid rgba(124, 58, 237, 0.15);
        overflow-x: auto;
      }
      .ges-tab {
        flex: 1;
        min-width: 0;
        padding: 10px 6px;
        font-size: 10px;
        font-weight: 700;
        color: #6b5f80;
        background: none;
        border: none;
        cursor: pointer;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        position: relative;
        transition: color 0.2s;
        white-space: nowrap;
      }
      .ges-tab:hover { color: #a8a0b8; }
      .ges-tab.active { color: #a78bfa; }
      .ges-tab.active::after {
        content: '';
        position: absolute;
        bottom: 0; left: 20%; width: 60%; height: 2px;
        background: linear-gradient(90deg, #7c3aed, #22d3ee);
        border-radius: 2px;
      }
      .ges-tab-icon { display: block; font-size: 14px; margin-bottom: 2px; }

      .ges-tab-content { display: none; padding: 16px; }
      .ges-tab-content.active { display: block; }

      .ges-section-title {
        font-size: 10px;
        font-weight: 700;
        color: #6b5f80;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin: 16px 0 10px 4px;
      }
      .ges-section-title:first-child { margin-top: 0; }

      .ges-setting {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        background: #231838;
        border-radius: 10px;
        margin-bottom: 6px;
        border: 1px solid transparent;
        transition: all 0.2s;
        cursor: pointer;
      }
      .ges-setting:hover { border-color: rgba(124, 58, 237, 0.15); background: #2d1f45; }

      .ges-setting-info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
      .ges-setting-icon {
        width: 32px; height: 32px;
        border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        font-size: 16px; flex-shrink: 0;
      }
      .ges-setting-icon.privacy { background: rgba(124, 58, 237, 0.15); }
      .ges-setting-icon.media { background: rgba(34, 211, 238, 0.15); }
      .ges-setting-icon.chat { background: rgba(251, 191, 36, 0.15); }
      .ges-setting-icon.osint { background: rgba(245, 158, 11, 0.15); }
      .ges-setting-icon.advanced { background: rgba(248, 113, 113, 0.15); }

      .ges-setting-text h3 { font-size: 13px; font-weight: 600; color: #f1f0f5; margin: 0; }
      .ges-setting-text p { font-size: 11px; color: #6b5f80; margin: 2px 0 0 0; }

      .ges-toggle {
        position: relative; width: 40px; height: 22px; flex-shrink: 0;
      }
      .ges-toggle input { opacity: 0; width: 0; height: 0; }
      .ges-toggle-track {
        position: absolute; cursor: pointer;
        top: 0; left: 0; right: 0; bottom: 0;
        background: #1a1128;
        border: 1px solid rgba(124, 58, 237, 0.15);
        border-radius: 22px;
        transition: 0.3s;
      }
      .ges-toggle-track::before {
        content: '';
        position: absolute;
        height: 16px; width: 16px;
        left: 2px; bottom: 2px;
        background: #6b5f80;
        border-radius: 50%;
        transition: 0.3s;
      }
      .ges-toggle input:checked + .ges-toggle-track {
        background: #7c3aed;
        border-color: #7c3aed;
        box-shadow: 0 0 12px rgba(124, 58, 237, 0.3);
      }
      .ges-toggle input:checked + .ges-toggle-track::before {
        transform: translateX(18px);
        background: white;
      }

      .ges-radio-group {
        display: flex; gap: 4px;
        background: #1a1128;
        border-radius: 8px;
        padding: 3px;
        flex-shrink: 0;
      }
      .ges-radio-opt {
        padding: 4px 10px;
        font-size: 10px;
        font-weight: 600;
        color: #6b5f80;
        border: none;
        background: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
      }
      .ges-radio-opt:hover { color: #a8a0b8; }
      .ges-radio-opt.active {
        background: #7c3aed;
        color: white;
        box-shadow: 0 0 8px rgba(124, 58, 237, 0.3);
      }

      /* OSINT specific styles */
      .ges-osint-search {
        display: flex; gap: 8px; margin-bottom: 12px;
      }
      .ges-osint-search input {
        flex: 1; padding: 10px 14px;
        background: #231838; border: 1px solid rgba(124, 58, 237, 0.15);
        border-radius: 10px; color: #f1f0f5; font-size: 13px; outline: none;
        transition: border-color 0.2s;
      }
      .ges-osint-search input::placeholder { color: #6b5f80; }
      .ges-osint-search input:focus { border-color: #f59e0b; box-shadow: 0 0 12px rgba(245,158,11,0.15); }
      .ges-osint-search-btn {
        padding: 10px 16px; background: linear-gradient(135deg, #f59e0b, #d97706);
        border: none; border-radius: 10px; color: #000; font-size: 13px;
        font-weight: 700; cursor: pointer; transition: all 0.2s; white-space: nowrap;
      }
      .ges-osint-search-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(245,158,11,0.3); }
      .ges-osint-search-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

      .ges-osint-result {
        background: #231838; border-radius: 12px; padding: 14px;
        margin-bottom: 10px; border: 1px solid rgba(124,58,237,0.15);
        animation: ges-fade-in 0.3s ease-out;
      }
      .ges-osint-profile { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
      .ges-osint-avatar {
        width: 48px; height: 48px; border-radius: 50%;
        background: linear-gradient(135deg, #7c3aed, #22d3ee);
        display: flex; align-items: center; justify-content: center;
        font-size: 22px; flex-shrink: 0; border: 2px solid #f59e0b;
      }
      .ges-osint-profile-info h3 { font-size: 14px; font-weight: 700; color: #f1f0f5; margin: 0; }
      .ges-osint-profile-info p { font-size: 11px; color: #a8a0b8; margin: 2px 0 0 0; }
      .ges-osint-badge {
        display: inline-block; padding: 2px 8px; border-radius: 4px;
        font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      }
      .ges-osint-badge.available { background: rgba(52,211,153,0.15); color: #34d399; border: 1px solid rgba(52,211,153,0.2); }
      .ges-osint-badge.taken { background: rgba(248,113,113,0.15); color: #f87171; border: 1px solid rgba(248,113,113,0.2); }
      .ges-osint-badge.verified { background: rgba(34,211,238,0.15); color: #22d3ee; border: 1px solid rgba(34,211,238,0.2); }

      .ges-osint-details { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .ges-osint-detail { background: #1a1128; border-radius: 8px; padding: 8px 10px; }
      .ges-osint-detail .label { font-size: 9px; font-weight: 700; color: #6b5f80; text-transform: uppercase; letter-spacing: 0.5px; }
      .ges-osint-detail .value { font-size: 12px; font-weight: 600; color: #f1f0f5; margin-top: 2px; }

      .ges-osint-actions { display: flex; gap: 6px; margin-top: 10px; }
      .ges-osint-action {
        flex: 1; padding: 6px 10px; border-radius: 8px;
        border: 1px solid rgba(124,58,237,0.15); background: #1a1128;
        color: #a8a0b8; font-size: 10px; font-weight: 600;
        cursor: pointer; transition: all 0.2s; text-align: center;
      }
      .ges-osint-action:hover { background: #7c3aed; border-color: #7c3aed; color: white; }

      .ges-osint-quick { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; }
      .ges-osint-quick-btn {
        padding: 10px; background: #231838; border: 1px solid rgba(124,58,237,0.15);
        border-radius: 10px; cursor: pointer; transition: all 0.2s; text-align: center;
      }
      .ges-osint-quick-btn:hover { border-color: #f59e0b; background: #2d1f45; }
      .ges-osint-quick-btn .icon { font-size: 20px; margin-bottom: 4px; }
      .ges-osint-quick-btn .text { font-size: 10px; font-weight: 600; color: #a8a0b8; }

      .ges-osint-loader {
        display: flex; align-items: center; justify-content: center;
        padding: 30px; color: #f59e0b;
      }
      .ges-osint-spinner {
        width: 24px; height: 24px; border: 3px solid rgba(124,58,237,0.15);
        border-top: 3px solid #f59e0b; border-radius: 50%;
        animation: ges-spin 1s linear infinite; margin-right: 10px;
      }
      .ges-osint-empty { text-align: center; padding: 20px; color: #6b5f80; }
      .ges-osint-empty .icon { font-size: 32px; margin-bottom: 8px; }
      .ges-osint-empty p { font-size: 12px; }

      .ges-osint-error {
        background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.2);
        border-radius: 10px; padding: 12px; color: #f87171; font-size: 12px; text-align: center;
      }

      .ges-osint-history-title {
        font-size: 10px; font-weight: 700; color: #6b5f80;
        text-transform: uppercase; letter-spacing: 1px; margin: 14px 0 8px;
      }
      .ges-osint-history-item {
        display: flex; align-items: center; justify-content: space-between;
        padding: 6px 10px; background: #231838; border-radius: 8px;
        margin-bottom: 4px; cursor: pointer; transition: all 0.2s;
      }
      .ges-osint-history-item:hover { background: #2d1f45; }
      .ges-osint-history-item .username { font-size: 12px; font-weight: 600; color: #f1f0f5; }
      .ges-osint-history-item .time { font-size: 10px; color: #6b5f80; }

      .ges-footer {
        padding: 16px;
        border-top: 1px solid rgba(124, 58, 237, 0.15);
        background: #1a1128;
        text-align: center;
      }
      .ges-footer-text { font-size: 11px; color: #6b5f80; }
      .ges-footer-text a { color: #a78bfa; text-decoration: none; }
      .ges-footer-text a:hover { text-decoration: underline; }

      .ges-toast {
        position: fixed;
        bottom: 80px; right: 24px;
        background: #7c3aed;
        color: white;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 9999999;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s;
        pointer-events: none;
        box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4);
      }
      .ges-toast.show {
        opacity: 1;
        transform: translateY(0);
      }
    `;
    document.head.appendChild(style);
  }

  function createFAB() {
    fabEl = document.createElement("button");
    fabEl.id = "ghosteyessnap-fab";
    fabEl.innerHTML = "👻";
    fabEl.title = "GhostEyesSnap Settings (Ctrl+Shift+G)";
    fabEl.addEventListener("click", togglePanel);
    document.body.appendChild(fabEl);
  }

  function createPanel() {
    panelEl = document.createElement("div");
    panelEl.id = "ghosteyessnap-panel";

    const settings = getSettings();

    // Build tabs
    let tabsHTML = '<div class="ges-tabs">';
    Object.entries(GROUPS).forEach(([key, group]) => {
      tabsHTML += `<button class="ges-tab ${key === activeTab ? 'active' : ''}" data-ges-tab="${key}"><span class="ges-tab-icon">${group.icon}</span>${group.label}</button>`;
    });
    tabsHTML += '</div>';

    // Build tab contents
    let contentsHTML = '';
    Object.entries(GROUPS).forEach(([groupKey, group]) => {
      const groupSettings = Object.entries(SETTINGS_CONFIG).filter(([, cfg]) => cfg.group === groupKey);

      if (groupKey === "osint") {
        // Special OSINT tab with search UI
        contentsHTML += `<div class="ges-tab-content ${groupKey === activeTab ? 'active' : ''}" data-ges-content="${groupKey}">`;
        contentsHTML += `
          <div class="ges-section-title">Username Lookup</div>
          <div class="ges-osint-search">
            <input type="text" id="ges-osint-input" placeholder="Enter Snapchat username..." autocomplete="off" spellcheck="false">
            <button class="ges-osint-search-btn" id="ges-osint-search-btn">Search</button>
          </div>
          <div id="ges-osint-results"></div>

          <div class="ges-section-title">Quick Tools</div>
          <div class="ges-osint-quick">
            <div class="ges-osint-quick-btn" id="ges-osint-avail"><div class="icon">✅</div><div class="text">Check Availability</div></div>
            <div class="ges-osint-quick-btn" id="ges-osint-profile"><div class="icon">👤</div><div class="text">Profile Scanner</div></div>
            <div class="ges-osint-quick-btn" id="ges-osint-story"><div class="icon">📖</div><div class="text">Story Viewer</div></div>
            <div class="ges-osint-quick-btn" id="ges-osint-map"><div class="icon">📍</div><div class="text">Snap Map</div></div>
          </div>

          <div class="ges-section-title">OSINT Settings</div>
        `;
        groupSettings.forEach(([key, cfg]) => {
          const value = settings[key] !== undefined ? settings[key] : cfg.default;
          contentsHTML += `<div class="ges-setting" data-ges-key="${key}">`;
          contentsHTML += `<div class="ges-setting-info">`;
          contentsHTML += `<div class="ges-setting-icon ${cfg.group}">${cfg.icon}</div>`;
          contentsHTML += `<div class="ges-setting-text"><h3>${cfg.label}</h3><p>${cfg.desc}</p></div>`;
          contentsHTML += `</div>`;
          contentsHTML += `<label class="ges-toggle">`;
          contentsHTML += `<input type="checkbox" data-ges-toggle="${key}" ${value ? 'checked' : ''}>`;
          contentsHTML += `<span class="ges-toggle-track"></span>`;
          contentsHTML += `</label>`;
          contentsHTML += `</div>`;
        });
        contentsHTML += '</div>';
      } else {
        // Regular settings tabs
        contentsHTML += `<div class="ges-tab-content ${groupKey === activeTab ? 'active' : ''}" data-ges-content="${groupKey}">`;

        groupSettings.forEach(([key, cfg]) => {
          const value = settings[key] !== undefined ? settings[key] : cfg.default;

          contentsHTML += `<div class="ges-setting" data-ges-key="${key}">`;
          contentsHTML += `<div class="ges-setting-info">`;
          contentsHTML += `<div class="ges-setting-icon ${cfg.group}">${cfg.icon}</div>`;
          contentsHTML += `<div class="ges-setting-text"><h3>${cfg.label}</h3><p>${cfg.desc}</p></div>`;
          contentsHTML += `</div>`;

          if (cfg.type === "toggle") {
            contentsHTML += `<label class="ges-toggle">`;
            contentsHTML += `<input type="checkbox" data-ges-toggle="${key}" ${value ? 'checked' : ''}>`;
            contentsHTML += `<span class="ges-toggle-track"></span>`;
            contentsHTML += `</label>`;
          } else if (cfg.type === "radio") {
            contentsHTML += `<div class="ges-radio-group" data-ges-radio="${key}">`;
            cfg.options.forEach((opt) => {
              contentsHTML += `<button class="ges-radio-opt ${opt === value ? 'active' : ''}" data-ges-value="${opt}">${opt.replace('_', ' ')}</button>`;
            });
            contentsHTML += `</div>`;
          }

          contentsHTML += `</div>`;
        });

        contentsHTML += '</div>';
      }
    });

    panelEl.innerHTML = `
      <div class="ges-header">
        <span style="font-size:28px;position:relative;">👻</span>
        <div>
          <h2>GhostEyesSnap</h2>
          <div class="ges-version">v3.0.0 — OSINT Enhanced</div>
        </div>
        <button class="ges-close" id="ges-close-btn">✕</button>
      </div>
      ${tabsHTML}
      ${contentsHTML}
      <div class="ges-footer">
        <div class="ges-footer-text">
          <a href="https://github.com/Ismail-Benali/GhostEyesSnap" target="_blank">GhostEyesSnap</a> • Made with 💜
        </div>
      </div>
    `;

    document.body.appendChild(panelEl);
    bindPanelEvents();
    bindOSINTEvents();
  }

  function bindPanelEvents() {
    // Close button
    panelEl.querySelector("#ges-close-btn").addEventListener("click", closePanel);

    // Tab navigation
    panelEl.querySelectorAll(".ges-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        activeTab = tab.dataset.gesTab;
        panelEl.querySelectorAll(".ges-tab").forEach((t) => t.classList.remove("active"));
        panelEl.querySelectorAll(".ges-tab-content").forEach((c) => c.classList.remove("active"));
        tab.classList.add("active");
        panelEl.querySelector(`[data-ges-content="${activeTab}"]`).classList.add("active");
      });
    });

    // Toggle switches
    panelEl.querySelectorAll("[data-ges-toggle]").forEach((input) => {
      input.addEventListener("change", (e) => {
        e.stopPropagation();
        const key = input.dataset.gesToggle;
        saveSetting(key, input.checked);

        // Stealth mode auto-enable privacy features
        if (key === "STEALTH_MODE" && input.checked) {
          const stealthKeys = ["PREVENT_TYPING_NOTIFICATION", "PREVENT_CHAT_READ_RECEIPTS", "PREVENT_STORY_READ_RECEIPTS", "ALWAYS_PRESENT", "PREVENT_TYPING"];
          stealthKeys.forEach((sk) => {
            saveSetting(sk, true);
            const toggle = panelEl.querySelector(`[data-ges-toggle="${sk}"]`);
            if (toggle) toggle.checked = true;
          });
        }

        showToast(`${SETTINGS_CONFIG[key]?.label || key} ${input.checked ? "enabled" : "disabled"}`);
      });
    });

    // Radio groups
    panelEl.querySelectorAll("[data-ges-radio]").forEach((group) => {
      group.querySelectorAll(".ges-radio-opt").forEach((opt) => {
        opt.addEventListener("click", (e) => {
          e.stopPropagation();
          const key = group.dataset.gesRadio;
          const value = opt.dataset.gesValue;
          saveSetting(key, value);
          group.querySelectorAll(".ges-radio-opt").forEach((o) => o.classList.remove("active"));
          opt.classList.add("active");
          showToast(`${SETTINGS_CONFIG[key]?.label || key}: ${value}`);
        });
      });
    });

    // Click on setting row to toggle
    panelEl.querySelectorAll(".ges-setting").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.target.closest(".ges-radio-group") || e.target.closest(".ges-toggle") || e.target.closest(".ges-osint-quick-btn")) return;
        const toggle = item.querySelector("[data-ges-toggle]");
        if (toggle) {
          toggle.checked = !toggle.checked;
          toggle.dispatchEvent(new Event("change"));
        }
      });
    });
  }

  // ========== OSINT Functions (Page Context) ==========
  let osintRequestId = 0;
  const osintPendingRequests = new Map();

  // Listen for OSINT responses
  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== "GhostEyesSnap-OSINT") return;

    const { requestId, success, data, error } = event.data;
    if (requestId && osintPendingRequests.has(requestId)) {
      const resolve = osintPendingRequests.get(requestId);
      osintPendingRequests.delete(requestId);
      resolve({ success, data, error });
    }
  });

  function sendOSINTRequest(type, payload) {
    return new Promise((resolve) => {
      const requestId = "ges_osint_" + (++osintRequestId) + "_" + Date.now();
      osintPendingRequests.set(requestId, resolve);

      setTimeout(() => {
        if (osintPendingRequests.has(requestId)) {
          osintPendingRequests.delete(requestId);
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

  function bindOSINTEvents() {
    const input = panelEl.querySelector("#ges-osint-input");
    const searchBtn = panelEl.querySelector("#ges-osint-search-btn");
    const resultsContainer = panelEl.querySelector("#ges-osint-results");

    // Search function
    async function performSearch(username) {
      if (!username || username.trim().length < 2) {
        showToast("Enter a valid username (min 2 chars)");
        return;
      }

      username = username.trim().toLowerCase().replace("@", "");
      resultsContainer.innerHTML = `
        <div class="ges-osint-loader">
          <div class="ges-osint-spinner"></div>
          <span>Searching @${username}...</span>
        </div>`;

      try {
        const result = await sendOSINTRequest("OSINT_LOOKUP", { username });
        if (result.success && result.data) {
          renderOSINTResult(result.data, username, resultsContainer);
        } else {
          resultsContainer.innerHTML = `
            <div class="ges-osint-error">
              Search failed. ${result.error || "Try again while on snapchat.com."}
            </div>`;
        }
      } catch (error) {
        resultsContainer.innerHTML = `
          <div class="ges-osint-error">
            Search error. Make sure the OSINT module is loaded.
          </div>`;
      }
    }

    // Search button
    searchBtn.addEventListener("click", () => performSearch(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") performSearch(input.value);
    });

    // Quick tools
    panelEl.querySelector("#ges-osint-avail").addEventListener("click", async () => {
      const username = input.value.trim().toLowerCase().replace("@", "");
      if (!username) { showToast("Enter a username first"); return; }

      resultsContainer.innerHTML = `<div class="ges-osint-loader"><div class="ges-osint-spinner"></div><span>Checking...</span></div>`;

      const result = await sendOSINTRequest("OSINT_AVAILABILITY", { username });
      if (result.success && result.data) {
        const avail = result.data.available;
        resultsContainer.innerHTML = `
          <div class="ges-osint-result" style="text-align:center;padding:14px;">
            <div style="font-size:32px;margin-bottom:8px;">${avail ? '✅' : '❌'}</div>
            <h3 style="color:${avail ? '#34d399' : '#f87171'};">Username ${avail ? 'Available' : 'Taken'}</h3>
            <p style="color:#a8a0b8;font-size:12px;">@${username} is ${avail ? 'not registered' : 'already registered'} on Snapchat</p>
          </div>`;
      }
    });

    panelEl.querySelector("#ges-osint-profile").addEventListener("click", () => performSearch(input.value));

    panelEl.querySelector("#ges-osint-story").addEventListener("click", () => {
      const username = input.value.trim().toLowerCase().replace("@", "");
      if (!username) { showToast("Enter a username first"); return; }
      window.open(`https://story.snapchat.com/s/${username}`, "_blank");
    });

    panelEl.querySelector("#ges-osint-map").addEventListener("click", () => {
      window.open("https://map.snapchat.com", "_blank");
    });
  }

  function renderOSINTResult(data, username, container) {
    let html = `<div class="ges-osint-result">`;

    // Profile header
    html += `<div class="ges-osint-profile">`;
    if (data.bitmojiUrl) {
      html += `<div class="ges-osint-avatar"><img src="${data.bitmojiUrl}" style="width:100%;border-radius:50%;"></div>`;
    } else {
      html += `<div class="ges-osint-avatar">👻</div>`;
    }
    html += `<div class="ges-osint-profile-info">`;
    html += `<h3>${data.displayName || username}</h3>`;
    html += `<p>@${username}</p>`;
    if (data.isVerified) html += ` <span class="ges-osint-badge verified">Verified</span>`;
    if (data.available) {
      html += ` <span class="ges-osint-badge available">Available</span>`;
    } else if (data.exists) {
      html += ` <span class="ges-osint-badge taken">Taken</span>`;
    }
    html += `</div></div>`;

    // Details grid
    html += `<div class="ges-osint-details">`;
    if (data.snapScore !== null && data.snapScore !== undefined) {
      html += `<div class="ges-osint-detail"><div class="label">Snap Score</div><div class="value">${data.snapScore}</div></div>`;
    }
    html += `<div class="ges-osint-detail"><div class="label">Public Story</div><div class="value">${data.hasPublicStory ? 'Yes' : 'No'}</div></div>`;
    if (data.bio) {
      html += `<div class="ges-osint-detail" style="grid-column:span 2;"><div class="label">Bio</div><div class="value">${data.bio}</div></div>`;
    }
    html += `<div class="ges-osint-detail"><div class="label">Profile</div><div class="value"><a href="https://snapchat.com/add/${username}" target="_blank" style="color:#22d3ee;">Open</a></div></div>`;
    html += `<div class="ges-osint-detail"><div class="label">Snapcode</div><div class="value"><a href="${data.snapcodeUrl || 'https://app.snapchat.com/web/deeplink/snapcode?username=' + encodeURIComponent(username) + '&type=SVG'}" target="_blank" style="color:#22d3ee;">View</a></div></div>`;
    html += `</div>`;

    // Action buttons
    html += `<div class="ges-osint-actions">`;
    html += `<button class="ges-osint-action" data-action="copy" data-data='${JSON.stringify(data).replace(/'/g, "&#39;")}'>📋 Copy</button>`;
    html += `<button class="ges-osint-action" data-action="profile" data-username="${username}">🔗 Profile</button>`;
    html += `<button class="ges-osint-action" data-action="snapcode" data-username="${username}">🖼️ Snapcode</button>`;
    html += `</div>`;

    html += `</div>`;
    container.innerHTML = html;

    // Bind action buttons
    container.querySelectorAll(".ges-osint-action").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "copy") {
          try {
            const d = JSON.parse(btn.dataset.data);
            navigator.clipboard.writeText(JSON.stringify(d, null, 2));
            showToast("Info copied!");
          } catch {
            showToast("Copy failed");
          }
        } else if (action === "profile") {
          window.open(`https://snapchat.com/add/${btn.dataset.username}`, "_blank");
        } else if (action === "snapcode") {
          window.open(`https://app.snapchat.com/web/deeplink/snapcode?username=${encodeURIComponent(btn.dataset.username)}&type=SVG`, "_blank");
        }
      });
    });
  }

  // ========== Toast ==========
  let toastEl = null;
  let toastTimer = null;

  function showToast(message) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "ges-toast";
      document.body.appendChild(toastEl);
    }
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.add("show");
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2000);
  }

  // ========== Panel Toggle ==========
  function togglePanel() {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function openPanel() {
    if (!panelEl) {
      createPanel();
    } else {
      panelEl.style.display = "block";
      panelEl.classList.remove("closing");
    }
    if (fabEl) fabEl.style.display = "none";
    isOpen = true;
  }

  function closePanel() {
    if (panelEl) {
      panelEl.classList.add("closing");
      setTimeout(() => {
        panelEl.style.display = "none";
        panelEl.classList.remove("closing");
      }, 250);
    }
    if (fabEl) fabEl.style.display = "flex";
    isOpen = false;
  }

  // ========== Keyboard shortcut ==========
  document.addEventListener("keydown", (e) => {
    // Ctrl+Shift+G to toggle settings
    if (e.ctrlKey && e.shiftKey && e.key === "G") {
      e.preventDefault();
      togglePanel();
    }
    // Escape to close
    if (e.key === "Escape" && isOpen) {
      closePanel();
    }
  });

  // ========== Listen for setting updates from popup ==========
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== "GhostEyesSnap-CS") return;
    if (event.data.type !== "SETTING_UPDATE_FROM_POPUP") return;

    const { key, value, allSettings } = event.data;
    if (!panelEl) return;

    // Update toggle
    const toggle = panelEl.querySelector(`[data-ges-toggle="${key}"]`);
    if (toggle) toggle.checked = !!value;

    // Update radio group
    const radioGroup = panelEl.querySelector(`[data-ges-radio="${key}"]`);
    if (radioGroup) {
      radioGroup.querySelectorAll(".ges-radio-opt").forEach((opt) => {
        opt.classList.toggle("active", opt.dataset.gesValue === value);
      });
    }

    showToast(`${key} ${value ? "enabled" : "disabled"}`);
  });

  // ========== Initialize ==========
  function init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initAfterLoad);
    } else {
      initAfterLoad();
    }
  }

  function initAfterLoad() {
    setTimeout(() => {
      createStyles();
      createFAB();
      console.log("[GhostEyesSnap] Enhanced settings overlay loaded v3.0.0 (Ctrl+Shift+G to toggle)");
    }, 2000);
  }

  init();
})();
