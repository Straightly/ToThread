# ToThread Backend Project Plan (Cloudflare + KV + Google Login)

## Project Goal

Build a Cloudflare-hosted backend for ToThread that:

- Provides APIs to **update the ToDo list** (current `ToDos/List.json` equivalent).
- Provides APIs to **add raw writings** (current `Writing/RawWrittings/` equivalent).
- Uses **Google login** to authenticate the user.
- Authorizes access only for a small **allowlist of Google accounts** stored in **Cloudflare KV** under a single key.

This backend will eventually replace the GitHub-API-based storage model used by the existing ToDoApp and raw writing capture.

---

## Assumptions & Constraints

- **Hosting:** Cloudflare Workers (optionally with Cloudflare Pages later).
- **State:** Cloudflare KV for todos, writings, and the Google-accounts allowlist.
- **Auth provider:** Google (OAuth2 / OpenID Connect via an identity flow that runs in the browser and passes tokens to the Worker).
- **Clients:**
  - Existing browser-based ToDoApp frontend (will be adapted later to call this backend).
  - Potential future clients (e.g., iPhone app) can reuse the same APIs.

---

## Phase 1 — Minimal Cloudflare Backend Skeleton

**Goal:** Have a deployed Cloudflare Worker reachable on the internet with a simple health endpoint.

1. **Step 1.1 — Create Worker project for ToThread backend**
   - Use `wrangler` to scaffold a new Worker in `ToThread/backend` (or similar subfolder).
   - Configure basic `wrangler.toml` with name, account ID, and route or workers.dev URL.

2. **Step 1.2 — Implement `/health` endpoint**
   - Add a simple GET endpoint (e.g., `/health`) that returns JSON: `{ "status": "ok", "service": "ToThread-backend" }`.
   - Deploy and verify via browser / curl.

3. **Step 1.3 — Wire KV namespace (placeholder)**
   - Define a KV namespace in `wrangler.toml` (e.g., `TOTHREAD_KV`).
   - Bind it to the Worker but do not rely on it yet, just confirm the binding works via a trivial get/put test.

**Exit criteria:**
- Worker deployed and reachable at a known URL.
- `/health` returns `200 OK` with the expected JSON.
- KV namespace is configured and accessible from the Worker.

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
- Clear written spec of keys and value schemas.
- KV helper functions implemented and unit-tested within the Worker.
- Allowlist key exists in KV with at least one valid Google account.

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
- Backend can reliably:
  - Verify a Google ID token.
  - Reject non-allowed users based on the KV allowlist.
- Happy-path tests show allowed account can reach protected endpoints; others cannot.

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
- You can call `GET /todos` and `PUT /todos` with a valid Google token and see data round-trip to KV.
- Unauthorized or non-allowlisted requests are rejected.

---

## Phase 5 — Raw Writing Capture APIs

**Goal:** Provide authenticated endpoints to add new raw writings into KV.

1. **Step 5.1 — Implement `POST /writings`**
   - Authenticated + allowlisted.
   - Accepts JSON body including at least:
     - `content` (string)
     - Optional metadata (title, tags, timestamp).
   - Generates an ID (e.g., timestamp-based or UUID) and stores to KV under `writings/<id>`.

2. **Step 5.2 — (Optional) Implement `GET /writings/:id` and/or `GET /writings`**
   - Allow retrieving specific writings or a list.
   - Decide whether you need listing now or only writing-creation for capture.

3. **Step 5.3 — Integrate basic indexing if needed**
   - Optionally maintain an index key (e.g., `writings/index`) listing writing IDs and brief metadata for fast listing.

**Exit criteria:**
- You can `POST /writings` with a valid token and see the entry persisted in KV.
- (If implemented) you can retrieve the same entry by ID.

---

## Phase 6 — Frontend Integration (ToDoApp & Future Clients)

**Goal:** Prepare ToDoApp and any future clients to use the new backend.

1. **Step 6.1 — Define frontend API contract**
   - Document the exact request/response shapes for:
     - `GET /todos`
     - `PUT /todos`
     - `POST /writings`
   - Include auth expectations (Google ID token header, etc.).

2. **Step 6.2 — Adapt existing ToDoApp config**
   - Replace GitHub API configuration in `ToDoApp/config.js` with base URL for ToThread backend.
   - Plan incremental migration (e.g., switch reads first, then writes).

3. **Step 6.3 — Port existing ToDoApp UI into `ToThread/webApp/ui` (todos only)**
   - Copy as much of the existing ToDoApp browser UI code as practical into `ToThread/webApp/ui`.
   - Replace GitHub-backed data access in that UI with calls to the new authenticated `GET /todos` and `PUT /todos` endpoints.
   - Leave raw writing features pointing at their current implementation for now; add new APIs and UI wiring for writings in Phase 5 / a later frontend pass.

4. **Step 6.4 — Rewire ToThread UI from GitHub PAT to Google + `/todos`**
   - Add a thin adapter layer so `TodoManager` can call `ToThreadAPI` (using `GET /todos` and `PUT /todos`) without large internal changes.
   - Update the ToThread UI `app.js` to:
     - Obtain a Google ID token via Google Identity Services.
     - Pass that token into `ToThreadAPI`.
     - Construct `TodoManager` against the ToThread adapter instead of `GitHubAPI`.
   - Remove the GitHub Personal Access Token setup UI and GitHub-specific logic from the ToThread web UI.
   - Keep the raw writing section visible but disable the "Save Raw Writing" action (or show a clear "not yet implemented" message) until the new writing backend (Phase 5) is available.

   6.4.1: Add the thin adapter for ToThreadAPI → TodoManager.
6.4.2: Change app.js to use the adapter and Google ID tokens.
6.4.3: Remove PAT UI / GitHub logic.
6.4.4: Disable raw writing save.

5. **Step 6.5 — Gradual switchover**
   - For development: add a “backend mode” switch (GitHub vs Cloudflare) to test safely (in the original ToDoApp repo and/or in the new ToThread UI).
   - Once stable, make Cloudflare backend the default for todos.

**Exit criteria:**
- ToDoApp can load and save todos and raw writings via the ToThread Cloudflare backend.
- Old GitHub-API flow can be retired or left as a fallback if desired.

---

## Phase 7 — Hardening & Operations (Optional)

1. **Logging & Observability**
   - Add structured logging for auth failures, KV errors, and unexpected conditions.

2. **Backup & Export**
   - Design an export path for todos and writings (e.g., periodic dump to R2, or downloadable JSON).

3. **Security Review**
   - Double-check token validation, allowed origins (CORS), and KV key naming.

4. **Documentation**
   - Document setup steps, environment variables, KV namespace creation, and how to update the allowlist key.

---

## Next Action When We Resume

When you’re ready to start implementation, we will:

1. Create the Cloudflare Worker skeleton for ToThread in a `backend/` folder under this repo (Phase 1.1).
2. Configure a KV namespace for `TOTHREAD_KV` and verify a trivial get/put.
3. Then move on to the KV data model (Phase 2) and Google login integration (Phase 3).
