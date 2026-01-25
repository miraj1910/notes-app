const CLIENT_ID = "874527368898-hif9voa0tommi94lmvvvjpaokmq5jciu.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let token = null;
let currentNote = null;
let notes = [];

const loginBtn = document.getElementById("login-btn");
const loginScreen = document.getElementById("login-screen");
const app = document.getElementById("app");

const notesList = document.getElementById("notes-list");
const titleInput = document.getElementById("note-title");
const contentInput = document.getElementById("note-content");

let saveTimer;

loginBtn.onclick = () => {
  google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      token = resp.access_token;
      loginScreen.classList.add("hidden");
      app.classList.remove("hidden");
      loadNotes();
    }
  }).requestAccessToken();
};

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
  notes.forEach(n => {
    const li = document.createElement("li");
    li.textContent = n.name.replace(".note.json","");
    li.onclick = () => openNote(n.id);
    notesList.appendChild(li);
  });
}

async function openNote(id) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  currentNote = await res.json();
  titleInput.value = currentNote.title;
  contentInput.value = currentNote.content;
}

function autoSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNote, 600);
}

async function saveNote() {
  if (!currentNote) return;

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

titleInput.oninput = autoSave;
contentInput.oninput = autoSave;
