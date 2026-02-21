import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, update, set } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAT6VhvQggviNUxDhL8KQKcyCi_Q1S6gjU",
  authDomain: "capstone3-bc2c3.firebaseapp.com",
  databaseURL: "https://capstone3-bc2c3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "capstone3-bc2c3",
  storageBucket: "capstone3-bc2c3.firebasestorage.app",
  messagingSenderId: "948536456584",
  appId: "1:948536456584:web:2e47332cbd2729b2c1363d"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// UI
const presenceBody = document.getElementById("presenceBody");
const tagsBody = document.getElementById("tagsBody");
const uidInput = document.getElementById("uidInput");
const nameInput = document.getElementById("nameInput");
const saveBtn = document.getElementById("saveBtn");
const saveStatus = document.getElementById("saveStatus");
const searchInput = document.getElementById("searchInput");

let presenceData = {};
let tagsData = {};
let searchText = "";

// === Expiry settings ===
const EXPIRE_MS = 30_000; // 30 seconds
setInterval(() => render(), 1000); // refresh UI every 1s so statuses can flip to EXPIRED

function fmtTime(ms) {
  if (!ms) return "-";
  const d = new Date(ms);
  return d.toLocaleString();
}
function norm(s) { return (s || "").toString().toLowerCase(); }

function render() {
  const q = norm(searchText);

  // Presence
  const presenceRows = Object.entries(presenceData || {}).map(([uid, obj]) => {
    const name = obj?.name || (tagsData?.[uid]?.name ?? "Unknown");
    const lastSeen = obj?.lastSeen || 0;
    const age = lastSeen ? (Date.now() - lastSeen) : Infinity;
    const isExpired = lastSeen > 0 && age > EXPIRE_MS;

    return { uid, name, lastSeen, age, isExpired };
  }).filter(r => !q || norm(r.uid).includes(q) || norm(r.name).includes(q))
    .sort((a,b) => (b.lastSeen||0) - (a.lastSeen||0));

  presenceBody.innerHTML = presenceRows.map(r => {
    const pillClass = r.isExpired ? "pill danger" : "pill present";
    const pillText  = r.isExpired ? "EXPIRED" : "PRESENT";
    const secondsAgo = r.lastSeen ? Math.floor(r.age / 1000) : null;

    return `
      <tr>
        <td><span class="${pillClass}">${pillText}</span></td>
        <td>${r.name} ${r.name==="Unknown" ? `<span class="pill unknown">UNENROLLED</span>` : ""}</td>
        <td><code>${r.uid}</code></td>
        <td>${r.lastSeen ? `${fmtTime(r.lastSeen)} <span class="muted">(${secondsAgo}s ago)</span>` : "-"}</td>
      </tr>
    `;
  }).join("");

  // Tags
  const tagRows = Object.entries(tagsData || {}).map(([uid, obj]) => ({ uid, name: obj?.name || "" }))
    .filter(r => !q || norm(r.uid).includes(q) || norm(r.name).includes(q))
    .sort((a,b) => norm(a.name).localeCompare(norm(b.name)));

  tagsBody.innerHTML = tagRows.map(r => `
    <tr>
      <td>${r.name || "-"}</td>
      <td><code>${r.uid}</code></td>
      <td><button data-uid="${r.uid}" data-name="${r.name || ""}">Edit</button></td>
    </tr>
  `).join("");

  tagsBody.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      uidInput.value = (btn.dataset.uid || "").toUpperCase();
      nameInput.value = btn.dataset.name || "";
      nameInput.focus();
    });
  });
}

// Save
saveBtn.addEventListener("click", async () => {
  const uid = (uidInput.value || "").trim().toUpperCase();
  const name = (nameInput.value || "").trim();

  if (!uid || !name) {
    saveStatus.textContent = "Please fill UID and Name.";
    return;
  }

  saveStatus.textContent = "Saving...";
  try {
    await set(ref(db, `tags/${uid}/name`), name);
    await update(ref(db, `presence/${uid}`), { name }); // keep presence name updated
    saveStatus.textContent = `Saved ${uid} → ${name}`;
    nameInput.value = "";
  } catch (e) {
    console.error(e);
    saveStatus.textContent = "Save failed (check rules/auth).";
  }
});

searchInput.addEventListener("input", (e) => {
  searchText = e.target.value || "";
  render();
});

// Auth + listeners
signInAnonymously(auth).catch(console.error);

onAuthStateChanged(auth, (user) => {
  if (!user) return;

  onValue(ref(db, "presence"), (snap) => {
    presenceData = snap.val() || {};
    render();
  });

  onValue(ref(db, "tags"), (snap) => {
    tagsData = snap.val() || {};
    render();
  });
});
