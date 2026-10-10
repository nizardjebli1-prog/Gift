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

/* ============ ADMIN ACCOUNT (HIDDEN EMAIL) ============ */
const ADMIN_EMAIL = "admin@private.app";

/* ============ GATE ============ */
document.getElementById("gateBtn").addEventListener("click", tryGate);
document.getElementById("gatePass").addEventListener("keydown", e => {
  if (e.key === "Enter") tryGate();
});
document.getElementById("gatePass").focus();

function tryGate() {
  const v = document.getElementById("gatePass").value;
  const err = document.getElementById("gateError");

  if (!v) {
    err.textContent = "wrong key.";
    err.classList.add("show");
    return;
  }

  // Let Firebase verify the key — no key is stored in this file
  auth.signInWithEmailAndPassword(ADMIN_EMAIL, v)
    .then(() => {
      err.classList.remove("show");
      startAdmin();
    })
    .catch(() => {
      err.textContent = "wrong key.";
      err.classList.add("show");
    });
}

function startAdmin() {
  document.getElementById("adminGate").style.display = "none";
  document.getElementById("adminPanel").style.display = "block";

  /* ============ PRESENCE ============ */
  const presenceDot = document.getElementById("presenceDot");
  const presenceText = document.getElementById("presenceText");

  db.ref("rooms/main/presence").on("value", (snap) => {
    const p = snap.val();
    if (p && p.online) {
      presenceDot.textContent = "🟢";
      presenceText.textContent = "online";
    } else {
      presenceDot.textContent = "⚪";
      presenceText.textContent = "offline";
    }
  });

  /* ============ LIVE DRAFT ============ */
  const liveText = document.getElementById("liveText");
  const liveMeta = document.getElementById("liveMeta");

  db.ref("rooms/main/draft").on("value", (snap) => {
    const d = snap.val();
    if (!d || !d.text) {
      liveText.textContent = "";
      liveMeta.textContent = "—";
      return;
    }
    liveText.textContent = d.text;
    const when = new Date(d.updatedAt || Date.now());
    liveMeta.textContent = "last update: " + when.toLocaleTimeString();
  });

  /* ============ SENT MESSAGES ============ */
  const sentEl = document.getElementById("adminSent");
  db.ref("rooms/main/sent").on("value", (snap) => {
    const data = snap.val() || {};
    const arr = Object.values(data).sort((a,b) => b.sentAt - a.sentAt);
    sentEl.innerHTML = "";
    if (!arr.length) {
      sentEl.innerHTML = `<div class="empty-note">no messages yet.</div>`;
      return;
    }
    arr.forEach(msg => {
      const card = document.createElement("div");
      card.className = "admin-card";
      card.innerHTML = `
        <div class="admin-card-time">${formatDate(msg.sentAt)}</div>
        <div class="admin-card-body">${escapeHtml(msg.text)}</div>
      `;
      sentEl.appendChild(card);
    });
  });

  /* ============ LOGINS ============ */
  const loginsEl = document.getElementById("adminLogins");
  db.ref("rooms/main/logins").on("value", (snap) => {
    const data = snap.val() || {};
    const arr = Object.values(data).sort((a,b) => b.time - a.time);
    loginsEl.innerHTML = "";
    if (!arr.length) {
      loginsEl.innerHTML = `<div class="empty-note">no logins yet.</div>`;
      return;
    }
    let lastDay = "";
    arr.forEach(l => {
      const d = new Date(l.time);
      const dayKey = d.toDateString();
      if (dayKey !== lastDay) {
        lastDay = dayKey;
        const sep = document.createElement("div");
        sep.className = "day-separator";
        sep.textContent = d.toLocaleDateString([], { weekday: "long", day: "2-digit", month: "short" });
        loginsEl.appendChild(sep);
      }
      const card = document.createElement("div");
      card.className = "login-card";
      card.innerHTML = `
        <div class="login-when">${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        <div class="login-row"><span class="login-label">device</span> ${escapeHtml(l.device || "?")} · ${escapeHtml(l.browser || "?")}</div>
        <div class="login-row"><span class="login-label">location</span> ${escapeHtml(l.city || "?")}, ${escapeHtml(l.country || "?")}</div>
        <div class="login-row"><span class="login-label">ip</span> ${escapeHtml(l.ip || "?")}</div>
        <div class="login-row"><span class="login-label">screen</span> ${escapeHtml(l.screen || "?")} · ${escapeHtml(l.language || "?")}</div>
      `;
      loginsEl.appendChild(card);
    });
  });

  /* ============ DRAFTS HISTORY ============ */
  const draftsEl = document.getElementById("adminDrafts");
  db.ref("rooms/main/drafts_history").on("value", (snap) => {
    const data = snap.val() || {};
    const arr = Object.values(data).sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0));
    draftsEl.innerHTML = "";
    if (!arr.length) {
      draftsEl.innerHTML = `<div class="empty-note">no drafts yet.</div>`;
      return;
    }
    arr.slice(0, 20).forEach(d => {
      const card = document.createElement("div");
      card.className = "admin-card";
      card.innerHTML = `
        <div class="admin-card-time">${formatDate(d.updatedAt)}</div>
        <div class="admin-card-body">${escapeHtml(d.text || "")}</div>
      `;
      draftsEl.appendChild(card);
    });
  });

  /* ============ REPLY ============ */
  const replyBox = document.getElementById("replyBox");
  const replyBtn = document.getElementById("replyBtn");
  const replyFlash = document.getElementById("replyFlash");

  replyBtn.addEventListener("click", () => {
    const text = replyBox.value.trim();
    if (!text) return;
    const now = Date.now();
    const r = db.ref("rooms/main/replies").push();
    r.set({ text, sentAt: now }).catch(() => {});
    replyBox.value = "";
    replyFlash.classList.add("show");
    setTimeout(() => replyFlash.classList.remove("show"), 1800);
  });

  /* ============ DANGER ZONE ============ */
  setupDangerZone();
}

