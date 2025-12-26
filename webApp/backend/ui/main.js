// JS for new ToThread Todo UI
// Step 5.2: wire Google Identity Services into the skeleton.
// Step 5.3: add a frontend `/todos` client and basic todo state manager.
// Step 5.4: implement todo list UI interactions (render, edit, tags, filters).

const CLIENT_ID =
  "130905058858-07408ql1m1nonfoaftc415t0er256n5v.apps.googleusercontent.com";

// Simple holder for the current ID token and todo state; later steps will
// wire this into full UI interactions.
window.ToThreadAuth = {
  idToken: null,
  todos: [],
  hasChanges: false,
  showCompleted: false,
  activeTag: null,
};

// Auto-save timers for draft protection
let rawWritingAutoSaveTimer = null;
let threadEntryAutoSaveTimer = null;

// Auto-save draft to localStorage
function autoSaveDraft(key, content) {
  localStorage.setItem(key, content);
  localStorage.setItem(key + '_timestamp', Date.now().toString());
}

// Restore draft from localStorage
function restoreDraft(key) {
  const draft = localStorage.getItem(key);
  const timestamp = localStorage.getItem(key + '_timestamp');
  
  if (draft && timestamp) {
    const age = Date.now() - parseInt(timestamp);
    const ageMinutes = Math.floor(age / 60000);
    return { draft, ageMinutes };
  }
  return null;
}

// Clear draft from localStorage
function clearDraft(key) {
  localStorage.removeItem(key);
  localStorage.removeItem(key + '_timestamp');
}

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

  // Backend currently returns either:
  // { status: "ok", email, todos: [ ... ] }
  // or
  // { status: "ok", email, todos: { todos: [ ... ] } }
  let todosSource = data && data.todos;
  if (todosSource && !Array.isArray(todosSource) && Array.isArray(todosSource.todos)) {
    todosSource = todosSource.todos;
  }

  const todos = Array.isArray(todosSource) ? todosSource : [];
  window.ToThreadAuth.todos = todos;
  window.ToThreadAuth.hasChanges = false;
  return todos;
}

function markHasChanges() {
  window.ToThreadAuth.hasChanges = true;
  const indicator = document.getElementById("changes-indicator");
  if (indicator) {
    indicator.textContent = "Unsaved changes";
  }
  const saveBtn = document.getElementById("save-changes");
  if (saveBtn) {
    saveBtn.disabled = false;
  }
}

function clearChanges() {
  window.ToThreadAuth.hasChanges = false;
  const indicator = document.getElementById("changes-indicator");
  if (indicator) {
    indicator.textContent = "";
  }
  const saveBtn = document.getElementById("save-changes");
  if (saveBtn) {
    saveBtn.disabled = true;
  }
}

function setAuthStatus(text) {
  const el = document.getElementById("auth-status");
  if (el) el.textContent = text;
}

function showAppSection() {
  const setup = document.getElementById("setup-section");
  const app = document.getElementById("app-section");
  if (setup) setup.style.display = "none";
  if (app) app.style.display = "block";
}

function parseTags(text) {
  const tags = new Set();
  const regex = /#(\w+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    tags.add(match[1]);
  }
  return Array.from(tags).sort();
}

function collectAllTags(todos) {
  const tags = new Set();
  todos.forEach((t) => {
    parseTags(t.text || "").forEach((tag) => tags.add(tag));
  });
  return Array.from(tags).sort();
}

function getVisibleTodos() {
  const { todos, showCompleted, activeTag } = window.ToThreadAuth;
  return todos.filter((t) => {
    if (!showCompleted && t.completed) return false;
    if (!activeTag) return true;
    const tags = parseTags(t.text || "");
    return tags.includes(activeTag);
  });
}

function renderTagFilters() {
  const container = document.getElementById("tag-filters");
  if (!container) return;

  const tags = collectAllTags(window.ToThreadAuth.todos);
  container.innerHTML = "";

  if (!tags.length) {
    const span = document.createElement("span");
    span.className = "note";
    span.textContent = "No tags yet";
    container.appendChild(span);
    return;
  }

  const label = document.createElement("span");
  label.className = "note";
  label.textContent = "Filter by tag:";
  container.appendChild(label);

  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "tag-chip" + (window.ToThreadAuth.activeTag === tag ? " tag-chip-active" : "");
    btn.textContent = `#${tag}`;
    btn.addEventListener("click", () => {
      if (window.ToThreadAuth.activeTag === tag) {
        window.ToThreadAuth.activeTag = null;
      } else {
        window.ToThreadAuth.activeTag = tag;
      }
      renderTagFilters();
      renderTodoList();
    });
    container.appendChild(btn);
  });
}

