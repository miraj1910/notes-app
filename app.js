const CLIENT_ID = "1004015951669-j47ig0pr5bvihs6rpq1osp1hibf8evdh.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
let tokenClient;
let token;

/* ================= SAFE INIT ================= */

// wait until BOTH DOM and Google script are ready
function waitForGoogle() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.google && google.accounts && google.accounts.oauth2) {
        resolve();
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await waitForGoogle();

  const loginBtn = document.getElementById("login-btn");
  const loginScreen = document.getElementById("login-screen");
  const app = document.getElementById("app");
  const notesList = document.getElementById("notes-list");
  const newNoteBtn = document.getElementById("new-note");

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (!resp.access_token) {
        console.error("OAuth failed:", resp);
        alert("Login failed. Check console.");
        return;
      }

      token = resp.access_token;
      loginScreen.style.display = "none";
      app.classList.remove("hidden");
      listNotes();
    }
  });

  loginBtn.onclick = () => {
    tokenClient.requestAccessToken();
  };

  newNoteBtn.onclick = createNote;

  /* -------- LIST NOTES -------- */
  async function listNotes() {
    const url =
      "https://www.googleapis.com/drive/v3/files" +
      "?q=name%20contains%20'.note.json'" +
      "&spaces=drive" +
      "&fields=files(id,name)";

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      console.error("LIST FAILED", await res.text());
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

  /* -------- CREATE NOTE -------- */
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
      console.error("CREATE FAILED", await res.text());
      alert("CREATE FAILED — check console");
      return;
    }

    const file = await res.json();

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

    listNotes();
  }
});

