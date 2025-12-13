// Thin adapter so TodoManager can use ToThreadAPI without internal changes.
// It mimics the GitHubAPI interface: getFile, updateFile, testConnection.

class ToThreadFileAPI {
  constructor(toThreadApi) {
    this.api = toThreadApi; // instance of ToThreadAPI
    // TodoManager tracks a SHA, but KV doesn't use it; we just keep a dummy.
    this.currentSha = "kv";
  }

  async getFile() {
    // ToThread getTodos returns { email, todos }
    const { todos } = await this.api.getTodos();
    const content = JSON.stringify({ todos }, null, 2);
    return {
      content,
      sha: this.currentSha,
    };
  }

  async updateFile(content, message, sha) {
    // content is the JSON string built by TodoManager: { todos: [...] }
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("Invalid JSON passed to ToThreadFileAPI.updateFile");
    }

    const todos = Array.isArray(parsed.todos) ? parsed.todos : [];
    const result = await this.api.saveTodos(todos);

    // Keep a stable dummy sha; KV doesn't have Git-style SHAs.
    this.currentSha = "kv";

    // Mimic GitHubAPI.updateFile by returning an object with content.sha
    return {
      content: {
        sha: this.currentSha,
        result,
      },
    };
  }

  async testConnection() {
    // Simply try to fetch todos; if it throws, caller will surface the error.
    await this.api.getTodos();
    return true;
  }
}
