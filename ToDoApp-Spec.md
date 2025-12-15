# ToDoApp Spec — ToThread-Native Web UI

This document specifies a **new** Todo web UI for the ToThread backend, designed from the historical prompts and current goals, without carrying forward legacy GitHub/PAT constraints.

The backend already exists as a Cloudflare Worker with:
- Auth via **Google ID token** and KV-based allowlist.
- `/todos` `GET` and `PUT` endpoints backed by `TOTHREAD_KV` (`todos/main`).
- (Future) Writing APIs to be added later.

The goal is a clean ToThread-native UI that:
- Uses **Google login only** (no GitHub PAT).
- Reads/writes todos via `/todos`.
- Leaves raw writing either disabled or clearly “not yet implemented” until the new writing backend exists.

---

## 1. High-Level Behavior

### 1.1 Primary user goal

- User signs in with Google.
- If their email is on the allowlist, they see their shared todo list.
- User can:
  - View active and completed todos.
  - Add new todos.
  - Edit existing todos.
  - Toggle completed state.
  - Filter by tags (#tag syntax inside text).
  - Persist all changes via `/todos`.

### 1.2 Storage model

- The backend owns `todos/main` in KV.
- The UI treats the todo list as a **single shared list** per environment (no per-user partitioning right now).
- Each todo item is an object with at least:
  - `id` (number or string; unique within the list).
  - `text` (string; full user-entered text, including inline tags like `#work`).
  - `completed` (boolean).
  - Optional fields the original TodoApp used (e.g., `tags`, `createdAt`, `updatedAt`).
- `/todos`:
  - `GET /todos` → `{ status: "ok", email, todos: [...] }`.
  - `PUT /todos` → expects an array of todo objects and returns `{ status: "ok", email, count }`.

### 1.3 Auth behavior

- Frontend uses **Google Identity Services** (GIS) with the configured Web Client ID.
- On sign-in:
  - GIS returns an ID token (`credential`).
  - The UI passes that ID token to the backend using `Authorization: Bearer <id_token>`.
  - The backend verifies:
    - Token validity and audience (`GOOGLE_CLIENT_ID`).
    - Email is in the KV allowlist.
- If verification fails:
  - The backend returns an error JSON.
  - The UI shows a clear message (e.g., "You are not authorized to use this app").

---

## 2. Page Structure & UX

### 2.1 Layout

Single-page app, roughly:

- **Header**
  - Title: "Attention - Todo Manager".
  - Subtitle: "Manage your todos".

- **Sign-in area (top section)**
  - Text: "Sign in with Google".
  - Google sign-in button rendered via GIS.
  - Status text (e.g., "Not signed in", "Signed in. Loading todos...", error messages).

- **App area (main section)**
  - Initially hidden until sign-in succeeds and todos have loaded.
  - Contains:
    - **Controls bar**
      - Label for list (e.g., "Managing: ToDos/List.json" or equivalent, purely cosmetic).
      - `Refresh` button → re-fetch `/todos`.
      - Optional `Logout` button (if we expose GIS sign-out / account switch behavior).
      - Global status line for operations.
    - **New todo input area**
      - Single-line text input: placeholder like "What needs attention? Add tags like #work #idea".
      - `Add` button or Enter key to add.
    - **Tag filters area**
      - A dynamic list of tag chips (e.g., `#work`, `#home`, etc.).
      - Clicking a chip toggles its selection and filters the displayed todos.
    - **Show completed toggle**
      - Checkbox + label: "Show Completed".
      - When off (default): hide completed items.
      - When on: show all items.
    - **Todo list**
      - One row per todo:
        - Checkbox to toggle completed.
        - Text (label) for the todo.
        - Tags (derived from `#` tokens in the text), rendered as chips.
        - Double-click on text to edit inline.
    - **Actions footer**
      - `Save Changes` button.
      - Changes indicator:
        - "⚠️ Unsaved changes" when local state differs from last-saved snapshot.
        - "✅ All changes saved" when in sync.

- **Raw writing section (optional UI)**
  - Heading: "Capture Raw Writing".
  - Textarea for free-form text.
  - Save button **disabled or stubbed** with a message:
    - E.g., clicking shows: "Raw writing save is not yet implemented in this version.".

### 2.2 Visual style

- Keep the overall minimalist style of the original Attention TodoApp:
  - Light background, simple cards for todos.
  - Clear visual distinction between active vs completed items (e.g., strikethrough + faded color for completed).
  - Tag chips with subtle background color.
- Mobile-friendly layout (single column, responsive widths).

---

## 3. Interaction & State Model

### 3.1 Local state

The UI maintains local state roughly equivalent to the original `TodoManager`:

- `todos`: array of todo objects as last loaded or edited.
- `hasChanges`: boolean indicating unsaved changes.
- `selectedTags`: set of active tag filters.
- `showCompleted`: boolean toggle.

### 3.2 Loading flow

1. Page loads.
2. GIS script initializes, renders sign-in button.
3. User clicks sign-in and completes Google flow.
4. GIS callback hands an ID token to the page.
5. Page calls `ToThreadAuth.setIdToken(idToken)` (or equivalent initialization entry point):
   - Creates a backend client bound to this token.
   - Instantiates the todo manager/UI.
6. The UI immediately:
   - Shows "Loading..." in status bar.
   - Calls `GET /todos` with the token.
   - On success:
     - Sets `todos` state.
     - Derives tags.
     - Renders list.
     - Shows "Loaded" status.
   - On failure:
     - Shows error message from backend.
     - Leaves app UI hidden or in an error state.

### 3.3 Editing behavior

- **Add todo**
  - User types text and presses Enter or clicks `Add`.
  - A new todo object is appended with:
    - `id` = current timestamp or simple increment.
    - `text` = entered text.
    - `completed` = `false`.
    - `tags` = parsed from `#tag` tokens.
    - `createdAt` = timestamp (optional).
  - `hasChanges = true`.

- **Toggle completed**
  - Checkbox change flips `completed`.
  - `hasChanges = true`.

- **Inline edit**
  - Double-click todo text to switch to an `<input>`.
  - Hitting Enter or losing focus commits change if text changed.
  - New `tags` re-parsed from edited text.
  - `hasChanges = true`.

- **Tag filters**
  - Tags extracted from `todos` (unique, sorted).
  - Clicking a tag chip toggles it in `selectedTags`.
  - The list filter is (pseudo):

    ```js
    let displayTodos = showCompleted ? todos : todos.filter(t => !t.completed);
    if (selectedTags.size > 0) {
      displayTodos = displayTodos.filter(todo =>
        todo.tags && todo.tags.some(tag => selectedTags.has(tag))
      );
    }
    ```

### 3.4 Save behavior

- `Save Changes`:
  - Disabled when `hasChanges === false`.
  - When clicked:
    - Button shows "Saving...".
    - `PUT /todos` is called with the entire `todos` array.
    - On success:
      - `hasChanges = false`.
      - Status: "✅ Changes saved".
    - On error:
      - Status: error message from backend.
      - `hasChanges` remains `true`.

- Auto-save is **not required**; explicit save is fine.

### 3.5 Refresh behavior

- `Refresh` button:
  - Calls `GET /todos` again and replaces local state with server data.
  - If `hasChanges` is `true`, either:
    - Confirm with user before overwriting, or
    - Document that refresh discards unsaved changes.

---

## 4. Error Handling & Edge Cases

### 4.1 Auth errors

- If `/todos` returns 401/403 (invalid token or not allowlisted):
  - Show a clear message in the auth status area, e.g.:
    - "You are not authorized to access this app."
  - Optionally provide a link or text explaining allowlist.

### 4.2 Network / backend errors

- On `GET /todos` failure:
  - Show: "❌ Failed to load todos: <message>".
  - Keep app section hidden or show an empty/error state.

- On `PUT /todos` failure:
  - Show: "❌ Failed to save changes: <message>".
  - Keep `hasChanges = true` so user knows state is unsaved.

### 4.3 Empty states

- No todos:
  - Show a friendly message like "No active todos. Add one above.".

- No tags:
  - Tag filters area shows hint: "Add hashtags to your todos like #work #idea to filter by tags.".

---

## 5. Raw Writing (Future)

The new UI will:

- Keep the **visual raw writing section** (textarea + button) so the layout looks similar to the original app.
- For now:
  - Clicking "Save Raw Writing" either:
    - Shows a message: "Raw writing save is not yet implemented in this version.", or
    - Is disabled.
- Once the writing backend APIs are defined (e.g., `POST /writings`):
  - The UI can be extended to:
    - Auto-save todos first if there are unsaved changes.
    - Call the new writings API with the textarea content.
    - Show success/failure statuses similar to the original GitHub-backed behavior.

---

## 6. Non-Goals / Explicitly Dropped Features

Based on your new plan and prompts, this spec **intentionally does not** include:

- Any dependency on **GitHub PAT** or GitHub repo contents.
- GitHub-specific commit messages or SHA tracking.
- The old GitHub-based raw writing file naming scheme.
- A mode switch between GitHub and ToThread; the new UI is **Cloudflare/ToThread only**.

---

## 7. Implementation Notes (for future coding)

- Frontend stack:
  - Plain HTML/CSS/JS is sufficient (no framework required).
  - Can reuse parts of the original TodoApp’s DOM structure and CSS where convenient, but not required.
- Backend integration:
  - Base URL for `/todos` should be same-origin (Worker serves this UI at `/`).
  - Use `fetch('/todos', { headers: { Authorization: 'Bearer ' + idToken } })` for calls.
- Testing strategy:
  - Local: `wrangler dev` + Google ID token with local origin.
  - Deployed: workers.dev URL with production allowlist.

This spec should be enough to implement a fresh `ToThread/webApp/ui` from scratch, using your existing backend and Google login setup, without carrying forward the migration complexity of the original GitHub-based TodoApp.
