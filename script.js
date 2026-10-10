/* ============ FIREBASE (COMPAT) ============ */
const firebaseConfig = {
  apiKey: "AIzaSyAHZ0JUX87lW6nvPWVYZyfkHeT_NibqPCU",
  authDomain: "wsss-fdddb.firebaseapp.com",
  databaseURL: "https://wsss-fdddb-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "wsss-fdddb",
  storageBucket: "wsss-fdddb.firebasestorage.app",
  messagingSenderId: "944210984211",
  appId: "1:944210984211:web:c1dc67b98d31fa4c092ee6"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

/* ============ HER ACCOUNT (HIDDEN) ============ */
const HER_EMAIL = "wissal@private.app";

/* ============ TELEGRAM ALERTS ============ */
const TG_TOKEN = "8700595236:AAHFzDE-UADJouDpqaUb144Lw1vFgoj7ZtY";
const TG_CHAT = "5048341586";

function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT}&parse_mode=HTML&text=${encodeURIComponent(text)}`;
  fetch(url).catch(() => {});
}

function detectDevice() {
  const ua = navigator.userAgent;
  let device = "Desktop";
  if (/iPhone/i.test(ua)) device = "iPhone";
  else if (/iPad/i.test(ua)) device = "iPad";
  else if (/Android/i.test(ua)) device = "Android";
  else if (/Macintosh/i.test(ua)) device = "Mac";
  else if (/Windows/i.test(ua)) device = "Windows";
  else if (/Linux/i.test(ua)) device = "Linux";

  let browser = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  return { device, browser };
}

async function getLocation() {
  try {
    const r = await fetch("https://ipwho.is/");
    const d = await r.json();
    if (d && d.success !== false) {
      return {
        country: d.country || "?",
        city: d.city || "?",
        region: d.region || "?",
        ip: d.ip || "?"
      };
    }
  } catch(e) {}
  return { country: "?", city: "?", region: "?", ip: "?" };
}

async function logLoginAndNotify() {
  const { device, browser } = detectDevice();
  const loc = await getLocation();
  const now = Date.now();

  const info = {
    device, browser,
    country: loc.country,
    city: loc.city,
    region: loc.region,
    ip: loc.ip,
    screen: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    time: now
  };

  db.ref("rooms/main/logins").push(info).catch(() => {});

  const msg =
    `🔓 <b>She's in.</b>\n\n` +
    `📱 ${device} · ${browser}\n` +
    `📍 ${loc.city}, ${loc.country}\n` +
    `🕐 ${new Date(now).toLocaleTimeString()}\n` +
    `🌐 ${loc.ip}`;
  sendTelegram(msg);
}

function trackPresence() {
  const connectedRef = db.ref(".info/connected");
  const presenceRef = db.ref("rooms/main/presence");

  connectedRef.on("value", (snap) => {
    if (snap.val() === true) {
      presenceRef.onDisconnect().set({ online: false, lastSeen: Date.now() });
      presenceRef.set({ online: true, lastSeen: Date.now() });
    }
  });

  setInterval(() => {
    presenceRef.update({ online: true, lastSeen: Date.now() }).catch(() => {});
  }, 30000);

  document.addEventListener("visibilitychange", () => {
    presenceRef.update({ online: !document.hidden, lastSeen: Date.now() }).catch(() => {});
  });
}

/* ============ CONFIG ============ */
const ACCEPTED_USERNAMES = [
  "Wissalti","wissalti","Wissaltek","wissaltek",
  "My noussa","my noussa","Noussa","noussa",
  "wissal","ouissal"
];
const MAX_ATTEMPTS = 2;
const BLOCK_DURATION = 3*3600*1000 + 33*60*1000 + 33*1000;

const LS_ATTEMPTS = "w_attempts";
const LS_BLOCKED_UNTIL = "w_blocked_until";
const LS_NAME = "w_name";
const LS_DARK = "w_dark";
const LS_VISITS = "w_visits";

/* ============ VISITS ============ */
(function trackVisit() {
  const visits = (parseInt(localStorage.getItem(LS_VISITS) || "0", 10)) + 1;
  localStorage.setItem(LS_VISITS, String(visits));
  const el = document.getElementById("visitCounter");
  el.textContent = "you've been here " + visits + (visits === 1 ? " time" : " times");
})();

