const CLIENT_ID = "874527368898-hif9voa0tommi94lmvvvjpaokmq5jciu.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

/* ================= CONFIG ================= */


/* ================= STATE ================= */

let token = null;
let tokenClient;
let notes = [];
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

/* ================= AUTH ================= */

window.onload = () => {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: onAuthSuccess
  });
};

loginBtn.onclick = () => {
  tokenClient.requestAccessToken();
};

function onAuthSuccess(resp) {
  if (!resp.access_token) {
    alert("Login failed");
    return;
  }

  token = resp.access_token;
  loginScreen.style.display = "none";
  app.classList.remove("hidden");

  loadNotes();
}

/* ================= DRIVE ================= */

async function loadNotes() {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=name contains '.note.json'",
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  const data = await res.json();
  notes = data.files || [];
  renderList();
}

function renderList() {
  notesList.innerHTML = "";

  notes.forEach(file => {
    const li = document.createElement("li");
    li.textContent = file.name.replace(".note.json", "");
    li.onclick = () => openNote(file.id);
    notesList.appendChild(li);
  });
}

async function openNote(id) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  currentNote = await res.json();
  currentNote.id = id;

  titleInput.value = currentNote.title || "";
  contentInput.value = currentNote.content || "";
}

/* ================= CREATE NOTE ================= */

newNoteBtn.onclick = async () => {
  const metaRes = await fetch(
    "https://www.googleapis.com/drive/v3/files",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: `note-${Date.now()}.note.json`,
        mimeType: "application/json"
      })
    }
  );

  const file = await metaRes.json();

  const note = {
    title: "Untitled",
    content: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(note)
    }
  );

  loadNotes();
  openNote(file.id);
};

/* ================= AUTOSAVE ================= */

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNote, 500);
}

async function saveNote() {
  if (!currentNote || !currentNote.id) return;

  currentNote.title = titleInput.value;
  currentNote.content = contentInput.value;
  currentNote.updatedAt = new Date().toISOString();

  await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${currentNote.id}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(currentNote)
    }
  );
}

titleInput.oninput = scheduleSave;
contentInput.oninput = scheduleSave;

