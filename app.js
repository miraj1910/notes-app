const CLIENT_ID = "1004015951669-j47ig0pr5bvihs6rpq1osp1hibf8evdh.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

/* ================= STATE ================= */

let token;
let tokenClient;
let currentNoteId = null;
let saveTimer = null;

/* ================= DOM ================= */

const loginScreen = document.getElementById("login-screen");
const app = document.getElementById("app");
const loginBtn = document.getElementById("login-btn");
const newNoteBtn = document.getElementById("new-note");

const notesList = document.getElementById("notes-list");
const titleInput = document.getElementById("note-title");
const contentInput = document.getElementById("note-content");

/* ================= GOOGLE SCRIPT READY ================= */

// Google calls this automatically when gsi script is loaded
window.onGoogleLibraryLoad = () => {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: onAuthSuccess
  });

  // attach click ONLY after tokenClient exists
  loginBtn.onclick = () => {
    tokenClient.requestAccessToken();
  };

  newNoteBtn.onclick = createNote;
};

/* ================= AUTH ================= */

function onAuthSuccess(resp) {
  if (!resp || !resp.access_token) {
    alert("Google sign-in failed");
    return;
  }

  token = resp.access_token;
  loginScreen.style.display = "none";
  app.classList.remove("hidden");
  loadNotes();
}

/* ================= DRIVE HELPERS ================= */

function driveGET(url) {
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

function drivePATCH(url, body) {
  return fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

/* ================= LOAD NOTES ================= */

async function loadNotes() {
  const res = await driveGET(
    "https://www.googleapis.com/drive/v3/files" +
    "?q=mimeType='application/json'" +
    "&spaces=drive" +
    "&fields=files(id)"
  );

  const data = await res.json();
  notesList.innerHTML = "";

  for (const f of data.files) {
    const note = await loadNoteContent(f.id);
    addNoteToList(f.id, note.title || "Untitled");
  }
}

/* ================= LOAD SINGLE NOTE ================= */

async function loadNoteContent(id) {
  const res = await driveGET(
    `https://www.googleapis.com/drive/v3/files/${id}?alt=media`
  );
  return res.json();
}

/* ================= SIDEBAR ITEM ================= */

function addNoteToList(id, title) {
  const li = document.createElement("li");
  li.className = "note-item";
  li.dataset.id = id;

  const t = document.createElement("div");
  t.className = "note-title";
  t.textContent = title || "Untitled";
  t.onclick = () => openNote(id);

  const del = document.createElement("button");
  del.type = "button";
  del.className = "note-delete-btn";
  del.textContent = "🗑";

  del.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    deleteNote(id);
  };

  li.appendChild(t);
  li.appendChild(del);
  notesList.appendChild(li);
}

/* ================= OPEN NOTE ================= */

async function openNote(id) {
  const note = await loadNoteContent(id);
  currentNoteId = id;
  titleInput.value = note.title || "Untitled";
  contentInput.value = note.content || "";
}

/* ================= CREATE NOTE ================= */

async function createNote() {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "note.json",
        mimeType: "application/json"
      })
    }
  );

  const file = await res.json();

  await drivePATCH(
    `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`,
    { title: "Untitled", content: "" }
  );

  currentNoteId = file.id;
  titleInput.value = "Untitled";
  contentInput.value = "";

  loadNotes();
}

/* ================= AUTOSAVE ================= */

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNote, 500);
}

async function saveNote() {
  if (!currentNoteId) return;

  const payload = {
    title: titleInput.value || "Untitled",
    content: contentInput.value
  };

  await drivePATCH(
    `https://www.googleapis.com/upload/drive/v3/files/${currentNoteId}?uploadType=media`,
    payload
  );

  const titleEl = document.querySelector(
    `.note-item[data-id="${currentNoteId}"] .note-title`
  );
  if (titleEl) titleEl.textContent = payload.title;
}

titleInput.oninput = scheduleSave;
contentInput.oninput = scheduleSave;

/* ================= DELETE NOTE ================= */

async function deleteNote(id) {
  if (!confirm("Delete this note?")) return;

  await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (id === currentNoteId) {
    currentNoteId = null;
    titleInput.value = "";
    contentInput.value = "";
  }

  loadNotes();
}

