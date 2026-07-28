# ToThread Backend Project Plan (Cloudflare + KV + Google Login)

## Project Goal

Build a Cloudflare-hosted backend for ToThread that:

- Provides APIs to **update the ToDo list** (current `ToDos/List.json` equivalent).
- Provides APIs to **add raw writings** (current `Writing/RawWrittings/` equivalent).
- Uses **Google login** to authenticate the user.
- Authorizes access only for a small **allowlist of Google accounts** stored in **Cloudflare KV** under a single key.

This backend will eventually replace the GitHub-API-based storage model used by the existing ToDoApp and raw writing capture.

**Current focus:** Threaded journal and UI improvements. Raw writing capture and todo APIs are fully restored and deployed. Draft auto-save is live.

---

## Assumptions & Constraints

- **Hosting:** Cloudflare Workers (optionally with Cloudflare Pages later).
- **State:** Cloudflare KV for todos and the Google-accounts allowlist. Raw writings will be stored in a Git repository (Gitea) during the current phase.
- **Auth provider:** Google (OAuth2 / OpenID Connect via an identity flow that runs in the browser and passes tokens to the Worker).
- **Clients:**
  - Existing browser-based ToDoApp frontend (will be adapted later to call this backend).
  - Potential future clients (e.g., iPhone app) can reuse the same APIs.

---

## Phase 1 — Minimal Cloudflare Backend Skeleton

**Goal:** Have a deployed Cloudflare Worker reachable on the internet with a simple health endpoint.

1. **Step 1.1 — Create Worker project for ToThread backend** ✅
  - Worker project created and deployed.
  - `wrangler.toml` configured.

2. **Step 1.2 — Implement `/health` endpoint** ✅
  - `/health` endpoint returns expected JSON.
  - Verified via browser/curl.

3. **Step 1.3 — Wire KV namespace (placeholder)** ✅
  - KV namespace defined and bound.
  - Confirmed with get/put test.

**Exit criteria:**
- Worker deployed and reachable at a known URL. ✅
- `/health` returns `200 OK` with the expected JSON. ✅
- KV namespace is configured and accessible from the Worker. ✅

---

## Phase 2 — KV Data Model for Todos, Writings, and Allowlist

**Goal:** Decide how data will be laid out in KV and create helper functions to read/write it.

1. **Step 2.1 — Design KV keys and value shapes**
   - **Todos:**
     - Single key, e.g. `todos/main` storing a JSON document similar to `ToDos/List.json`.
   - **Raw writings:**
     - Either a single collection key (e.g., `writings/index`) that tracks individual entries, or per-writing keys like `writings/<ISO-timestamp-or-id>`.
   - **Google account allowlist:**
     - Single key, e.g. `auth/allowlist`, value: JSON array of allowed Google email addresses.

2. **Step 2.2 — Implement KV helper module**
   - Add Worker-side functions:
     - `getTodos()`, `saveTodos(todos)`
     - `addWriting(writingPayload)` (and any indexing you want)
     - `getAllowlist()`, `isAllowed(email)`

3. **Step 2.3 — Seed initial KV data (manual)**
   - Using `wrangler kv:key put` or the Cloudflare dashboard, create:
     - `auth/allowlist` with your own Google account (and any others) as a JSON array.
     - Optionally, seed `todos/main` with your current todo list snapshot.

**Exit criteria:**
- Written spec of keys and value schemas. ✅
- KV helper functions implemented and unit-tested within the Worker. ✅
- Allowlist key exists in KV with at least one valid Google account. ✅

---

## Phase 3 — Google Login & Authorization

**Goal:** Require Google login and only allow requests from accounts present in the KV allowlist.

0. **Step 3.0 — Obtain Google OAuth Client ID(s)**
   - In Google Cloud Console:
     - Create (or reuse) a project for ToThread (can share with existing PaceLeader project if appropriate).
     - Configure OAuth consent screen as needed (internal/personal use).
     - Create a **Web application** OAuth 2.0 Client ID for the browser-based ToThread web app.
   - Record the **Client ID** value; this will be used as the expected audience when verifying Google ID tokens in the Worker.
   - Later, create an **iOS application** client ID (with the iPhone app’s bundle ID) when you wire up the native app.

1. **Step 3.1 — Choose authentication flow**
   - Decide whether the frontend will:
     - Use **Google Identity Services** / OAuth2 in the browser and send ID tokens to the Worker, or
     - Redirect to Google from the Worker and handle the OAuth callback.
   - For simplicity, plan on: **frontend obtains a Google ID token**, Worker verifies it.

2. **Step 3.2 — Implement token validation in Worker**
   - In the Worker:
     - Accept an `Authorization: Bearer <id_token>` header (or similar).
     - Validate the Google ID token (issuer, audience, signature, expiration).
     - Extract the user’s email from the token claims.

