const CLIENT_ID = "874527368898-hif9voa0tommi94lmvvvjpaokmq5jciu.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let token, tokenClient, currentNote, saveTimer;
const notesList = document.getElementById("notes-list");
const titleInput = document.getElementById("note-title");
const contentInput = document.getElementById("note-content");

window.onload = () => {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: r => {
      token = r.access_token;
      document.getElementById("login-screen").style.display = "none";
      document.getElementById("app").classList.remove("hidden");
      loadNotes();
    }
  });
};

document.getElementById("login-btn").onclick = () =>
  tokenClient.requestAccessToken();

document.getElementById("new-note").onclick = createNote;

async function loadNotes() {
  const r = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=name contains '.note.json'",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const d = await r.json();
  renderList(d.files || []);
}

function parseName(name) {
  const pinned = name.startsWith("PIN__");
  const title = name.replace("PIN__", "").replace(".note.json", "");
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

      const t = document.createElement("div");
      t.className = "note-title";
      t.textContent = f.title || "Untitled";
      t.onclick = () => openNote(f);

      const a = document.createElement("div");
      a.className = "note-actions";

      const p = document.createElement("button");
      p.textContent = "📌";
      p.onclick = e => { e.stopPropagation(); togglePin(f); };

      const d = document.createElement("button");
      d.textContent = "🗑";
      d.onclick = e => { e.stopPropagation(); deleteNote(f.id); };

      a.append(p, d);
      li.append(t, a);
      notesList.appendChild(li);
    });
}

async function openNote(file) {
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  currentNote = await r.json();
  currentNote.id = file.id;
  titleInput.value = file.title || "Untitled";
  contentInput.value = currentNote.content || "";
}

async function createNote() {
  const meta = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Untitled.note.json",
      mimeType: "application/json"
    })
  });

  const f = await meta.json();

  await upload(f.id, { content: "" });
  loadNotes();
}

async function saveNote() {
  if (!currentNote) return;

  const title = titleInput.value || "Untitled";
  const name = `${title}.note.json`;

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

function upload(id, data) {
  return fetch(
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

titleInput.oninput = contentInput.oninput = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNote, 500);
};

async function togglePin(f) {
  const newName = (f.pinned ? "" : "PIN__") + f.title + ".note.json";
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${f.id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: newName })
    }
  );
  loadNotes();
}

async function deleteNote(id) {
  if (!confirm("Delete this note?")) return;
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  loadNotes();
}

