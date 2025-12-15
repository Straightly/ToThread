// JS for new ToThread Todo UI
// Step 5.2: wire Google Identity Services into the skeleton.
// Step 5.3: add a frontend `/todos` client and basic todo state manager.

const CLIENT_ID =
  "130905058858-07408ql1m1nonfoaftc415t0er256n5v.apps.googleusercontent.com";

// Simple holder for the current ID token and todo state; later steps will
// wire this into full UI interactions.
window.ToThreadAuth = {
  idToken: null,
  todos: [],
  hasChanges: false,
};

async function fetchTodos() {
  if (!window.ToThreadAuth.idToken) {
    throw new Error("No ID token set; cannot load todos.");
  }

  const res = await fetch("/todos", {
    method: "GET",
    headers: {
      Authorization: "Bearer " + window.ToThreadAuth.idToken,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data && data.message ? data.message : `HTTP ${res.status}`;
    throw new Error(`Failed to load todos: ${msg}`);
  }

  const todos = Array.isArray(data.todos) ? data.todos : [];
  window.ToThreadAuth.todos = todos;
  window.ToThreadAuth.hasChanges = false;
  return todos;
}

// Very simple state helpers; UI wiring will be added in Step 5.4.
function markHasChanges() {
  window.ToThreadAuth.hasChanges = true;
}

function setAuthStatus(text) {
  const el = document.getElementById("auth-status");
  if (el) el.textContent = text;
}

window.handleCredentialResponse = (response) => {
  const idToken = response && response.credential;
  if (!idToken) {
    setAuthStatus("Failed to obtain ID token.");
    return;
  }

  window.ToThreadAuth.idToken = idToken;
  setAuthStatus("Signed in. Loading todos...");

  // Step 5.3: load todos immediately after sign-in.
  fetchTodos()
    .then((todos) => {
      const statusEl = document.getElementById("status");
      if (statusEl) {
        statusEl.textContent = `Loaded ${todos.length} todos.`;
      }
    })
    .catch((err) => {
      const statusEl = document.getElementById("status");
      if (statusEl) {
        statusEl.textContent = err.message || "Failed to load todos.";
      }
    });
};

window.addEventListener("DOMContentLoaded", () => {
  const statusEl = document.getElementById("status");
  if (statusEl) {
    statusEl.textContent =
      "UI skeleton loaded. Sign-in is wired; todos will be connected in later steps.";
  }

  // Initialize Google Identity Services when available.
  if (window.google && window.google.accounts && window.google.accounts.id) {
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: window.handleCredentialResponse,
    });

    const container = document.getElementById("g_id_signin");
    if (container) {
      google.accounts.id.renderButton(container, {
        theme: "outline",
        size: "large",
      });
    }

    google.accounts.id.prompt();
  } else {
    setAuthStatus("Google Identity Services not loaded yet.");
  }
});
