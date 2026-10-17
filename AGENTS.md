# Project instructions

These instructions apply to ToThread, ToReason, and ToOrganize throughout this repository.

## Prompt journaling — required before other work

- Journal every user prompt verbatim in a fenced code block, with an **Action** note and **Result Summary**. Preserve existing entries and update the outcome when work finishes.
- Select the deepest existing `Journal/` directory found by walking upward from explicitly referenced project paths and the current working directory to the Git root (or workspace root for a non-Git workspace). Use `Journal-YYYY-MM.md` for the user's local month.
- If there is no matching journal, do not silently create a directory. Offer candidate locations from the referenced directory up to the project root and wait for the user's selection.
- If journaling fails or its location is ambiguous, stop other work and resolve it with the user first.

## Dependencies and technical debt

- When implementing features, maintaining dependencies, or repairing builds, check all dependencies in the project being worked on, including runtime and development dependencies. Upgrade to the latest stable releases available, including major releases, wherever feasible. Update transitive dependencies through supported parent-package upgrades and keep manifests and lockfiles consistent.
- Complete the corresponding code, configuration, styling, API, and tooling migrations. A breaking change is work to resolve, not by itself a reason to stay on an older version. Do not use a blanket forced update as a substitute for reviewing and completing migrations.
- Fix build failures encountered during the work, including pre-existing failures. Also resolve inexpensive lint, test, compatibility, and security issues encountered along the way rather than deferring them solely because they predate the task. Preserve intended behavior and user data; do not suppress checks or remove functionality just to obtain a passing result.
- Hold back a dependency only when a concrete blocker remains after reasonable investigation and attempted fixes, or when the migration requires a materially disproportionate or separately authorized change. Do not assume an impasse just because a major upgrade is required.
- For every necessary holdback, record the installed and latest versions, the actual blocker, fixes attempted, remaining security implications, and the condition that would permit upgrading. Reconsider the holdback during subsequent dependency work. Never silently downgrade or leave a pin unexplained.
- Verify a clean lockfile-based installation, the production build, relevant tests, lint, and a dependency security audit. Perform focused UI or integration checks for changed behavior. Fix failures under the rules above and state any unresolved blocker or untested workflow clearly.
- Report security results as **known vulnerabilities reported by the audit**, not a guarantee of absolute security. Do not mask findings with a higher audit threshold or unsafe dependency overrides.
- Keep changes reviewable and scoped to the requested work and necessary upgrade/repair work. Preserve existing plans and conventions. Deployments and other external actions still follow the user's authorization.

## Response hygiene

Do not append routine offers or suggestions. Surface follow-ups only when they identify a material risk, tradeoff, blocker, or missing step that could cause failure.
