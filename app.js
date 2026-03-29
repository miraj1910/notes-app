const CLIENT_ID = window.APP_CONFIG?.CLIENT_ID || "";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

/* ================= STATE ================= */

let token;
let tokenClient;
let currentNoteId = null;
let saveTimer = null;
let isCreatingNote = false;
let notesCache = [];
let isSaving = false;
let hasPendingSave = false;
let activeOpenRequestId = 0;
let activeOpenController = null;

/* ================= DOM ================= */

const loginScreen = document.getElementById("login-screen");
const app = document.getElementById("app");
const loginBtn = document.getElementById("login-btn");
const newNoteBtn = document.getElementById("new-note");
const authError = document.getElementById("auth-error");

const notesList = document.getElementById("notes-list");
const titleInput = document.getElementById("note-title");
const contentInput = document.getElementById("note-content");
const notesCount = document.getElementById("notes-count");
const workspaceTitle = document.getElementById("workspace-title");
const saveStatus = document.getElementById("save-status");
const emptyState = document.getElementById("empty-state");
const editorFields = document.getElementById("editor-fields");

notesList.onclick = handleNotesListClick;

/* ================= GOOGLE SCRIPT READY ================= */

// Google calls this automatically when gsi script is loaded
window.onGoogleLibraryLoad = () => {
  if (!validateAuthConfig()) {
    loginBtn.disabled = true;
    return;
  }

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
    showAuthError("Google sign-in failed. Check your OAuth client setup and try again.");
    return;
  }

  clearAuthError();
  token = resp.access_token;
  loginScreen.style.display = "none";
  app.classList.remove("hidden");
  updateEditorVisibility(false);
  loadNotes();
}

/* ================= DRIVE HELPERS ================= */

function driveGET(url, options = {}) {
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: options.signal
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

function driveUpdateMetadata(id, body) {
  return fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
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
  try {
    const res = await driveGET(
      "https://www.googleapis.com/drive/v3/files" +
      "?q=mimeType='application/json'" +
      "&spaces=drive" +
      "&fields=files(id,name)"
    );

    const data = await res.json();
    const files = Array.isArray(data.files) ? data.files : [];
    notesCache = files.map((file) => ({
      id: file.id,
      title: file.name || "Untitled",
      content: null
    }));
    renderNotesList();
    setSaveStatus("Ready");
  } catch (error) {
    console.error(error);
    setSaveStatus("Failed to load notes");
  }
}

/* ================= LOAD SINGLE NOTE ================= */

async function loadNoteContent(id, options = {}) {
  const res = await driveGET(
    `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
    options
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

  const del = document.createElement("button");
  del.type = "button";
  del.className = "note-delete-btn";
  del.textContent = "🗑";

  li.appendChild(t);
  li.appendChild(del);
  notesList.appendChild(li);
}

function renderNotesList() {
  notesList.innerHTML = "";
  notesCache.forEach((note) => addNoteToList(note.id, note.title));
  updateNotesCount(notesCache.length);
  highlightActiveNote();
}

/* ================= OPEN NOTE ================= */

async function openNote(id) {
  const requestId = ++activeOpenRequestId;
  activeOpenController?.abort();
  activeOpenController = new AbortController();

  try {
    currentNoteId = id;
    highlightActiveNote();

    const cachedNote = notesCache.find((note) => note.id === id);
    updateEditorVisibility(true);

    titleInput.value = cachedNote?.title || "Untitled";
    workspaceTitle.textContent = cachedNote?.title || "Untitled note";

    if (cachedNote && cachedNote.content !== null) {
      setEditorLoading(false);
      contentInput.value = cachedNote.content;
      setSaveStatus("Loaded");
      return;
    }

    setEditorLoading(true);
    contentInput.value = "";
    setSaveStatus("Loading note...");

    const note = await loadNoteContent(id, {
      signal: activeOpenController.signal
    });

    updateCachedNote(id, {
      title: note.title || cachedNote?.title || "Untitled",
      content: note.content || ""
    });
    updateNoteListTitle(id, note.title || cachedNote?.title || "Untitled");

    if (requestId !== activeOpenRequestId || currentNoteId !== id) {
      return;
    }

    setEditorLoading(false);
    titleInput.value = note.title || cachedNote?.title || "Untitled";
    contentInput.value = note.content || "";
    workspaceTitle.textContent = note.title || cachedNote?.title || "Untitled note";
    setSaveStatus("Loaded");
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }

    console.error(error);
    if (requestId === activeOpenRequestId) {
      setEditorLoading(false);
      setSaveStatus("Failed to open note");
    }
  } finally {
    if (requestId === activeOpenRequestId) {
      activeOpenController = null;
    }
  }
}

/* ================= CREATE NOTE ================= */

async function createNote() {
  if (isCreatingNote) return;

  isCreatingNote = true;
  newNoteBtn.disabled = true;
  newNoteBtn.textContent = "Creating...";
  setSaveStatus("Creating...");

  const tempId = `temp-${Date.now()}`;
  currentNoteId = tempId;
  notesCache.unshift({
    id: tempId,
    title: "Untitled",
    content: ""
  });
  titleInput.value = "Untitled";
  contentInput.value = "";
  setEditorLoading(false);
  workspaceTitle.textContent = "Untitled note";
  updateEditorVisibility(true);
  renderNotesList();

  try {
    const res = await fetch(
      "https://www.googleapis.com/drive/v3/files?fields=id",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: "Untitled",
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
    notesCache = notesCache.map((note) =>
      note.id === tempId ? { ...note, id: file.id } : note
    );
    renderNotesList();

    if (titleInput.value !== "Untitled" || contentInput.value !== "") {
      saveNote();
    }

    setSaveStatus("New note ready");
  } catch (error) {
    console.error(error);
    notesCache = notesCache.filter((note) => note.id !== tempId);
    if (currentNoteId === tempId) {
      currentNoteId = null;
      titleInput.value = "";
      contentInput.value = "";
      setEditorLoading(false);
      workspaceTitle.textContent = "Untitled note";
      updateEditorVisibility(false);
    }
    renderNotesList();
    setSaveStatus("Failed to create note");
  } finally {
    isCreatingNote = false;
    newNoteBtn.disabled = false;
    newNoteBtn.textContent = "New Note";
  }
}

/* ================= AUTOSAVE ================= */

function scheduleSave() {
  clearTimeout(saveTimer);
  const draftTitle = titleInput.value || "Untitled";

  workspaceTitle.textContent = draftTitle;
  updateCachedNote(currentNoteId, {
    title: draftTitle,
    content: contentInput.value
  });
  updateNoteListTitle(currentNoteId, draftTitle);
  setSaveStatus("Saving...");

  saveTimer = setTimeout(queueSave, 800);
}

function queueSave() {
  if (!currentNoteId || isTemporaryNoteId(currentNoteId)) return;

  if (isSaving) {
    hasPendingSave = true;
    return;
  }

  saveNote();
}

async function saveNote() {
  if (!currentNoteId || isTemporaryNoteId(currentNoteId) || isSaving) return;

  isSaving = true;

  try {
    const payload = {
      title: titleInput.value || "Untitled",
      content: contentInput.value
    };

    await Promise.all([
      drivePATCH(
        `https://www.googleapis.com/upload/drive/v3/files/${currentNoteId}?uploadType=media`,
        payload
      ),
      driveUpdateMetadata(currentNoteId, { name: payload.title })
    ]);

    updateCachedNote(currentNoteId, payload);
    updateNoteListTitle(currentNoteId, payload.title);
    workspaceTitle.textContent = payload.title || "Untitled note";
    setSaveStatus("Saved");
  } catch (error) {
    console.error(error);
    setSaveStatus("Save failed");
  } finally {
    isSaving = false;

    if (hasPendingSave) {
      hasPendingSave = false;
      queueSave();
    }
  }
}

