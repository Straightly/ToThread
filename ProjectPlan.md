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

## Phase 5 — Implement a fresh ToThread/webApp/ui from ToDoApp-Spec.md

**Goal:** Build a new ToThread-native Todo web UI that uses Google login and `/todos` (KV-backed) directly, following `ToThread/ToDoApp-Spec.md`, without legacy GitHub/PAT dependencies.

1. **Step 5.1 — Create new UI skeleton**
   - Recreate a minimal `webApp/ui` folder structure (HTML, CSS, JS) focused only on the new ToThread UI.
   - Basic page layout per spec: header, Google sign-in section, app section with todo list and (placeholder) raw writing area.

2. **Step 5.2 — Wire Google Identity Services into the new UI**
   - Add the GIS script and sign-in button.
   - On successful sign-in, obtain an ID token and pass it into a small auth/init helper (e.g., `ToThreadAuth.setIdToken`).

3. **Step 5.3 — Implement frontend `/todos` client and state manager**
   - Implement a lightweight JS client for `GET /todos` and `PUT /todos` using the ID token.
   - Implement a todo state manager per spec (load, add, edit, toggle, track `hasChanges`, parse tags).

4. **Step 5.4 — Implement todo list UI interactions**
   - Render todos with checkboxes, inline editing, tag chips, and show-completed toggle.
   - Implement tag filter behavior and empty states.

5. **Step 5.5 — Implement save/refresh behavior**
   - Add a `Save Changes` button that calls `PUT /todos` with the full list.
   - Add a `Refresh` button that reloads from `GET /todos`, with a clear behavior around unsaved changes.

6. **Step 5.6 — Handle errors and auth failures gracefully**
   - Surface backend error messages in the UI (auth errors, KV issues, network failures).
   - Provide clear messages when the user is not in the allowlist.

7. **Step 5.7 — Stub/disable raw writing save**
   - Keep the raw writing section visually present but have its save action show a "not yet implemented" message until Phase 6 and 7 are complete.

**Exit criteria:**
- A new `ToThread/webApp/ui` exists that:
  - Uses Google login to obtain an ID token.
  - Loads and saves todos via `/todos` against KV.
  - Provides the core todo management experience (view, add, edit, complete, filter by tags, save, refresh).
  - Does not depend on GitHub or a PAT.
  - Shows a clear non-functional stub for raw writing.

---

## Phase 6 — Raw Writing Capture APIs

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

## Phase 7 — Implement UI to allow raw writing using API implemented in 6.
