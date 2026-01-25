const CLIENT_ID = "874527368898-hif9voa0tommi94lmvvvjpaokmq5jciu.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";


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

const pinBtn = document.getElementById("pin-btn");
const deleteBtn = document.getElementById("delete-btn");

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
  token = resp.access_token;
  loginScreen.style.display = "none";
  app.classList.remove("hidden");
  loadNotes();
}

/* ================= DRIVE ================= */

async function loadNotes() {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=name contains '.note.json'",
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await res.json();
  notes = data.files || [];
  renderList();
}

function renderList() {
  notesList.innerHTML = "";

  const sorted = [...notes].sort((a, b) => {
    return (b.pinned === true) - (a.pinned === true);
  });

  sorted.forEach(file => {
    const li = document.createElement("li");
    li.textContent = file.name.replace(".note.json", "");
    if (file.pinned) li.classList.add("pinned");
    li.onclick = () => openNote(file.id);
    notesList.appendChild(li);
  });
}

async function openNote(id) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  currentNote = await res.json();
  currentNote.id = id;

  titleInput.value = currentNote.title || "";
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
        name: `note-${Date.now()}.note.json`,
        mimeType: "application/json"
      })
    }
  );

  const file = await meta.json();

  const note = {
    title: "Untitled",
    content: "",
    pinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await upload(file.id, note);
  loadNotes();
  openNote(file.id);
};

/* ================= SAVE ================= */

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNote, 500);
}

async function saveNote() {
  if (!currentNote) return;

  currentNote.title = titleInput.value;
  currentNote.content = contentInput.value;
  currentNote.updatedAt = new Date().toISOString();

  await upload(currentNote.id, currentNote);
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

pinBtn.onclick = async () => {
  if (!currentNote) return;
  currentNote.pinned = !currentNote.pinned;
  await saveNote();
  loadNotes();
};

/* ================= DELETE ================= */

deleteBtn.onclick = async () => {
  if (!currentNote) return;

  if (!confirm("Delete this note permanently?")) return;

  await fetch(
    `https://www.googleapis.com/drive/v3/files/${currentNote.id}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  currentNote = null;
  titleInput.value = "";
  contentInput.value = "";
  loadNotes();
};