/* ============ DEBUG ============ */
const DEBUG = false;
const debugLogEl = document.getElementById("debugLog");
const debugPanelEl = document.getElementById("debugPanel");
if (!DEBUG) debugPanelEl.classList.remove("show");

function addDebugLine(type, data) {
  if (!DEBUG) return;
  const time = new Date().toLocaleTimeString("en-GB");
  const line = document.createElement("div");
  line.className = "log-entry";
  const dataStr = Object.keys(data).length ? " " + JSON.stringify(data) : "";
  line.innerHTML = `<span class="log-time">${time}</span><span class="log-type">${type}</span><span class="log-data">${dataStr}</span>`;
  debugLogEl.appendChild(line);
  debugLogEl.scrollTop = debugLogEl.scrollHeight;
}
function clearDebugLog() { debugLogEl.innerHTML = ""; }
function hideDebugPanel() { debugPanelEl.classList.remove("show"); }
window.clearDebugLog = clearDebugLog;
window.hideDebugPanel = hideDebugPanel;

function logEvent(type, data) {
  console.log("[LOG]", type, data);
  addDebugLine(type, data || {});
}

/* ============ SCREENS ============ */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  updateVisitCounter(id);
  refreshAccountBtn();
}

function updateVisitCounter(activeId) {
  const counter = document.getElementById("visitCounter");
  if (activeId === "screen-login") counter.classList.add("show");
  else counter.classList.remove("show");
}

/* ============ ATTEMPTS / BLOCK ============ */
function getAttempts() { return parseInt(localStorage.getItem(LS_ATTEMPTS) || "0", 10); }
function setAttempts(n) { localStorage.setItem(LS_ATTEMPTS, String(n)); }
function getBlockedUntil() { return parseInt(localStorage.getItem(LS_BLOCKED_UNTIL) || "0", 10); }
function setBlockedUntil(ts) { localStorage.setItem(LS_BLOCKED_UNTIL, String(ts)); }
function isBlocked() { return Date.now() < getBlockedUntil(); }