titleInput.oninput = scheduleSave;
contentInput.oninput = scheduleSave;

/* ================= DELETE NOTE ================= */

async function deleteNote(id) {
  if (!confirm("Delete this note?")) return;

  const previousNotes = [...notesCache];
  const wasCurrentNote = id === currentNoteId;

  notesCache = notesCache.filter((note) => note.id !== id);

  if (wasCurrentNote) {
    currentNoteId = null;
    titleInput.value = "";
    contentInput.value = "";
    setEditorLoading(false);
    workspaceTitle.textContent = "Untitled note";
    updateEditorVisibility(false);
    setSaveStatus("Deleting...");
  }

  renderNotesList();

  try {
    if (isTemporaryNoteId(id)) {
      setSaveStatus("Deleted");
      return;
    }

    await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    setSaveStatus("Deleted");
  } catch (error) {
    console.error(error);
    notesCache = previousNotes;
    if (wasCurrentNote) {
      currentNoteId = id;
      const restoredNote = previousNotes.find((note) => note.id === id);
      titleInput.value = restoredNote?.title || "Untitled";
      contentInput.value = restoredNote?.content || "";
      setEditorLoading(restoredNote?.content === null);
      workspaceTitle.textContent = restoredNote?.title || "Untitled note";
      updateEditorVisibility(true);
    }
    renderNotesList();
    setSaveStatus("Delete failed");
  }
}

function updateNotesCount(count) {
  notesCount.textContent = `${count} note${count === 1 ? "" : "s"}`;
}

function highlightActiveNote() {
  const items = document.querySelectorAll(".note-item");
  items.forEach((item) => {
    item.classList.toggle("active", item.dataset.id === currentNoteId);
  });
}

function updateEditorVisibility(showEditor) {
  emptyState.classList.toggle("hidden", showEditor);
  editorFields.classList.toggle("hidden", !showEditor);
}

function setSaveStatus(text) {
  saveStatus.textContent = text;
}

function setEditorLoading(loading) {
  titleInput.readOnly = loading;
  contentInput.readOnly = loading;
}

function isTemporaryNoteId(id) {
  return typeof id === "string" && id.startsWith("temp-");
}

function updateCachedNote(id, updates) {
  if (!id) return;

  notesCache = notesCache.map((note) =>
    note.id === id ? { ...note, ...updates } : note
  );
}

function updateNoteListTitle(id, title) {
  if (!id) return;

  const titleEl = document.querySelector(`.note-item[data-id="${id}"] .note-title`);
  if (titleEl) titleEl.textContent = title;
}

function handleNotesListClick(event) {
  const deleteButton = event.target.closest(".note-delete-btn");
  if (deleteButton) {
    const noteItem = deleteButton.closest(".note-item");
    if (noteItem) {
      deleteNote(noteItem.dataset.id);
    }
    return;
  }

  const noteItem = event.target.closest(".note-item");
  if (noteItem) {
    openNote(noteItem.dataset.id);
  }
}

function validateAuthConfig() {
  if (window.location.protocol === "file:") {
    showAuthError("Open the app through a local server like http://localhost:5500, not as a file:// page.");
    return false;
  }

  if (!CLIENT_ID || CLIENT_ID.includes("YOUR_GOOGLE_CLIENT_ID")) {
    showAuthError("Add your Google OAuth Web Client ID in config.js before signing in.");
    return false;
  }

  return true;
}

function showAuthError(message) {
  authError.textContent = message;
  authError.classList.remove("hidden");
}

function clearAuthError() {
  authError.textContent = "";
  authError.classList.add("hidden");
}
