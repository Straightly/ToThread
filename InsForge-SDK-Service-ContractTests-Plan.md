# ToThread TIP Suite + InsForge SDK↔Service Contract Tests

## Goal

Create a **ToThread-focused TIP (Test In Production) / smoke** test suite that uses the InsForge SDK exactly as ToThread does, so when something breaks (e.g., “saving stopped working”), you can run a single command (or admin action) and quickly determine whether the SDK↔service behavior changed for the APIs ToThread relies on.

Secondarily (future): build a fuller SDK↔service contract harness that records and replays request/response “tapes”.

This plan is intentionally split into:
- **Phase 1 (Now): ToThread TIP suite** — practical, targeted, fast feedback for your production workflows.
- **Phase 2 (Later): Tape-based contract harness** — record/caller/provider modes and filesystem artifacts; potentially upstream feature proposal.

---

## Phase 1 (Now): ToThread TIP Test Suite (consumer-focused)

### What TIP tests are (in this repo)

These tests:
- Use the **same SDK** (`@insforge/sdk`) and **same call patterns** as ToThread.
- Cover **only the APIs ToThread actually uses**, with the simplest valid parameters.
- Run against a chosen environment (production, or production-like) to catch broken contracts early.

### Security/Privacy requirement (by design)

TIP is a product feature and must be safe to expose to every user.

Hard requirements:
- TIP scenarios must **not touch** PII/PHI (or any guarded customer content) by design.
- TIP recordings (“tapes”) must **never contain credentials** (no access tokens, cookies, api keys).
- If a TIP scenario cannot be executed without touching guarded data, it must be **excluded** or moved behind a separate, explicitly privileged diagnostic flow.

Practical design choices to achieve this:
- Use **synthetic test data only** (e.g., fixed strings like `TIP_TEST_TITLE`) rather than user-provided content.
- Record **structure, not secrets**:
  - capture method + path + query *keys* (not values),
  - header *names* (not values),
  - body *keys/schema* (not values),
  - response status + error codes + response *schema* (not content).
- Fail closed: if the recorder detects disallowed keys/fields, it should refuse to persist/export the tape.

### Why you don’t “have env vars by default”

You can make this *easy* and *standard*, but you should not hardcode or commit secrets:
- **Base URL** can be non-secret and can be checked into a config file.
- **Anon key** and **test user credentials** should live in an uncommitted `.env` file, CI secrets, or a password manager.

This is the same pattern the upstream InsForge SDK integration tests use (env vars + fixed verified account).

### Executable plan (checkboxes)

- [ ] **Step 1.1 — Define ToThread’s “contract surface” (list the calls)**
  - Inventory the exact InsForge SDK calls ToThread uses for “save” and other critical flows (DB writes/updates, storage upload, functions, etc.).
  - Outcome: a short list of TIP scenarios, each mapped to one or more SDK calls.

- [ ] **Step 1.2 — Set up TIP test configuration**
  - Create an uncommitted env file (e.g., `integration-tests/tip/.env.local`) with:
    - `INSFORGE_TIP_BASE_URL`
    - `INSFORGE_TIP_ANON_KEY`
    - `INSFORGE_TIP_TEST_EMAIL`
    - `INSFORGE_TIP_TEST_PASSWORD`
  - Add a committed template file (no secrets), e.g. `.env.example`.

- [ ] **Step 1.3 — Bootstrap test project structure in ToThread**
  - Create `integration-tests/tip/` in this repo with:
    - a minimal Node+Vitest (or `node:test`) runner
    - shared setup modeled after upstream `/Users/zhian/Projects/InsForge-sdk-js/integration-tests/setup.ts`
  - Add scripts at repo root (or package-local) such as:
    - `tip:test` (runs TIP tests)
    - `tip:report` (prints a summary suitable for copy/paste)

