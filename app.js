const CLIENT_ID = "1004015951669-j47ig0pr5bvihs6rpq1osp1hibf8evdh.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let token, tokenClient;
let currentNoteId = null;
let saveTimer;

const loginScreen = document.getElementById("login-screen");
const app = document.getElementById("app");
const notesList = document.getElementById("notes-list");
const titleInput = document.getElementById("note-title");
const contentInput = document.getElementById("note-content");
const newNoteBtn = document.getElementById("new-note");

/* ---------- SAFE GOOGLE INIT ---------- */
function waitForGoogle() {
  return new Promise(resolve => {
    const check = () => {
      if (window.google?.accounts?.oauth2) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await waitForGoogle();

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: authSuccess
  });

  document.getElementById("login-btn").onclick = () =>
    tokenClient.requestAccessToken();

  newNoteBtn.onclick = createNote;
});

/* ---------- AUTH ---------- */
function authSuccess(resp) {
  if (!resp.access_token) {
    alert("Login failed");
    return;
  }
  token = resp.access_token;
  loginScreen.style.display = "none";
  app.classList.remove("hidden");
  loadNotes();
}

/* ---------- DRIVE HELPERS ---------- */
async function driveGET(url) {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

async function drivePATCH(url, body) {
  return fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

/* ---------- LOAD NOTES ---------- */
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

/* ---------- LOAD NOTE CONTENT ---------- */
async function loadNoteContent(id) {
  const res = await driveGET(
    `https://www.googleapis.com/drive/v3/files/${id}?alt=media`
  );
  return res.json();
}

/* ---------- RENDER LIST ---------- */
function addNoteToList(id, title) {
  const li = document.createElement("li");
  li.className = "note-item";

  const t = document.createElement("div");
  t.className = "note-title";
  t.textContent = title;
  t.onclick = () => openNote(id);

  const del = document.createElement("button");
  del.textContent = "🗑";
  del.onclick = e => {
    e.stopPropagation();
    deleteNote(id);
  };

  li.appendChild(t);
  li.appendChild(del);
  notesList.appendChild(li);
}

/* ---------- OPEN ---------- */
async function openNote(id) {
  const note = await loadNoteContent(id);
  currentNoteId = id;
  titleInput.value = note.title || "Untitled";
  contentInput.value = note.content || "";
}

/* ---------- CREATE ---------- */
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

/* ---------- AUTOSAVE ---------- */
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNote, 500);
}

async function saveNote() {
  if (!currentNoteId) return;

  await drivePATCH(
    `https://www.googleapis.com/upload/drive/v3/files/${currentNoteId}?uploadType=media`,
    {
      title: titleInput.value || "Untitled",
      content: contentInput.value
    }
  );

  loadNotes();
}

titleInput.oninput = scheduleSave;
contentInput.oninput = scheduleSave;

/* ---------- DELETE ---------- */
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
