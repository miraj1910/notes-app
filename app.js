const CLIENT_ID = "874527368898-hif9voa0tommi94lmvvvjpaokmq5jciu.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

/* ================= CONFIG ================= */

/* ================= STATE ================= */

let token;
let tokenClient;
let currentNote = null;
let saveTimer;

/* ================= DOM ================= */

const loginScreen = document.getElementById("login-screen");
const loginBtn = document.getElementById("login-btn");
const app = document.getElementById("app");

const newNoteBtn = document.getElementById("new-note");
const notesList = document.getElementById("notes-list");

const titleInput = document.getElementById("note-title");
const contentInput = document.getElementById("note-content");

/* ================= HELPERS ================= */

function safeTitle(title) {
  return title
    .replace(/[\\\/?#%:*|"<>]/g, "")
    .trim()
    .substring(0, 100) || "Untitled";
}

/* ================= AUTH ================= */

window.onload = () => {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      token = resp.access_token;
      loginScreen.style.display = "none";
      app.classList.remove("hidden");
      loadNotes();
    }
  });
};

loginBtn.onclick = () => tokenClient.requestAccessToken();

/* ================= DRIVE ================= */

async function loadNotes() {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=name contains '.note.json'",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  renderList(data.files || []);
}

function parseName(name) {
  const pinned = name.startsWith("PIN__");
  const title = name
    .replace("PIN__", "")
    .replace(".note.json", "") || "Untitled";
  return { pinned, title };
}

function renderList(files) {
  notesList.innerHTML = "";

  files
    .map(f => ({ ...f, ...parseName(f.name) }))
    .sort((a, b) => b.pinned - a.pinned)
    .forEach(f => {
      const li = document.createElement("li");
      li.className = "note-item";

      const title = document.createElement("div");
      title.className = "note-title";
      title.textContent = f.title;
      title.onclick = () => openNote(f);

      const actions = document.createElement("div");
      actions.className = "note-actions";

      const pin = document.createElement("button");
      pin.textContent = "📌";
      pin.onclick = (e) => {
        e.stopPropagation();
        togglePin(f);
      };

      const del = document.createElement("button");
      del.textContent = "🗑";
      del.onclick = (e) => {
        e.stopPropagation();
        deleteNote(f.id);
      };

      actions.append(pin, del);
      li.append(title, actions);
      notesList.appendChild(li);
    });
}

async function openNote(file) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  currentNote = await res.json();
  currentNote.id = file.id;
  currentNote.pinned = file.pinned;

  titleInput.value = file.title;
  contentInput.value = currentNote.content || "";
}

/* ================= CREATE ================= */

newNoteBtn.onclick = async () => {
  const meta = await fetch(
    "https://www.googleapis.com/drive/v3/files",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Untitled.note.json",
        mimeType: "application/json"
      })
    }
  );

  const file = await meta.json();

  await upload(file.id, { content: "" });
  loadNotes();
};

/* ================= SAVE ================= */

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNote, 500);
}

async function saveNote() {
  if (!currentNote) return;

  const title = safeTitle(titleInput.value);
  const name = `${currentNote.pinned ? "PIN__" : ""}${title}.note.json`;

  await fetch(
    `https://www.googleapis.com/drive/v3/files/${currentNote.id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name })
    }
  );

  currentNote.content = contentInput.value;
  await upload(currentNote.id, currentNote);
  loadNotes();
}

async function upload(id, data) {
  await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    }
  );
}

titleInput.oninput = scheduleSave;
contentInput.oninput = scheduleSave;

/* ================= PIN ================= */

async function togglePin(file) {
  const title = safeTitle(file.title);
  const name = `${file.pinned ? "" : "PIN__"}${title}.note.json`;

  await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name })
    }
  );

  loadNotes();
}

/* ================= DELETE ================= */

async function deleteNote(id) {
  if (!confirm("Delete this note permanently?")) return;

  await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (currentNote?.id === id) {
    currentNote = null;
    titleInput.value = "";
    contentInput.value = "";
  }

  loadNotes();
}