3. **Step 3.3 — Enforce allowlist using KV**
   - On each protected endpoint:
     - Call `isAllowed(email)` using KV.
     - If not allowed, return `403 Forbidden` with a clear JSON error.

4. **Step 3.4 — Add `/auth/debug` endpoint (optional)**
   - Provide a simple endpoint that echoes the authenticated email and whether it’s allowed, for troubleshooting.

**Exit criteria:**
- Backend reliably verifies Google ID tokens. ✅
- Rejects non-allowed users based on KV allowlist. ✅
- Happy-path tests show allowed account can reach protected endpoints; others cannot. ✅

---

## Phase 4 — Todo Management APIs

**Goal:** Provide authenticated endpoints to load and update the todo list stored in KV.

1. **Step 4.1 — Implement `GET /todos`**
   - Authenticated + allowlisted only.
   - Reads `todos/main` from KV and returns the JSON structure the frontend expects.

2. **Step 4.2 — Implement `PUT /todos` (or `POST /todos/update`)**
   - Authenticated + allowlisted.
   - Accepts a JSON body with the full todo list (or a patch, depending on design).
   - Validates shape minimally.
   - Writes back to `todos/main` in KV.

3. **Step 4.3 — Define simple error model**
   - Standardize response shape for errors (e.g., `{ "error": "message", "code": "..." }`).

4. **Step 4.4 — Basic rate limiting / safety (optional)**
   - Consider simple protections (e.g., reject bodies larger than N bytes).

**Exit criteria:**
- `GET /todos` and `PUT /todos` work with valid Google token, round-trip to KV. ✅
- Unauthorized or non-allowlisted requests are rejected. ✅

---

## Phase 5 — Restore Raw Writing Capture Using Git Repo (Gitea)

**Goal:** Make the “raw writing” path work again by committing a new markdown file into your self-hosted Git repository (Gitea), while keeping `/todos` KV-backed.

- [X] **Step 5.1 — Confirm target repo and folder layout**
   - Decide which repo will store writings (e.g., `attention` on Gitea).
   - Confirm destination path for new files: `Writing/RawWrittings/<generated>.md`.
   - Confirm default branch name (e.g., `main`).

- [X] **Step 5.2 — Decide write mechanism (Gitea API vs git push)**
   - Preferred for Workers: **Gitea HTTP API** (create/update file with commit message).
   - Alternative: server-side `git` is not available on Workers (so avoid shelling out).

- [X] **Step 5.3 — Add Worker configuration for Git repo writes**
   - Add non-secret vars in `wrangler.toml`:
     - `GIT_BASE_URL` (e.g., `https://146.235.203.97`)
     - `GIT_OWNER` (e.g., `zhian.job`)
     - `GIT_REPO` (e.g., `attention`)
     - `GIT_BRANCH` (e.g., `main`)
   - Add a secret for the token (e.g., `GIT_TOKEN_ATTENTION`) via `wrangler secret put`.

- [X] **Step 5.4 — Configure Public Domain and SSL for Gitea**
   - **Goal:** Secure the Gitea server with a valid SSL certificate so Cloudflare Workers can communicate with it (Cloudflare does not support self-signed certs).
   - Register a domain (or use a subdomain).
   - Point DNS to the Gitea server IP (`146.235.203.97`).
   - Configure a reverse proxy (Nginx/Caddy) or Gitea with a valid Let's Encrypt certificate.
   - **Verify:** `curl https://<your-domain>/api/v1/...` works without `--insecure`.

- [X] **Step 5.5 — Implement a minimal Gitea client in the Worker**
   - Implement Worker-side helper functions:
     - `giteaRequest(path, method, body)`
     - `createOrUpdateFile({ path, contentBase64, message, branch })`
   - Keep it narrowly scoped to “create a new file with commit message”.

- [X] **Step 5.6 — Add `POST /writings` endpoint (Git-backed)**
   - Authenticated + allowlisted.
   - Input JSON: `{ content: string }` (plus optional `title/tags`).
   - Server generates filename (timestamp + slug) and produces markdown body (can reuse the ToDoApp template behavior).
   - Worker commits the file to the repo via the Gitea API.
   - Response: `{ status: "ok", path, commitId }` (or equivalent).

- [X] **Step 5.7 — Add a debug endpoint for verifying connectivity (optional)**
   - Example: `GET /debug/git` (allowlisted) returns `{ status: "ok" }` if token works.
   - Keep secrets out of responses.

- [X] **Step 5.8 — Wire the frontend raw-writing UI to `POST /writings`**
   - Update the UI “Save Raw Writing” button to call the Worker endpoint.
   - Confirm: a new file appears in `Writing/RawWrittings/` in the Gitea repo.

