# ToThread Backend Project Plan (Cloudflare + KV + Google Login)

## Project Goal

Build a Cloudflare-hosted backend for ToThread that:

- Provides APIs to **update the ToDo list** (current `ToDos/List.json` equivalent).
- Provides APIs to **add raw writings** (current `Writing/RawWrittings/` equivalent).
- Uses **Google login** to authenticate the user.
- Authorizes access only for a small **allowlist of Google accounts** stored in **Cloudflare KV** under a single key.

This backend will eventually replace the GitHub-API-based storage model used by the existing ToDoApp and raw writing capture.

**Current focus:** Restore **raw writing capture** (`writeRaw` / `Writing/RawWrittings/*`) using your **self-hosted Git server (Gitea)** as the storage backend. Keep the **ToDo list** on **Cloudflare KV** for now.

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
- A raw writing entered in the web UI results in a committed file in the Gitea repo under `Writing/RawWrittings/`.
- `/todos` continues working with KV (no regression).

---

## Phase 6 — Implement a fresh ToThread/webApp/ui from ToDoApp-Spec.md

...

---

## Phase 7 — Refactor WebApp Code Structure and Assets

...

---

## Phase 8 — (Later) Move Todos Back to Git Repo Storage

**Goal:** After raw writing is stable, migrate the ToDo list storage from KV back to Git-repo storage.

- [ ] **Step 7.1 — Reintroduce Git-based ToDo file (`ToDos/List.json`) writes**
- [ ] **Step 7.2 — Decide conflict strategy (SHA/versioning vs last-write-wins)**
- [ ] **Step 7.3 — Migrate existing KV todos into the repo and cut over**

---

## Phase 9 — Tidy up

...

1. **Step 8.1 — Handle errors and auth failures gracefully in the UI**
   - Surface backend error messages in the UI (auth errors, KV issues, network failures).
   - Provide clear messages when the user is not in the allowlist.

   - Optionally maintain an index key (e.g., `writings/index`) listing writing IDs and brief metadata for fast listing.

**Exit criteria:**
- You can `POST /writings` with a valid token and see the entry persisted in KV.
- (If implemented) you can retrieve the same entry by ID.

---

## Phase 10 — Implement UI to allow raw writing using API implemented in 6.