function createTodoRow(todo, index) {
  const row = document.createElement("div");
  row.className = "todo-row" + (todo.completed ? " todo-row-completed" : "");

  const left = document.createElement("div");
  left.className = "todo-left";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = !!todo.completed;
  checkbox.addEventListener("change", () => {
    todo.completed = checkbox.checked;
    markHasChanges();
    renderTodoList();
  });

  const textInput = document.createElement("input");
  textInput.type = "text";
  textInput.value = todo.text || "";
  textInput.className = "todo-text-input";
  textInput.addEventListener("input", () => {
    todo.text = textInput.value;
    markHasChanges();
    renderTagFilters();
  });

  left.appendChild(checkbox);
  left.appendChild(textInput);

  const right = document.createElement("div");
  right.className = "todo-right";

  const tags = parseTags(todo.text || "");
  const tagsContainer = document.createElement("div");
  tagsContainer.className = "todo-tags";
  tags.forEach((tag) => {
    const span = document.createElement("span");
    span.className = "tag-chip";
    span.textContent = `#${tag}`;
    tagsContainer.appendChild(span);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-secondary btn-sm";
  deleteBtn.textContent = "✕";
  deleteBtn.title = "Delete";
  deleteBtn.addEventListener("click", () => {
    const { todos } = window.ToThreadAuth;
    const realIndex = todos.indexOf(todo);
    if (realIndex !== -1) {
      todos.splice(realIndex, 1);
      markHasChanges();
      renderTagFilters();
      renderTodoList();
    }
  });

  right.appendChild(tagsContainer);
  right.appendChild(deleteBtn);

  row.appendChild(left);
  row.appendChild(right);

  return row;
}

function renderTodoList() {
  const listEl = document.getElementById("todo-list");
  if (!listEl) return;

  const visible = getVisibleTodos();
  listEl.innerHTML = "";

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "note";
    empty.textContent =
      window.ToThreadAuth.todos.length === 0
        ? "No todos yet. Add one above."
        : "No todos match the current filter.";
    listEl.appendChild(empty);
    return;
  }

  visible.forEach((todo, index) => {
    const row = createTodoRow(todo, index);
    listEl.appendChild(row);
  });
}

function wireInteractions() {
  const addInput = document.getElementById("new-todo");
  const addBtn = document.getElementById("add-todo-btn");
  const showCompletedToggle = document.getElementById("show-completed-toggle");
  const saveBtn = document.getElementById("save-changes");
  const refreshBtn = document.getElementById("refresh-file");
  const saveWritingBtn = document.getElementById("save-writing-btn");
  const rawWritingText = document.getElementById("raw-writing-text");
  const writingStatus = document.getElementById("writing-status");

  if (addBtn && addInput) {
    const add = () => {
      const text = (addInput.value || "").trim();
      if (!text) return;
      window.ToThreadAuth.todos.unshift({ text, completed: false });
      addInput.value = "";
      markHasChanges();
      renderTagFilters();
      renderTodoList();
    };

    addBtn.addEventListener("click", add);
    addInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        add();
      }
    });
  }

  if (showCompletedToggle) {
    showCompletedToggle.addEventListener("change", () => {
      window.ToThreadAuth.showCompleted = showCompletedToggle.checked;
      renderTodoList();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      if (!window.ToThreadAuth.idToken) {
        alert("Not signed in.");
        return;
      }

      saveBtn.disabled = true;
      const statusEl = document.getElementById("status");
      if (statusEl) statusEl.textContent = "Saving...";

      try {
        const res = await fetch("/todos", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + window.ToThreadAuth.idToken,
          },
          body: JSON.stringify(window.ToThreadAuth.todos),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = data && data.message ? data.message : `HTTP ${res.status}`;
          throw new Error(msg);
        }

        clearChanges();
        if (statusEl) statusEl.textContent = "Saved todos.";
      } catch (err) {
        if (statusEl) {
          statusEl.textContent =
            "Failed to save todos: " + (err && err.message ? err.message : String(err));
        }
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      if (!window.ToThreadAuth.idToken) {
        alert("Not signed in.");
        return;
      }

      if (window.ToThreadAuth.hasChanges) {
        const proceed = window.confirm(
          "You have unsaved changes. Refreshing will discard them. Continue?"
        );
        if (!proceed) return;
      }

      const statusEl = document.getElementById("status");
      if (statusEl) statusEl.textContent = "Refreshing...";

      try {
        const todos = await fetchTodos();
        if (statusEl) statusEl.textContent = `Loaded ${todos.length} todos.`;
        clearChanges();
        renderTagFilters();
        renderTodoList();
      } catch (err) {
        if (statusEl) {
          statusEl.textContent =
            "Failed to refresh todos: " + (err && err.message ? err.message : String(err));
        }
      }
    });
  }

  if (saveWritingBtn && rawWritingText) {
    // Auto-save raw writing to localStorage as user types
    rawWritingText.addEventListener('input', (e) => {
      clearTimeout(rawWritingAutoSaveTimer);
      rawWritingAutoSaveTimer = setTimeout(() => {
        const content = e.target.value;
        if (content.trim()) {
          autoSaveDraft('tothread_raw_writing_draft', content);
        }
      }, 2000); // 2 seconds debounce
    });

    saveWritingBtn.addEventListener("click", async () => {
      if (!window.ToThreadAuth.idToken) {
        alert("Not signed in.");
        return;
      }

      const content = (rawWritingText.value || "").trim();
      if (!content) {
        if (writingStatus) writingStatus.textContent = "Please enter some content.";
        return;
      }

      saveWritingBtn.disabled = true;
      if (writingStatus) writingStatus.textContent = "Saving raw writing...";

      try {
        const res = await fetch("/writings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + window.ToThreadAuth.idToken,
          },
          body: JSON.stringify({ content }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = data && data.message ? data.message : `HTTP ${res.status}`;
          throw new Error(msg);
        }

        const savedPath = data && data.path ? data.path : "(unknown path)";
        if (writingStatus) writingStatus.textContent = `Saved: ${savedPath}`;
        rawWritingText.value = "";
        
        // Clear draft after successful save
        clearDraft('tothread_raw_writing_draft');
      } catch (err) {
        if (writingStatus) {
          writingStatus.textContent =
            "Failed to save raw writing: " +
            (err && err.message ? err.message : String(err)) +
            " (Draft preserved locally)";
        }
      } finally {
        saveWritingBtn.disabled = false;
      }
    });
  }
}