- [ ] **Step 1.4 — Implement TIP scenarios (minimal params, all ToThread-used APIs)**
  - For each TIP scenario:
    - authenticate (or reuse a cached session)
    - execute the ToThread-used SDK call(s)
    - assert the success criteria (status/data shape)
  - Keep tests production-safe:
    - read-only where possible
    - if writes are required, write to a dedicated test namespace/table or soft-delete cleanup

- [ ] **Step 1.5 — Add “I’m broken” operator workflow**
  - Document: “If saving breaks, run `npm run tip:test` and inspect the report.”
  - The report should clearly say: auth ok? db write ok? storage ok? (with error messages).

- [ ] **Step 1.6 — Optional: User-facing TIP button**
  - Add a UI action available to any logged-in user to run TIP checks and display a report.
  - Include an Export button to download the tape/report (already sanitized by design).
  - Keep it safe:
    - timeboxed
    - no secrets/PII printed or stored
    - bounded writes only to synthetic/test-only resources (or read-only checks)

- [ ] **Step 1.7 — Optional: scheduled TIP checks**
  - Add a CI job or local cron task to run TIP checks against production daily/weekly.
  - Alerting can be as simple as: fail the job + email/notification in your chosen system.

---

## Phase 2 (Later): SDK↔Service Tape-Based Contract Harness (record/caller/provider)

This is the broader tool that makes the **SDK↔service HTTP interface itself** testable and reviewable, so future debugging can quickly answer:

1) “What HTTP requests does the SDK generate?”  
2) “What HTTP responses does the service return?”  
3) “Did either side change (SDK update vs server update)?”

The **specification is the test suite**:
- Each test encodes a real, end-to-end scenario.
- Each scenario produces a recorded “tape” of **every HTTP/HTTPS request+response** made during that scenario.

## Additional Product Outcomes

This suite is also a coordination tool across three stakeholder groups:

1) **SDK developers**: fast, deterministic signals when SDK changes break backward compatibility against known-good service behavior.
2) **Service developers**: fast, deterministic signals when service changes break backward compatibility against known-good SDK request shapes and expected responses.
3) **SDK users (app teams)**: can upgrade the SDK confidently by verifying the upgrade does not change the on-wire interface in ways that would break production.

Concretely, it should:
- Detect and communicate backward-compatibility breaks (what changed, where, and which mode caught it).
- Provide an “upgrade safety gate” so SDK users can upgrade with evidence.

## Non‑Goals

- Not a UI/E2E test runner (Playwright/Cypress) for the planner app.
- Not “mock unit tests”; these are contract/integration tests focused on the HTTP boundary.

---

## Core Concept: “Tapes”

Each test scenario records a sequence of interactions:

- Request:
  - method, URL (path + query), headers, body
- Response:
  - status, headers, body
- Metadata:
  - timestamp, mode, SDK version, baseUrl, etc.

**Tapes are committed to the repo** (after redaction/normalization) so a diff clearly shows what changed.

### Redaction / Normalization (required)

Tapes must not leak secrets or unstable values. Implement a normalization layer that:

- Redacts secrets:
  - `Authorization`, cookies, api keys, refresh tokens
- Normalizes unstable fields in JSON:
  - timestamps, UUIDs/IDs, request IDs, pagination cursors, JWTs
- Canonicalizes:
  - JSON key ordering, whitespace, header casing/order

This enables deterministic diffs and stable comparisons across machines.

---

## Preflight Evaluation (do this before building)

