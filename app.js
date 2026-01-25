const CLIENT_ID = "874527368898-hif9voa0tommi94lmvvvjpaokmq5jciu.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let token;
let tokenClient;
let currentFileId = null;
let saveTimer;

const loginScreen = document.getElementById("login-screen");
const app = document.getElementById("app");
const notesList = document.getElementById("notes-list");
const titleInput = document.getElementById("note-title");
const contentInput = document.getElementById("note-content");

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

document.getElementById("login-btn").onclick = () => {
  tokenClient.requestAccessToken();
};

document.getElementById("new-note").onclick = createNote;

/* ---------- HELPERS ---------- */

function cleanTitle(t) {
  return t.replace(/[\\\/?#%:*|"<>]/g, "").trim() || "Untitled";
}

/* ---------- LOAD NOTES ---------- */

async function loadNotes() {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=name contains '.note.json'",
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await res.json();
  renderList(data.files || []);
}

function renderList(files) {
  notesList.innerHTML = "";

  files.forEach(file => {
    const title = file.name.replace(".note.json", "");

    const li = document.createElement("li");
    li.className = "note-item";

    const t = document.createElement("div");
    t.className = "note-title";
    t.textContent = title || "Untitled";
    t.onclick = () => openNote(file.id, title);

    const actions = document.createElement("div");
    actions.className = "note-actions";

    const del = document.createElement("button");
    del.textContent = "🗑";
    del.onclick = e => {
      e.stopPropagation();
      deleteNote(file.id);
    };

    actions.appendChild(del);
    li.appendChild(t);
    li.appendChild(actions);
    notesList.appendChild(li);
  });
}

/* ---------- OPEN ---------- */

async function openNote(id, title) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await res.json();
  currentFileId = id;
  titleInput.value = title;
  contentInput.value = data.content || "";
}

/* ---------- CREATE ---------- */

async function createNote() {
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

  await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ content: "" })
    }
  );

  currentFileId = file.id;
  titleInput.value = "Untitled";
  contentInput.value = "";

  loadNotes();
}

/* ---------- SAVE ---------- */

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNote, 500);
}

async function saveNote() {
  if (!currentFileId) return;

  const title = cleanTitle(titleInput.value);

  await fetch(
    `https://www.googleapis.com/drive/v3/files/${currentFileId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: `${title}.note.json` })
    }
  );

  await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${currentFileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ content: contentInput.value })
    }
  );

  loadNotes();
}

titleInput.oninput = scheduleSave;
contentInput.oninput = scheduleSave;

/* ---------- DELETE ---------- */

async function deleteNote(id) {
  if (!confirm("Delete note?")) return;

  await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (id === currentFileId) {
    currentFileId = null;
    titleInput.value = "";
    contentInput.value = "";
  }

  loadNotes();
}