// Thread journal state
window.ToThreadAuth.threads = [];
window.ToThreadAuth.selectedThread = null;

async function fetchThreads() {
  if (!window.ToThreadAuth.idToken) {
    throw new Error("No ID token set; cannot load threads.");
  }

  const res = await fetch("/threads", {
    method: "GET",
    headers: {
      Authorization: "Bearer " + window.ToThreadAuth.idToken,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data && data.message ? data.message : `HTTP ${res.status}`;
    throw new Error(`Failed to load threads: ${msg}`);
  }

  window.ToThreadAuth.threads = data.threads || [];
  return window.ToThreadAuth.threads;
}

async function fetchThreadContent(tag) {
  if (!window.ToThreadAuth.idToken) {
    throw new Error("No ID token set; cannot load thread.");
  }

  const res = await fetch(`/threads/${encodeURIComponent(tag)}`, {
    method: "GET",
    headers: {
      Authorization: "Bearer " + window.ToThreadAuth.idToken,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data && data.message ? data.message : `HTTP ${res.status}`;
    throw new Error(`Failed to load thread: ${msg}`);
  }

  return data;
}

async function saveThreadEntry(tag, content) {
  if (!window.ToThreadAuth.idToken) {
    throw new Error("No ID token set; cannot save entry.");
  }

  const res = await fetch(`/threads/${encodeURIComponent(tag)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + window.ToThreadAuth.idToken,
    },
    body: JSON.stringify({ content }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data && data.message ? data.message : `HTTP ${res.status}`;
    throw new Error(`Failed to save entry: ${msg}`);
  }

  return data;
}

function renderThreadTags() {
  const container = document.getElementById("thread-tags");
  if (!container) return;

  if (window.ToThreadAuth.threads.length === 0) {
    container.innerHTML = '<span class="no-threads">No threads yet. Create one in your repo!</span>';
    return;
  }

  container.innerHTML = "";
  window.ToThreadAuth.threads.forEach((tag) => {
    const chip = document.createElement("button");
    chip.className = "thread-tag-chip";
    chip.textContent = tag;
    if (window.ToThreadAuth.selectedThread === tag) {
      chip.classList.add("selected");
    }
    chip.addEventListener("click", () => selectThread(tag));
    container.appendChild(chip);
  });
}

async function selectThread(tag) {
  window.ToThreadAuth.selectedThread = tag;
  renderThreadTags();

  const titleEl = document.getElementById("thread-title");
  const contentEl = document.getElementById("thread-content");
  const statusEl = document.getElementById("thread-status");
  const viewerContainer = document.getElementById("thread-viewer-container");
  const entryText = document.getElementById("thread-entry-text");

  if (titleEl) titleEl.textContent = `📔 ${tag}`;
  if (viewerContainer) viewerContainer.style.display = "block";
  if (statusEl) statusEl.textContent = "Loading...";

  // Restore draft for this thread if exists
  if (entryText) {
    const draftKey = `tothread_thread_entry_draft_${tag}`;
    const draftData = restoreDraft(draftKey);
    if (draftData && draftData.draft) {
      const shouldRestore = confirm(
        `Found unsaved entry for this thread from ${draftData.ageMinutes} minute(s) ago. Restore it?`
      );
      if (shouldRestore) {
        entryText.value = draftData.draft;
      } else {
        clearDraft(draftKey);
      }
    }
  }

  try {
    const data = await fetchThreadContent(tag);
    const lines = data.lines || [];
    if (contentEl) {
      contentEl.textContent = lines.join("\n") || "(Empty thread)";
    }
    if (statusEl) {
      statusEl.textContent = `Showing last ${lines.length} lines (${data.totalLines || 0} total)`;
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = err.message || "Failed to load thread";
  }
}

function wireThreadInteractions() {
  const saveBtn = document.getElementById("save-thread-entry-btn");
  const entryText = document.getElementById("thread-entry-text");
  const statusEl = document.getElementById("thread-status");
  const refreshBtn = document.getElementById("refresh-thread-btn");

  if (saveBtn && entryText) {
    // Auto-save thread entry to localStorage as user types
    entryText.addEventListener('input', (e) => {
      clearTimeout(threadEntryAutoSaveTimer);
      threadEntryAutoSaveTimer = setTimeout(() => {
        const content = e.target.value;
        if (content.trim() && window.ToThreadAuth.selectedThread) {
          const draftKey = `tothread_thread_entry_draft_${window.ToThreadAuth.selectedThread}`;
          autoSaveDraft(draftKey, content);
        }
      }, 2000); // 2 seconds debounce
    });

    saveBtn.addEventListener("click", async () => {
      if (!window.ToThreadAuth.selectedThread) {
        alert("Please select a thread first.");
        return;
      }

      const content = entryText.value.trim();
      if (!content) {
        alert("Please enter some content.");
        return;
      }

      if (statusEl) statusEl.textContent = "Saving...";

      try {
        await saveThreadEntry(window.ToThreadAuth.selectedThread, content);
        entryText.value = "";
        if (statusEl) statusEl.textContent = "Entry saved!";
        
        // Clear draft after successful save
        const draftKey = `tothread_thread_entry_draft_${window.ToThreadAuth.selectedThread}`;
        clearDraft(draftKey);
        
        // Refresh thread content
        await selectThread(window.ToThreadAuth.selectedThread);
      } catch (err) {
        if (statusEl) statusEl.textContent = (err.message || "Failed to save entry") + " (Draft preserved locally)";
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      if (window.ToThreadAuth.selectedThread) {
        await selectThread(window.ToThreadAuth.selectedThread);
      }
    });
  }
}

window.handleCredentialResponse = (response) => {
  const idToken = response && response.credential;
  if (!idToken) {
    setAuthStatus("Failed to obtain ID token.");
    return;
  }

  window.ToThreadAuth.idToken = idToken;
  localStorage.setItem('google_id_token', idToken);
  setAuthStatus("Signed in. Loading todos...");

  // Step 5.3: load todos immediately after sign-in.
  fetchTodos()
    .then((todos) => {
      const statusEl = document.getElementById("status");
      if (statusEl) {
        statusEl.textContent = `Loaded ${todos.length} todos.`;
      }

      showAppSection();
      clearChanges();
      renderTagFilters();
      renderTodoList();
      wireInteractions();

      // Load threads
      return fetchThreads();
    })
    .then((threads) => {
      renderThreadTags();
      wireThreadInteractions();
    })
    .catch((err) => {
      const statusEl = document.getElementById("status");
      if (statusEl) {
        statusEl.textContent = err.message || "Failed to load todos.";
      }
    });
};

function initializeGoogleIdentity() {
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
    return true;
  }
  return false;
}

function waitForGoogleIdentity() {
  let attempts = 0;
  const maxAttempts = 20;
  const interval = 250;

  const checkAndInit = () => {
    attempts++;
    
    if (initializeGoogleIdentity()) {
      return;
    }

    if (attempts >= maxAttempts) {
      setAuthStatus("Failed to load Google Identity Services. Please refresh the page.");
      return;
    }

    setAuthStatus(`Loading sign-in... (${attempts}/${maxAttempts})`);
    setTimeout(checkAndInit, interval);
  };

  checkAndInit();
}

window.addEventListener("DOMContentLoaded", () => {
  const statusEl = document.getElementById("status");
  if (statusEl) {
    statusEl.textContent =
      "UI skeleton loaded. Sign-in is wired; todos will be connected in later steps.";
  }

  // Restore raw writing draft if exists
  const rawWritingText = document.getElementById("raw-writing-text");
  if (rawWritingText) {
    const draftData = restoreDraft('tothread_raw_writing_draft');
    if (draftData) {
      const shouldRestore = confirm(
        `Found unsaved raw writing from ${draftData.ageMinutes} minute(s) ago. Restore it?`
      );
      if (shouldRestore) {
        rawWritingText.value = draftData.draft;
      } else {
        clearDraft('tothread_raw_writing_draft');
      }
    }
  }

  waitForGoogleIdentity();
});