- [x] **Step 0.1 — Check if this already exists upstream**
  - Inspect the open source InsForge SDK repository for existing integration/contract tests or request/response recording hooks.
  - Look for: “tape/vcr”, HAR recording, fetch interception, replay tests, compatibility CI gates.
  - Outcome: link to what exists and decide “reuse/extend” vs “build new”.
  - Findings (cloned to `/Users/zhian/Projects/InsForge-sdk-js`):
    - Upstream already has a live-service integration suite: `/Users/zhian/Projects/InsForge-sdk-js/integration-tests/` with module coverage (`auth.test.ts`, `database.test.ts`, `storage.test.ts`, `functions.test.ts`, `realtime.test.ts`, `ai.test.ts`, `email.test.ts`, plus `setup.ts`).
    - It runs via Vitest config `/Users/zhian/Projects/InsForge-sdk-js/vitest.integration.config.ts` and `npm run test:integration` (see `/Users/zhian/Projects/InsForge-sdk-js/package.json`).
    - The suite expects env vars like `INSFORGE_INTEGRATION_BASE_URL` and `INSFORGE_INTEGRATION_ANON_KEY` and uses a fixed pre-verified account for authenticated tests (see `/Users/zhian/Projects/InsForge-sdk-js/integration-tests/setup.ts`).
    - The SDK already supports request/response debug logging via `debug: true` or `debug: (msg) => ...`, and the HTTP client logs both requests and responses with redaction (see `/Users/zhian/Projects/InsForge-sdk-js/src/lib/logger.ts` and `/Users/zhian/Projects/InsForge-sdk-js/src/lib/http-client.ts`).
    - What appears **missing** (relative to Phase 2): a committed “tape” format + deterministic record/replay harness with explicit caller/provider modes and filesystem artifacts for diffing across SDK/service versions.

- [ ] **Step 0.2 — Decide where this suite should live**
  - Options:
    - This repo (`/Users/zhian/Projects/ToThread/`) as a consumer-facing contract suite (closest to app-team needs).
    - The InsForge SDK repo as an upstream compatibility harness (closest to SDK-team needs).
    - A standalone repo shared by both.
  - Evaluate: ownership, credentials/secrets handling, CI feasibility, how tapes are versioned, and who maintains the baseline.

- [ ] **Step 0.3 — Decide how “skill-based” this should be**
  - Evaluate whether creating a Codex skill (or a small CLI) makes sense for repeatability:
    - “record/regenerate tapes” command
    - “upgrade SDK safely” workflow command
    - “provider replay against prod-like env” command
  - Outcome: choose one primary interface (CLI first, skill second; or vice versa).

- [ ] **Step 0.4 — Evaluate LLM automation with minimal human effort**
  - Identify which steps can be automated reliably:
    - generating new scenario skeletons
    - proposing redaction/normalization rules
    - summarizing diffs into compatibility reports
  - Identify which steps likely require human control:
    - approving baseline updates (tape diffs)
    - providing credentials and selecting target environments
  - Outcome: define “human-in-the-loop” checkpoints and add prompts/workflows accordingly.

- [ ] **Step 0.5 — Decide whether to propose this upstream to InsForge**
  - If Step 0.1 shows gaps, draft an upstream feature proposal:
    - problem statement: SDK/service version mismatches cause long debugging loops
    - solution: record/caller/provider contract harness + CI signals
    - expected maintenance + security posture (redaction)
  - Outcome: open an issue or PR in the InsForge SDK repo with the plan.

## Run Modes

### 1) Record Mode (against a live service)

Purpose: create/update tapes using real SDK calls.

- The tests run using `@insforge/sdk` (the actual production version you ship).
- A recording `fetch` wrapper captures **every** request/response.
- After the test completes and assertions pass, tapes are written under a deterministic path.

Output:
- `tapes/<suite>/<test-name>.json` (or `.ndjson`) containing interactions + metadata.

### 2) Caller Mode (no service calls)

Purpose: verify the SDK generates the correct requests **without any network**.

- The SDK runs normally, but `fetch` is replaced with a stub that:
  1) captures the request that the SDK *would* send
  2) compares it to the recorded request (after normalization)
  3) returns a synthetic `Response` (usually the recorded response) so the SDK call completes

Assertions focus on:
- request URL/path/query
- required headers (esp. `Authorization`, content-type)
- JSON body shape/content (after normalization)

### 3) Provider Mode (against any InsForge service)

Purpose: verify a target InsForge service still responds the same way to the same inputs.

- The runner **does not use the SDK** for this mode.
- It replays the recorded HTTP requests against a `BASE_URL` you supply.
- It compares actual responses to the recorded responses (after normalization).