**Exit criteria:**
- Raw writing entered in web UI results in committed file in Gitea repo under `Writing/RawWrittings/`. ✅
- `/todos` continues working with KV (no regression). ✅

---

## Phase 6 — Threaded Journal Capability

**Goal:** Extend the raw writing feature to support tag-based threaded journals. Each tag corresponds to a journal file in the `Threads/` folder. Users can select a tag, view the last 30 lines of that journal, and append timestamped entries.

**Key Features:**
- Display a list of journal tags (threads) in the UI.
- Clicking a tag loads and displays the last 30 lines from `Threads/<tag>.md`.
- Text entered in the journal editor is appended to the selected thread file with a timestamp.
- All operations use the Gitea API (similar to raw writings).

**Estimated Total Time:** ~8-10 hours

### Steps:

- [X] **Step 6.1 — Design thread journal data model and file structure** *(0.5 hours)*
  - **Decision:** Thread files stored in `Writing/Threads/<tag>.md` (e.g., `Writing/Threads/work.md`, `Writing/Threads/personal.md`).
  - **Decision:** Markdown format for journal entries: ISO timestamp header + content.
  - **Decision:** Tags are discovered dynamically by listing filenames in `Writing/Threads/` folder via Gitea API. User creates new tags by adding files directly to the repo.

- [X] **Step 6.2 — Implement backend `GET /threads` endpoint** *(1 hour)*
  - Authenticated + allowlisted.
  - Returns a JSON array of available thread tags by listing files in `Writing/Threads/` folder via Gitea API.
  - Example response: `{ "threads": ["work", "personal", "ideas"] }`.

- [X] **Step 6.3 — Implement backend `GET /threads/:tag` endpoint** *(1.5 hours)*
  - Authenticated + allowlisted.
  - Fetches the content of `Writing/Threads/<tag>.md` from Gitea.
  - Parses the file and returns the last 30 lines.
  - Returns JSON: `{ "tag": "work", "lines": [...], "fullContent": "...", "totalLines": N }`.
  - Handle case where thread file doesn't exist yet (return empty).

