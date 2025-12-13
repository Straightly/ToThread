// ToThread backend API client for todos
// This module is intended to replace GitHub-based todo storage
// with calls to the ToThread Cloudflare backend (/todos).

class ToThreadAPI {
  constructor(config) {
    // config can optionally provide a base URL; default is same-origin
    this.baseUrl = config && config.BACKEND_BASE ? config.BACKEND_BASE : "";
    this.idToken = null;
  }

  setToken(idToken) {
    this.idToken = idToken;
  }

  ensureToken() {
    if (!this.idToken) {
      throw new Error("No Google ID token set for ToThreadAPI");
    }
  }

  async getTodos() {
    this.ensureToken();
    const res = await fetch(`${this.baseUrl}/todos`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.idToken}`,
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data && data.message ? data.message : `HTTP ${res.status}`;
      throw new Error(`ToThread GET /todos failed: ${msg}`);
    }

    // Expecting shape: { status: "ok", email, todos }
    return {
      email: data.email,
      todos: data.todos || [],
    };
  }

  async saveTodos(todos) {
    this.ensureToken();

    const res = await fetch(`${this.baseUrl}/todos`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.idToken}`,
      },
      body: JSON.stringify(todos),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data && data.message ? data.message : `HTTP ${res.status}`;
      throw new Error(`ToThread PUT /todos failed: ${msg}`);
    }

    // Expecting shape: { status: "ok", email, count }
    return data;
  }

  // Optional helper to mirror the original GitHubAPI.testConnection()
  async testConnection() {
    // Simple check: try GET /todos and ensure we get a 200.
    await this.getTodos();
    return true;
  }
}