Required feature: **variable slots** for auth/session.
- Tapes must support placeholders such as `{{ACCESS_TOKEN}}`.
- Provider mode obtains fresh tokens (e.g., via sign-in) and substitutes them before replaying subsequent requests.

---

## Backward Compatibility: Definitions and Signals

This tool should make it obvious *who needs to act* when something changes.

- **SDK backward-compatibility break** (detected by **caller mode**):
  - The SDK produces different requests than the approved tape baseline for covered scenarios.
  - Action: SDK devs decide if change is intended (then bump major / publish migration notes) or a regression (fix).
- **Service backward-compatibility break** (detected by **provider mode**):
  - The service responds differently to the same recorded requests.
  - Action: service devs decide if change is intended (version the API / deploy compat behavior) or a regression (fix).
- **Upgrade risk for app teams** (detected by **caller + provider** together):
  - Caller mode ensures request shape stability; provider mode ensures prod responses still match expectations.

## Coverage Policy (why “for covered scenarios” is explicit)

You can’t literally test “all scenarios” because the input space is effectively unbounded:
- dynamic data (IDs, timestamps, pagination, auth state)
- role/RLS combinations
- optional fields, query permutations, error cases
- multi-step workflows with branching

So this tool makes a **deliberate contract**:

- For **scenarios covered by tapes**, the suite provides strong evidence of compatibility (and can be used as a merge/release gate).
- For **scenarios not covered**, there is **no compatibility guarantee** by default—add a scenario if it matters.

This keeps the guarantee honest and makes adding coverage a concrete engineering task, not a vague promise.

### How new scenarios get added (TDD-style)

When someone needs additional coverage (SDK dev, service dev, or app team), they:

1) Write a short scenario spec (inputs, expected behavior, and why it matters).
2) Encode it as a new contract test (one test or a small suite).
3) Run **record mode** to generate the initial tape baseline (against a production-like environment).
4) Add it to CI **caller mode** gating (and optionally provider mode for release).

The test (and its tape) becomes the living spec for that scenario.

### Practical “full coverage” strategy (as a roadmap)

If you want to move toward “as close to all scenarios as reasonable”, do it systematically:
- Maintain a checklist mapping: endpoints/features → scenarios → tapes.
- Add “golden path + common failure modes” for each endpoint.
- Consider light property-based/fuzz variations for request-shape validation (still bounded, still redacted).

## Compatibility Reports (what people read)

Each run should emit a report artifact (in addition to pass/fail):

- `reports/<timestamp>/<mode>.md` (or JSON) containing:
  - SDK version and runtime info
  - target base URL / environment name
  - tape set and scenario list executed
  - pass/fail summary
  - for each mismatch: minimal diffs (request vs expected, or response vs expected)

---

## Repository Layout (proposal)

Create a dedicated package so tests can run in Node with a controlled `fetch`:

```
integration-tests/insforge-contract/
  package.json
  tsconfig.json
  vitest.config.ts            # or node:test runner config
  src/
    index.ts                  # CLI entry (mode selection)
    runner/
      runRecord.ts
      runCaller.ts
      runProvider.ts
    tape/
      tapeFormat.ts           # types + schema
      loadTape.ts
      saveTape.ts
      normalize.ts            # redaction + canonicalization
      matchers.ts             # placeholders + captured variables
    http/
      fetchRecorder.ts        # wraps globalThis.fetch
      fetchStub.ts            # caller mode
      replay.ts               # provider mode
  tapes/
    planner-db-write/
      insert-task.json
      update-task.json
      storage-upload.json
  prompts/
    README.md                 # how to use prompts
    regenerate-tapes.md
```

If preferred, this package can live under `webApp/` (but keeping it at repo root avoids coupling it to the Vite app build).

---

## Initial Test Coverage (minimum viable contract)

Start with a small set of “golden path” scenarios that cover the interfaces most likely to break:

1) **Auth**
   - sign in (or OAuth token import) → access token obtained
   - get current user/session