- [X] **Step 6.4 — Implement backend `POST /threads/:tag` endpoint** *(1.5 hours)*
  - Authenticated + allowlisted.
  - Accepts JSON: `{ "content": "..." }`.
  - Fetches current `Writing/Threads/<tag>.md` content (or creates new file if doesn't exist).
  - Appends new entry with ISO timestamp header (`## 2025-12-23T07:45:00.498Z`) and content.
  - Commits updated file to Gitea with message like "Add entry to <tag> thread".
  - Returns success response with commit info.
  - **Tested:** Successfully appended to DevSyncMeeting thread.

- [X] **Step 6.5 — Add thread journal UI section to the web app** *(1.5 hours)*
  - Add a new "Threaded Journals" section in `backend/ui/index.html`.
  - Display list of thread tags as clickable buttons/chips.
  - Add a text area for viewing/editing the selected thread.
  - Add "Save Entry" button to append content to the selected thread.
  - Show loading states and selected thread indicator.

- [X] **Step 6.6 — Wire frontend to thread journal APIs** *(1.5 hours)*
  - On page load (after auth), fetch available threads via `GET /threads`.
  - When user clicks a tag, fetch and display last 30 lines via `GET /threads/:tag`.
  - When user clicks "Save Entry", call `POST /threads/:tag` with text area content.
  - Clear text area after successful save.
  - Show success/error messages.

- [X] **Step 6.7 — Style the threaded journal UI** *(1 hour)*
  - Style thread tag list (similar to todo tag chips).
  - Style the journal viewer (monospace font, clear entry separators).
  - Style the entry editor text area.
  - Ensure responsive layout and visual consistency with existing UI.

- [X] **Step 6.8 — Test end-to-end thread journal flow** *(0.5 hours)*
  - Create a new thread by posting to a non-existent tag.
  - Append multiple entries to the same thread.
  - Verify entries appear with timestamps in the Gitea repo.
  - Verify last 30 lines display correctly.
  - Test with multiple different thread tags.

**Exit criteria:**
- User can view a list of thread tags in the UI. ✅
- Clicking a tag loads and displays the last 30 lines from that thread's journal file. ✅
- User can type in a text area and save entries that are appended with timestamps to the selected thread file in `Threads/` folder. ✅
- All changes are committed to the Gitea repository. ✅

---

## Phase 7 — Implement a fresh ToThread/webApp/ui from ToDoApp-Spec.md

**In Progress:**
Implementing fresh ToThread web app UI based on ToDoApp-Spec.md.

---

## Phase 8 — Refactor WebApp Code Structure and Assets

**In Progress:**
Refactoring web app code structure and assets for maintainability.

---

## Phase 9 — (Later) Move Todos Back to Git Repo Storage


**Goal:** After raw writing is stable, migrate the ToDo list storage from KV back to Git-repo storage.

- [ ] **Step 9.1 — Reintroduce Git-based ToDo file (`ToDos/List.json`) writes**
- [ ] **Step 9.2 — Decide conflict strategy (SHA/versioning vs last-write-wins)**
- [ ] **Step 9.3 — Migrate existing KV todos into the repo and cut over**

---

## Phase 10 — Tidy up

...

1. **Step 10.1 — Handle errors and auth failures gracefully in the UI**
  - Surface backend error messages in the UI (auth errors, KV issues, network failures).
  - Provide clear messages when the user is not in the allowlist.

  - Optionally maintain an index key (e.g., `writings/index`) listing writing IDs and brief metadata for fast listing.

**In Progress:**
- Improving error handling and auth failure messaging in the UI.

---

## Phase 11 — Implement UI to allow raw writing using API implemented in 6.

**In Progress:**
Enhancing UI for raw writing using new API.

## Phase 12 — Enhanced Project/Task Management System

**Goal:** Transform the simple ToDo list into a comprehensive project management system with hierarchical tasks, dependencies, and the ability to nest projects within projects.

**Vision:**
- ToDo lists become projects with tasks
- Tags can represent projects
- Tasks can have dependencies on other tasks
- Tasks can be expanded into subtasks
- Tasks can be expanded into full projects with their own project files
- Example: ToThread and MyCareThread would be tasks in a top-level project

**Key Features:**
- Hierarchical task structure (tasks → subtasks → sub-subtasks)
- Task dependencies (task B cannot start until task A is complete)
- Project nesting (a task can reference/contain an entire project)
- Tag-based project organization
- Status tracking beyond simple "done" (e.g., not started, in progress, blocked, completed)

**Important:** Before implementation, we need to:
1. Design the data structure to support hierarchical relationships and dependencies
2. Evaluate technology choices (graph database vs nested JSON vs file-based)
3. Consider how this integrates with existing KV storage or Git repo storage
4. Define the UI/UX for managing complex project hierarchies

### Steps:

- [ ] **Step 12.1 — Design UI/UX for project management** *(2 hours)*
  - Sketch/wireframe UI for:
    - Project list view
    - Project detail view with task hierarchy
    - Task detail view with dependencies visualization
    - Task creation/editing forms
    - Dependency graph visualization
  - Consider: tree view, Gantt chart, kanban board, or combination
  - Decide on interaction patterns (drag-drop, context menus, etc.)
  - **Goal:** Envision how the system works before making data structure and technical decisions

- [ ] **Step 12.2 — Research and design data model** *(2-3 hours)*
  - Research project management data models (DAG for dependencies, tree for hierarchy)
  - Design schema for:
    - Tasks with parent/child relationships
    - Task dependencies (prerequisite tasks)
    - Project references (task that points to another project file)
    - Task metadata (status, priority, tags, dates, assignee)
  - Consider: JSON structure vs graph database vs hybrid approach
  - Document pros/cons of different storage approaches (KV, Git files, external DB)
  - **Base decisions on UI/UX requirements from Step 12.1**

- [ ] **Step 12.3 — Define storage strategy** *(1 hour)*
  - Decide where to store project data:
    - Option A: Enhanced JSON in KV (single key per project)
    - Option B: Git repo files (one file per project, e.g., `Projects/<project-name>.json`)
    - Option C: Hybrid (index in KV, details in Git)
  - Consider scalability, query patterns, and consistency requirements
  - Document decision and rationale

- [ ] **Step 12.4 — Design API endpoints** *(1 hour)*
  - Define REST API for project operations:
    - `GET /projects` - list all projects
    - `GET /projects/:id` - get project with full task tree
    - `POST /projects` - create new project
    - `PUT /projects/:id` - update project
    - `POST /projects/:id/tasks` - add task to project
    - `PUT /tasks/:id` - update task (status, dependencies, etc.)
    - `DELETE /tasks/:id` - delete task
    - `POST /tasks/:id/expand` - expand task into subtasks or project
  - Define request/response schemas
  - Consider dependency validation (prevent circular dependencies)

- [ ] **Step 12.5 — Implement dependency graph logic** *(2-3 hours)*
  - Implement functions to:
    - Add/remove task dependencies
    - Validate dependency graph (detect cycles)
    - Calculate task ordering (topological sort)
    - Determine which tasks are blocked vs ready
  - Write unit tests for dependency logic

- [ ] **Step 12.6 — Implement hierarchical task operations** *(2 hours)*
  - Implement functions to:
    - Create parent-child task relationships
    - Expand task into subtasks
    - Expand task into a full project (create project file, link from task)
    - Collapse/expand views
    - Calculate rollup status (parent task status based on children)

- [ ] **Step 12.7 — Implement backend API endpoints** *(3-4 hours)*
  - Build all endpoints defined in Step 12.4
  - Add authentication and authorization (reuse existing allowlist)
  - Implement validation (schema validation, dependency cycle detection)
  - Add error handling and appropriate HTTP status codes

- [ ] **Step 12.8 — Implement project list and tree view UI** *(3-4 hours)*
  - Build project list view
  - Build hierarchical task tree view with expand/collapse
  - Show task status, dependencies, and metadata
  - Add filtering and sorting options
  - Make it responsive and accessible

- [ ] **Step 12.9 — Implement task editing and dependency UI** *(3-4 hours)*
  - Build task creation/editing forms
  - Implement dependency selection UI (dropdown, autocomplete, or graph)
  - Add ability to expand task into subtasks
  - Add ability to expand task into project
  - Show dependency status (blocked, ready, completed)

- [ ] **Step 12.10 — Implement dependency visualization** *(2-3 hours)*
  - Add visual representation of task dependencies
  - Consider: simple list, tree diagram, or interactive graph
  - Show critical path or blocked tasks
  - Make it interactive (click to navigate)

- [ ] **Step 12.11 — Migration strategy for existing todos** *(1-2 hours)*
  - Design migration path from simple todo list to project structure
  - Implement migration script/endpoint
  - Test with existing todo data
  - Document migration process

- [ ] **Step 12.12 — Test end-to-end project management flow** *(2 hours)*
  - Create a top-level project with ToThread and MyCareThread as tasks
  - Add dependencies between tasks
  - Expand a task into subtasks
  - Expand a task into a full project
  - Test status rollup and dependency blocking
  - Verify data persistence and reload

**Exit criteria:**
- Can create hierarchical projects with nested tasks
- Can define dependencies between tasks and system prevents circular dependencies
- Can expand tasks into subtasks or full projects
- UI clearly shows task hierarchy, dependencies, and status
- Existing todo data can be migrated to new structure
- ToThread and MyCareThread exist as tasks in a top-level project

**Planned:**
Enhanced project/task management system.

## Phase 13 — iPhone Safari LLM Conversation Capture (No LLM APIs)

**Goal:** Add an iPhone Safari-based conversation capture flow that lets you chat on public web UIs (ChatGPT/Gemini in Safari), capture prompts and responses verbatim, aggregate the full conversation, and save it into `rawWriting` through the existing backend writing pipeline.

**Chosen direction (locked):**
- Build an **iPhone Safari Web Extension + local session recorder**.
- **Do not use paid/provider LLM APIs** for message generation or transcript retrieval.
- Target **Safari web chats** (not native iOS chat apps) for v1.

**Scope note:** This phase is planning-only right now; no implementation work starts until this plan is approved.

### Steps:

- [X] **Step 13.1 — Define supported conversation-launch model**
  - **Decision:** v1 uses Safari Web Extension content scripts to capture conversations from ChatGPT/Gemini web pages.
  - **Decision:** No official LLM APIs are used.
  - **Decision:** Native iOS app chats are out-of-scope for automatic capture in v1.

- [X] **Step 13.2 — Create Xcode project structure for iPhone app + Safari extension**
  - Create/confirm iOS app container project.
  - Add Safari Web Extension target and required bundle identifiers.
  - Ensure project builds successfully in Xcode.
  - **Verification gate:** clean build passes with no runtime launch yet.

- [X] **Step 13.3 — Create minimal extension shell**
  - Add minimal extension files (manifest, background/popup scaffold, content script scaffold).
  - Show a visible extension popup/title so activation can be confirmed.
  - **Verification gate:** extension target compiles and archive/install artifacts are generated.

- [X] **Step 13.4 — Install app/extension on iPhone**
  - Install to your iPhone from Xcode (developer flow).
  - Confirm app appears on device.
  - **Verification gate:** app launches on iPhone without crashing.

- [X] **Step 13.5 — Enable extension in Safari and verify activation**
  - iPhone path: `Settings > Safari > Extensions` and enable the extension.
  - Enable permission for target sites (start with ChatGPT/OpenAI web domain).
  - **Verification gate:** extension icon is available in Safari and popup opens.

- [X] **Step 13.6 — Validate OpenAI web chat page detection**
  - Open OpenAI chat in Safari.
  - Confirm content script loads on allowed pages.
  - Add simple page-status indicator (`supported page detected`).
  - **Verification gate:** extension reports active on OpenAI chat page.

- [X] **Step 13.7 — Implement minimal prompt/response capture**
  - Capture one user prompt and one assistant response from the page DOM.
  - Store captured turns in local session memory (no backend save yet).
  - **Verification gate:** captured turns are visible in extension debug view.

- [X] **Step 13.8 — Implement session start/stop and multi-turn recording**
  - Add `Start Session` and `Stop Session` controls.
  - Record ordered turns with timestamps while session is active.
  - **Verification gate:** multiple turns are captured in correct order during one session.

- [X] **Step 13.9 — Define transcript schema and local draft persistence**
  - Canonical structure: `conversationId`, `provider`, `model`, `startedAt`, `endedAt`, `messages[]`.
  - Persist draft session locally to avoid data loss on tab/app interruptions.
  - **Verification gate:** reload Safari/app and confirm draft can be recovered.

- [X] **Step 13.10 — Define backend contract for saving transcript to rawWriting**
  - Reuse `POST /writings` or add dedicated conversation endpoint.
  - Define markdown rendering format preserving verbatim turns.
  - **Verification gate:** agreed request/response schema documented in plan/spec.

- [X] **Step 13.11 — Add Google-authenticated save flow**
  - Keep current Google login/allowlist model.
  - Trigger login at first save attempt if no valid session.
  - **Verification gate:** authenticated test user can call save endpoint successfully.

- [X] **Step 13.12 — End-to-end save to repo and verify output**
  - Finalize captured session and submit to backend.
  - Verify file appears in raw writing folder with complete ordered transcript.
  - **Verification gate:** one full OpenAI conversation is captured and saved end-to-end.

- [X] **Step 13.13 — Hide debug controls behind a debug toggle**
  - Add a `Debug Mode` toggle in the extension popup.
  - Hide debug buttons/output by default for normal daily use.
  - Keep advanced diagnostics available when `Debug Mode` is enabled.
  - **Verification gate:** default popup shows only core workflow controls; debug panel appears only after toggle-on.

- [X] **Step 13.14 — Simplify popup and auto-save on stop**
  - Move backend URL/token/settings controls into Debug Mode panel.
  - Keep default view focused on start/stop/finalize workflow.
  - Make `Stop Session` attempt automatic save immediately.
  - If login is required, open login page and queue pending save for automatic completion after token import.
  - **Verification gate:** stopping a session saves automatically when token is valid; if token missing/expired, save completes after login + token import.

- [X] **Step 13.15 — Clear local transcript after successful save**
  - Clear local capture session storage immediately after backend save success.
  - Prevent previous conversations from being included in later saves.
  - **Verification gate:** after save, next draft starts empty unless a new session is recorded.

**Exit criteria:**
- On iPhone Safari, a user can start a session on ChatGPT/Gemini web chat, capture full prompts/responses verbatim, finalize the transcript, and save it as a raw writing entry via the existing backend flow.
- Flow works without LLM provider APIs, and Google-authenticated save writes to the same storage location used by current raw writing entries.
- Saved file is complete, ordered, and readable.

---

## Phase 14 — iPhone ProjectPlan Manager

**Goal:** Display and manage `ProjectPlan.md` (root of the repo) from the iPhone, with read/edit/save and clear status updates.

### Steps:

- [X] **Step 14.0 — Define architecture components**
  - Identify required components (backend endpoints, iPhone UI surface, Gitea helpers, auth flow).
  - Decide where the plan viewer/editor lives (native iOS app screen).
  - Document data flow: load → edit → save → commit.

- [ ] **Step 14.1 — Define plan file contract**
  - File path: `ProjectPlan.md` at repo root.
  - Define read/write format expectations (Markdown passthrough).
  - Decide whether to allow edits anywhere or constrain to specific sections.

- [X] **Step 14.2 — Add backend endpoints for plan file**
  - `GET /plan` returns file content (raw markdown).
  - Replace `PUT /plan` with task‑level CRUD endpoints:
    - `POST /plan/tasks` (create task)
    - `PATCH /plan/tasks/:id` (update task fields/status)
    - `DELETE /plan/tasks/:id` (remove task)
  - Authenticated + allowlisted (reuse existing Google auth).
  - Storage still writes full plan file after each CRUD change.

- [X] **Step 14.3 — Implement Gitea read/write helpers**
  - Add functions to fetch file content and update file in repo.
  - Reuse existing Gitea API client and branch config.

- [X] **Step 14.4 — Google sign‑in in iOS app (native)**
  - Use **Authorization Code + PKCE** with `ASWebAuthenticationSession` (no web‑based implicit flow).
  - OAuth client: **iOS** client ID (not web) and **REVERSED_CLIENT_ID** URL scheme in Info.plist.
  - Redirect URI: `com.googleusercontent.apps.<client-id>:/oauth2redirect`.
  - Exchange the auth code at `https://oauth2.googleapis.com/token` for `id_token`.
  - Store `id_token` in Keychain; inject into the app WebView for backend calls.
  - All plan actions require a valid token; auth failure triggers login flow.
  - Reuse allowlist enforcement on backend.
  - Sub‑steps for setup:
    - [X] **Step 14.4.1 — Capture iOS bundle ID**
      - In Xcode, open iOS app target → Signing & Capabilities → copy Bundle Identifier.
      - com.zhian.tothread.capture
    - [X] **Step 14.4.2 — Create iOS OAuth Client ID**
      - Google Cloud Console → Credentials → Create OAuth client ID → iOS.
      - Use the bundle ID from Step 14.4.1.
      - Record the iOS Client ID.
      - The client id is 130905058858-bnb68ubnn1v0af5hm7idva5ilr2pgtvk.apps.googleusercontent.com
    - [X] **Step 14.4.3 — Derive REVERSED_CLIENT_ID**
      - Transform the iOS Client ID into `com.googleusercontent.apps.<client-id>`.
      - Record it for Info.plist URL scheme.
      - the reversed client id is com.googleusercontent.apps.130905058858-bnb68ubnn1v0af5hm7idva5ilr2pgtvk
    - [ ] **Step 14.4.4 — Implement ASWebAuthenticationSession + PKCE**
      - Build the OAuth URL with `code_challenge` and `code_challenge_method=S256`.
      - Start the session and capture the `code` from the redirect.
    - [ ] **Step 14.4.5 — Exchange code for tokens**
      - POST to Google token endpoint with `code_verifier`.
      - Extract `id_token`, store in Keychain.
    - [ ] **Step 14.4.6 — Wire token into plan UI**
      - Send `id_token` to the WebView (JS bridge).
      - Ensure `/plan` and CRUD calls attach `Authorization: Bearer <id_token>`.


- [X] **Step 14.5 — iPhone UI for plan viewing (hierarchy navigator)**
  - Add a native “Project Plan” screen inside the iOS app (not Safari).
  - **Screen layout (v1):**
    - Top bar: title “Project Plan” + back button (disabled at root).
    - Subheader: last sync time + toggle show/hide finished tasks + `+` add top‑level task + refresh.
    - Primary list: tasks at the current level only (no parent + children together).
    - Each row shows: title, child count (with unfinished indicator), `Done` button (if allowed), `Add Subtask`, `Details`.
  - **Rules:**
    - If a task has unfinished subtasks, `Done` does not mark the parent done.
    - Continuous tasks have no `Done` button; status changes only in Details.
  - **Navigation model:**
    - Tap a task row to drill into its subtasks (push screen).
    - Back button returns to parent level; repeated back returns to root.
    - Subtask list and Details never show together.
  - **List interactions:**
    - Swipe left: `Delete`.
  - **Status:** v1 implemented. Drill‑down navigation still missing in the running build.

- [X] **Step 14.5.1 — Drill‑down navigation for subtasks**
  - Tapping a task with children navigates into its subtask list.
  - Show child count indicator at parent level.
  - Back returns to parent (and eventually root).
  - Verify at least 2‑level nesting works.

- [X] **Step 14.5.2 — Update UI after Done response**
  - When tapping `Done`, update the local UI after the backend returns the updated task.
  - Refresh from backend after save to confirm.

- [X] **Step 14.5.3 — Add task in current level**
  - When inside a task, `+ Add Task` should create a subtask under the current task.
  - At root, `+ Add Task` creates a top‑level task.
  - **Create task flow:**
    - `+` at current level creates a task at that level.
  - **Sync and feedback:**
    - Pull‑to‑refresh reloads current level.
    - Any backend action is gated by token; failures trigger login flow.
    - On error, keep local edits minimal and prompt user to retry.

- [X] **Step 14.5.4 — Refresh should reload current level**
  

- [X] **Step 14.5.5 — Deletion should update UI**
  - After deleting a task, the list should update immediately.
  - Verify the deleted task disappears without restart.

- [X] **Step 14.5.6 — Remove Safari extension prompt from main view**
  - Remove “You can turn on ToThreadCapture's Safari extension in Settings.” from the app screen.
  - Later reintroduce via a menu or settings area.

- [X] **Step 14.5.7 — Clear stale error messages**
  - Before any new user action (refresh/add/delete/done), clear any existing error message.
  - Avoid leaving errors visible after successful actions.

- [X] **Step 14.5.8 — Task details screen (terminal view)**
  - Separate Details screen (no subtask list visible here).
  - Fields: title, description, results, status.
  - Leaving Details (Back or tap outside) auto‑saves changes.
  - Details is a terminal navigation (back only goes to parent list.

---

- [X] **Step 14.5.9 — Conflict/overwrite strategy**
  - Decision: last‑write‑wins at API level (server applies requested change to latest plan).
  - Future option: include `sha`/ETag in responses and require it on updates for optimistic locking.

- [X] **Step 14.5.10 — End‑to‑end test**
  - Load plan on iPhone.
  - Edit a section and save.
  - Verify changes in repo and Git history.

---

## Phase 15 — Git-Native Project Graph Planning (Deferred Architecture Spec)

**Goal:** Preserve the idea of a Git-native project management system that scales better than a single large plan file or a structured database, without interrupting current execution priorities.

**Core idea:**
- Treat Git as the source of truth.
- Treat a task as either:
  - a **simple task** stored inside its parent project plan file, or
  - a **project task** promoted into its own plan file under a project/subproject folder.
- Allow a project task to be **demoted** back into a simple task by absorbing its file contents into the parent.
- Support cross-project hierarchy so a high-level task can drill into a lower-level project plan.

**Architecture components:**
- **Canonical storage:** file-based project plans in the repo, one plan file per project boundary.
- **Working-copy backend:** server maintains a local clone/worktree, applies validated edits, commits, pulls/rebases as needed, then pushes like a normal Git client.
- **Plan mutation layer:** one safe tool/service performs add/edit/move/reorder/promote/demote operations; UI and Codex both use this layer instead of editing plan files directly.
- **Project graph index:** scanner discovers project plan files, resolves links between parent tasks and subproject plans, detects broken links/cycles, and supports roll-up summaries.
- **UI editor:** tree view for navigation and re-organization; drag/drop and promotion/demotion should happen in UI rather than through raw file editing.
- **Codex skill:** project-management skill uses the same mutation layer and graph index so Codex can manage plans safely in the repo.

**Data model requirements:**
- Ordering is authoritative and must be preserved directly, not approximated by ranking.
- Stable task IDs must survive reordering, moves, promotion to project, and demotion back to task.
- A project node must carry enough metadata to locate and load its child project plan.
- Plan format should be chosen for safe machine editing and validation; avoid raw YAML as the long-term canonical authoring format.

**Operational requirements:**
- Serialize writes per repo or per affected project subtree.
- Validate before commit: schema, IDs, ordering, links, promotion/demotion rules.
- Surface Git conflicts as explicit workflow states; do not silently overwrite.
- Keep commit messages meaningful and tied to user actions.

**Product direction / rationale:**
- Prefer this Git-native project graph approach over the structured database planner for the long-term project-management architecture.
- Keep project plans close to the code and folder structure they describe.
- Make UI and Codex first-class editors over the same Git-backed planning system.

**Non-goals for now:**
- Do not build this until current higher-priority work is finished.
- Do not choose the final plan file format yet.
- Do not implement enterprise features yet (permissions, reporting, analytics); first prove the core file/graph/editing model.

- [ ] **Step 15.1 — Revisit and decide canonical plan format**
  - Compare JSON, Markdown+frontmatter, or another safer machine-editable format.
  - Primary decision criteria: ordering safety, validation, Git diff quality, Codex safety, and UI compatibility.

- [ ] **Step 15.2 — Define promote/demote semantics**
  - Specify exactly how a task becomes a project file and how a project file is absorbed back into its parent.
  - Preserve IDs, ordering, and links across both operations.

- [ ] **Step 15.3 — Design working-copy backend + mutation layer**
  - Define fetch/edit/validate/commit/push flow.
  - Define conflict handling and write serialization rules.

- [ ] **Step 15.4 — Design project graph UI**
  - Define drill-down, drag/drop reorder, move across projects, and promote/demote interactions.
  - Favor UI-based re-org over raw text editing.

- [ ] **Step 15.5 — Design Codex project-management skill**
  - Define commands/workflows for discovering plans, editing safely, validating, and summarizing project status.

---

## Deferred Steps

- [ ] **Step 14.5.4 — Refresh should reload current level**
  - Refresh must re-fetch from backend and update the current view.
  - Verify changes appear immediately after refresh.

- [ ] **Step 14.9 — Refresh does not reload in‑app**
  - Refresh button sometimes does not pull latest plan until app restart.
  - Investigate WKWebView caching or request revalidation.
  - Fix so refresh reliably re-fetches and updates view.

**Exit criteria:**
- `ProjectPlan.md` can be loaded, edited, and saved from iPhone.
- Changes are committed to the repo with a clear commit message.
- Auth and allowlist enforcement remain intact.

---

## Appendix — Related Plans in This Repo

- `webApp/planner-plan.md` — InsForge-backed planner web app plan.
- `Planner-PlanningLoop-Phase1.md` — Phase 1 decision package for the planner’s overall-plan, daily-plan, time-budget, and review loop model.
- `InsForge-SDK-Service-ContractTests-Plan.md` — Record/replay contract test suite plan for verifying the InsForge `@insforge/sdk` ↔ service HTTP interface.
