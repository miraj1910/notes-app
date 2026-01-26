const CLIENT_ID = "874527368898-hif9voa0tommi94lmvvvjpaokmq5jciu.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

const CLIENT_ID = "PASTE_YOUR_GOOGLE_CLIENT_ID_HERE";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let token;
let tokenClient;

const loginScreen = document.getElementById("login-screen");
const app = document.getElementById("app");
const notesList = document.getElementById("notes-list");

/* ================= AUTH ================= */

window.onload = () => {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (!resp.access_token) {
        console.error("OAuth failed", resp);
        return;
      }

      token = resp.access_token;
      loginScreen.style.display = "none";
      app.classList.remove("hidden");
      listNotes();
    }
  });
};

document.getElementById("login-btn").onclick = () => {
  tokenClient.requestAccessToken();
};

document.getElementById("new-note").onclick = createNote;

/* ================= LIST NOTES ================= */

async function listNotes() {
  const url =
    "https://www.googleapis.com/drive/v3/files" +
    "?q=name%20contains%20'.note.json'" +
    "&spaces=drive" +
    "&fields=files(id,name)";

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("LIST FAILED:", err);
    alert("LIST FAILED — check console");
    return;
  }

  const data = await res.json();
  notesList.innerHTML = "";

  data.files.forEach(f => {
    const li = document.createElement("li");
    li.textContent = f.name;
    notesList.appendChild(li);
  });
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
        name: "Untitled.note.json",
        mimeType: "application/json"
      })
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("CREATE FAILED:", err);
    alert("CREATE FAILED — check console");
    return;
  }

  const file = await res.json();

  const upload = await fetch(
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

  if (!upload.ok) {
    const err = await upload.text();
    console.error("UPLOAD FAILED:", err);
    alert("UPLOAD FAILED — check console");
    return;
  }

  listNotes();
}