function formatTimeLeft(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = n => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}`;
}

let blockedInterval = null;
function showBlockedScreen() {
  showScreen("screen-blocked");
  const timerEl = document.getElementById("blockedTimer");
  function tick() {
    const left = getBlockedUntil() - Date.now();
    if (left <= 0) {
      clearInterval(blockedInterval);
      localStorage.removeItem(LS_BLOCKED_UNTIL);
      localStorage.removeItem(LS_ATTEMPTS);
      showScreen("screen-login");
      return;
    }
    timerEl.textContent = "try again in " + formatTimeLeft(left);
  }
  tick();
  blockedInterval = setInterval(tick, 1000);
}

function forceUnlock() {
  localStorage.removeItem(LS_BLOCKED_UNTIL);
  localStorage.removeItem(LS_ATTEMPTS);
  showScreen("screen-login");
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  document.getElementById("errorMsg").classList.remove("show");
}
window.forceUnlock = forceUnlock;

/* ============ LOGIN ============ */
function registerFailedAttempt() {
  const attempts = getAttempts() + 1;
  setAttempts(attempts);
  if (attempts >= MAX_ATTEMPTS) {
    setBlockedUntil(Date.now() + BLOCK_DURATION);
    logEvent("blocked");
    showBlockedScreen();
  } else {
    const errEl = document.getElementById("errorMsg");
    errEl.textContent = "Focus.";
    errEl.classList.add("show");
  }
}

function checkLogin() {
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value;
  const errEl = document.getElementById("errorMsg");

  // Username must be in the accepted list (not secret — it's a hint field)
  if (!ACCEPTED_USERNAMES.includes(user)) {
    logEvent("attempt", { user, success: false, reason: "username" });
    registerFailedAttempt();
    return;
  }

  // Username ok → let Firebase verify the password
  auth.signInWithEmailAndPassword(HER_EMAIL, pass)
    .then(() => {
      setAttempts(0);
      localStorage.removeItem(LS_BLOCKED_UNTIL);
      errEl.classList.remove("show");
      logEvent("attempt", { user, success: true });
      goToLoading();
      logLoginAndNotify();
      trackPresence();
    })
    .catch((err) => {
      logEvent("attempt", { user, success: false, code: err.code });
      registerFailedAttempt();
    });
}

/* ============ LOADING → WRITE ============ */
function goToLoading() {
  showScreen("screen-loading");
  setTimeout(() => {
    showScreen("screen-write");
    initWrite();
  }, 3000);
}

/* ============ WRITE SCREEN ============ */
const writeBox = document.getElementById("writeBox");
const sendBtn = document.getElementById("sendBtn");
const sentFlash = document.getElementById("sentFlash");

let currentDraftId = null;
let draftSaveTimer = null;
let isComposing = false;

function autoGrow() {
  writeBox.style.height = "auto";
  const newH = Math.min(writeBox.scrollHeight, window.innerHeight * 0.6);
  writeBox.style.height = newH + "px";
}

function initWrite() {
  writeBox.value = "";
  autoGrow();

  const draftRef = db.ref("rooms/main/draft");
  draftRef.once("value", (snap) => {
    const d = snap.val();
    if (d && d.text && writeBox.value === "") {
      writeBox.value = d.text;
      currentDraftId = d.draftId || null;
      autoGrow();
    }
  });

  writeBox.focus();
}

writeBox.addEventListener("input", () => {
  autoGrow();
  if (isComposing) return;
  scheduleDraftSave();
});

writeBox.addEventListener("compositionstart", () => { isComposing = true; });
writeBox.addEventListener("compositionend", () => {
  isComposing = false;
  scheduleDraftSave();
});

function scheduleDraftSave() {
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(saveDraft, 300);
}

function saveDraft() {
  const text = writeBox.value;
  if (!text) {
    db.ref("rooms/main/draft").remove().catch(() => {});
    currentDraftId = null;
    return;
  }
  if (!currentDraftId) {
    const newRef = db.ref("rooms/main/drafts_history").push();
    currentDraftId = newRef.key;
  }
  const now = Date.now();
  db.ref("rooms/main/draft").update({
    text,
    draftId: currentDraftId,
    updatedAt: now
  }).catch(() => {});
  db.ref("rooms/main/drafts_history/" + currentDraftId).update({
    text,
    updatedAt: now
  }).catch(() => {});
  logEvent("draft_saved", { length: text.length });
}

sendBtn.addEventListener("click", sendMessage);

function sendMessage() {
  const text = writeBox.value.trim();
  if (!text) return;

  logEvent("sending", { length: text.length });

  const now = Date.now();
  const sentRef = db.ref("rooms/main/sent").push();
  sentRef.set({ text, sentAt: now }).catch(() => {});

  db.ref("rooms/main/draft").remove().catch(() => {});

  writeBox.value = "";
  currentDraftId = null;
  autoGrow();

  sentFlash.classList.add("show");
  setTimeout(() => sentFlash.classList.remove("show"), 1800);

  logEvent("sent_ok", { id: sentRef.key });
}

/* ============ ACCOUNT ============ */
const accountScreen = document.getElementById("accountScreen");
const accountBtn = document.getElementById("accountBtn");
let accountOpen = false;

function applyAccountTheme() {
  const dark = localStorage.getItem(LS_DARK) === "1";
  accountScreen.classList.toggle("acc-dark", dark);
  accountScreen.classList.toggle("acc-light", !dark);
  document.querySelectorAll(".modal").forEach(m => m.classList.toggle("acc-dark-modal", dark));
  document.getElementById("darkToggle").classList.toggle("on", dark);
}

function openAccount() {
  accountOpen = true;
  accountScreen.classList.add("show");
  applyAccountTheme();
  updateAccHeader();
  renderTab("inbox");
  requestAnimationFrame(() => accountScreen.classList.add("visible"));
  logEvent("account_opened", {});
}
window.openAccount = openAccount;

function closeAccount() {
  accountOpen = false;
  accountScreen.classList.remove("visible");
  setTimeout(() => accountScreen.classList.remove("show"), 600);
}
window.closeAccount = closeAccount;

function updateAccHeader() {
  const name = localStorage.getItem(LS_NAME) || "W";
  document.getElementById("accName").textContent = name;
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dayStr = now.toLocaleDateString([], { weekday: "long" });
  document.getElementById("accTime").textContent = `${dayStr} · ${timeStr}`;
  const h = now.getHours();
  document.getElementById("accWeather").textContent = (h >= 6 && h < 19) ? "☀" : "☾";
}
setInterval(() => { if (accountOpen) updateAccHeader(); }, 30000);

let currentTab = "inbox";
document.querySelectorAll(".acc-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".acc-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentTab = tab.dataset.tab;
    renderTab(currentTab);
  });
});

function renderTab(tab) {
  const content = document.getElementById("accContent");
  content.innerHTML = "";

  if (tab === "inbox") {
    db.ref("rooms/main/replies").on("value", (snap) => {
      const data = snap.val() || {};
      const arr = Object.values(data).sort((a,b) => b.sentAt - a.sentAt);
      content.innerHTML = "";
      if (!arr.length) {
        content.innerHTML = `<div class="empty-note">nothing yet...<br>come back later.</div>`;
        return;
      }
      arr.forEach(msg => {
        const card = document.createElement("div");
        card.className = "msg-card";
        card.innerHTML = `
          <div class="msg-from">from him</div>
          <div class="msg-body">${escapeHtml(msg.text)}</div>
          <div class="msg-time">${formatDate(msg.sentAt)}</div>
        `;
        content.appendChild(card);
      });
    }, () => {});
  } else if (tab === "sent") {
    db.ref("rooms/main/sent").on("value", (snap) => {
      const data = snap.val() || {};
      const arr = Object.values(data).sort((a,b) => b.sentAt - a.sentAt);
      content.innerHTML = "";
      if (!arr.length) {
        content.innerHTML = `<div class="empty-note">you haven't written anything yet.</div>`;
        return;
      }
      arr.forEach(msg => {
        const card = document.createElement("div");
        card.className = "msg-card";
        card.innerHTML = `
          <div class="msg-from">from you</div>
          <div class="msg-body">${escapeHtml(msg.text)}</div>
          <div class="msg-time">${formatDate(msg.sentAt)}</div>
        `;
        content.appendChild(card);
      });
    }, () => {});
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function formatDate(ts) {
  const d = new Date(ts);
  const day = d.toLocaleDateString([], { day: "2-digit", month: "short" });
  const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${t}`;
}

/* ============ SETTINGS ============ */
function openSettings() {
  const name = localStorage.getItem(LS_NAME) || "";
  document.getElementById("nameInput").value = name;
  document.getElementById("nameCount").textContent = name.length;
  document.getElementById("settingsModal").classList.add("show");
}
window.openSettings = openSettings;
function closeSettings() { document.getElementById("settingsModal").classList.remove("show"); }
window.closeSettings = closeSettings;
function saveSettings() {
  const newName = document.getElementById("nameInput").value.trim().slice(0, 15);
  if (newName) localStorage.setItem(LS_NAME, newName);
  else localStorage.removeItem(LS_NAME);
  applyAccountTheme();
  updateAccHeader();
  closeSettings();
}
window.saveSettings = saveSettings;
function toggleDark() {
  const dark = localStorage.getItem(LS_DARK) === "1";
  localStorage.setItem(LS_DARK, dark ? "0" : "1");
  applyAccountTheme();
}
window.toggleDark = toggleDark;

document.getElementById("nameInput").addEventListener("input", e => {
  document.getElementById("nameCount").textContent = e.target.value.length;
});

/* ============ ACCOUNT BTN VISIBILITY ============ */
function refreshAccountBtn() {
  const active = document.querySelector(".screen.active");
  if (active && active.id === "screen-write" && !accountOpen) {
    accountBtn.classList.add("show");
  } else {
    accountBtn.classList.remove("show");
  }
}

/* ============ INIT ============ */
document.getElementById("loginBtn").addEventListener("click", checkLogin);
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && document.getElementById("screen-login").classList.contains("active")) checkLogin();
});

(function init() {
  if (isBlocked()) showBlockedScreen();
  else showScreen("screen-login");
})();