2) **Database writes**
   - insert a task row
   - update a task row
3) **Storage write** (if the app uses it)
   - upload a small text blob

Each scenario must:
- create unique test data (prefix with test run ID)
- clean up if possible (or use soft-delete / separate test project)

---

## Implementation Steps (project plan)

- [ ] **Step A — Decide runner + runtime**

- Choose Node 18+ test runner:
  - Vitest (recommended if you want TS + good DX), or
  - `node:test` (no extra dependency)
- Confirm how `@insforge/sdk` performs HTTP:
  - assume it uses `fetch` in browser/Node
  - plan is to intercept via `globalThis.fetch` wrapper in Node tests

- [ ] **Step B — Define the tape format + normalization rules**

- Define a JSON schema (versioned):
  - `tapeVersion`, `recordedAt`, `sdkVersion`, `baseUrl`, `interactions[]`
- Define normalizers:
  - header whitelist/blacklist
  - JSON “mask rules” (paths to redact: e.g. `$.access_token`)
  - stable query param ordering

- [ ] **Step C — Record mode plumbing**

- Implement `fetchRecorder`:
  - wraps `globalThis.fetch`
  - clones request/response to read bodies safely
  - writes interactions to in-memory tape (written at end)
- Add “write guardrails”:
  - refuse to write tapes if secrets are detected unredacted

- [ ] **Step D — Caller mode plumbing**

- Implement `fetchStub`:
  - compares each outgoing request to the next recorded request
  - returns recorded response (or a minimal response) so SDK code can proceed
- Add strict mismatch diffs:
  - show exactly which header/body field differs

- [ ] **Step E — Provider mode plumbing**

- Implement replay engine:
  - apply placeholder substitutions (token, ids)
  - send HTTP requests in order
  - compare normalized responses
- Add variable capture:
  - allow “capture” rules from responses (e.g., extract new token/ids)
  - use captured values in later substitutions

- [ ] **Step F — CLI + scripts**

Add scripts:
- `test:record` → generates/updates tapes
- `test:caller` → offline request-shape verification
- `test:provider` → replay against `BASE_URL`

Add a reporting script (or emit automatically from each mode):
- `report` → writes `reports/...` with diffs and environment metadata

- [ ] **Step G — Prompts to regenerate tapes (interface-change workflow)**

Create `integration-tests/insforge-contract/prompts/regenerate-tapes.md` containing prompts you can give an LLM/Codex to:

- bump SDK version (if needed)
- deploy service to a known environment (preferably production-like)
- run record mode against that environment
- confirm tapes redact secrets
- commit updated tapes with a clear message

Also create `integration-tests/insforge-contract/prompts/sdk-upgrade-safety.md` describing the repeatable workflow for SDK users:
- upgrade `@insforge/sdk` to a target version
- run **caller mode** locally to detect request-shape changes
- run **provider mode** against production (or production-like) InsForge to ensure response compatibility
- only then ship the app upgrade

- [ ] **Step H — CI policy (optional but recommended)**

- Run **caller mode** on every PR (fast, offline, deterministic).
- Run **provider mode** on a schedule or manually (requires credentials + network).
- Gate merges on caller mode to prevent accidental SDK upgrades changing request shapes silently.

Upgrade guarantee for SDK users (practical definition):
- If caller mode passes against the approved tape baseline, the SDK upgrade did not change request shapes for covered scenarios.
- If provider mode passes against the production (or production-like) service, the service remains compatible for covered scenarios.
- Combined, this is the best available evidence that an SDK upgrade will not break production on the covered contract surface.

---

## Success Criteria

- One command generates tapes: record mode.
- One command validates SDK request shapes without network: caller mode.
- One command validates a service implementation against the same contract: provider mode.
- A tape diff is readable and safe (no secrets) and pinpoints “what changed” at the HTTP boundary.
- Reports clearly identify backward-compatibility breaks and which stakeholder (SDK/service/app) needs to act.
