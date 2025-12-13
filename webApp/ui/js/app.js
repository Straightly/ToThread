// Initialize app for ToThread backend
// Instead of using GitHubAPI + PAT immediately on DOMContentLoaded,
// we wait for a Google ID token and then wire TodoManager to ToThreadAPI
// via the thin ToThreadFileAPI adapter.

let app;
let toThreadApi;

// Expose a global helper so the Google login flow can hand us an ID token.
window.ToThreadAuth = {
  setIdToken(idToken) {
    toThreadApi = new ToThreadAPI(CONFIG);
    toThreadApi.setToken(idToken);

    const fileApi = new ToThreadFileAPI(toThreadApi);
    const manager = new TodoManager(fileApi);

    // Placeholder writing manager for now; writing will be rewired later
    // when the new writing backend exists.
    const writingManager = null;

    app = new TodoUI(manager, writingManager);
  },
};