/* ============ DANGER ZONE FUNCTION ============ */
function setupDangerZone() {
  const paths = {
    sent: "rooms/main/sent",
    drafts: "rooms/main/drafts_history",
    logins: "rooms/main/logins",
    replies: "rooms/main/replies"
  };
  const counts = {
    sent: document.getElementById("countSent"),
    drafts: document.getElementById("countDrafts"),
    logins: document.getElementById("countLogins"),
    replies: document.getElementById("countReplies")
  };
  const feedback = document.getElementById("dangerFeedback");

  Object.keys(paths).forEach(key => {
    db.ref(paths[key]).on("value", (snap) => {
      const n = snap.numChildren();
      counts[key].textContent = n > 0 ? n + " items" : "empty";
    });
  });

  let armed = null;
  let armedTimeout = null;

  document.querySelectorAll(".danger-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.clear;

      if (armed === btn) {
        clearTimeout(armedTimeout);
        btn.classList.remove("armed");
        armed = null;

        db.ref(paths[key]).remove()
          .then(() => {
            btn.classList.add("done");
            feedback.textContent = "cleared: " + key;
            setTimeout(() => {
              btn.classList.remove("done");
              feedback.textContent = "";
            }, 2000);
          })
          .catch(() => {
            feedback.textContent = "error clearing " + key;
            setTimeout(() => feedback.textContent = "", 2000);
          });
      } else {
        if (armed) armed.classList.remove("armed");
        clearTimeout(armedTimeout);
        armed = btn;
        btn.classList.add("armed");
        feedback.textContent = "tap again to confirm: " + key;
        armedTimeout = setTimeout(() => {
          if (armed === btn) {
            btn.classList.remove("armed");
            armed = null;
            feedback.textContent = "";
          }
        }, 4000);
      }
    });
  });
}

/* ============ HELPERS ============ */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const day = d.toLocaleDateString([], { day: "2-digit", month: "short" });
  const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${t}`;
                                 }
