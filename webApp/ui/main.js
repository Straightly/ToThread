// JS for new ToThread Todo UI
// Step 5.2: wire Google Identity Services into the skeleton.

const CLIENT_ID =
  "130905058858-07408ql1m1nonfoaftc415t0er256n5v.apps.googleusercontent.com";

// Simple holder for the current ID token; later steps will use this for /todos.
window.ToThreadAuth = {
  idToken: null,
};

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
  setAuthStatus("Signed in. Todos will be loaded in the next steps.");
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
