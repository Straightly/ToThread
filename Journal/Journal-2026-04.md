# Journal 2026-04

## Entry 1
Prompt: "In may folder, I have a project which is a project management application... I want you to create a separate project management application with backend in InsForge. Web application supporting admin/regular users, role selection, project plans. Mimic existing ToThread functions but change backend from YAML/git to InsForge tables."
Action: Launched explore agents to understand the existing ToThread project structure, web client features, backend/YAML storage, and InsForge skills.
Result: Identified full project architecture (Cloudflare Workers backend, Gitea git storage, Google OAuth, iOS app with hierarchical task CRUD). Began planning the new planner web app.

## Entry 2
Prompt: "Sorry, click on the recording by accident. Please resume working."
Action: Resumed exploration and planning work.
Result: Continued building understanding of the codebase.

## Entry 3
Prompt: "I'm using InsForge as my backend platform. Read the current directory, make sure InsForge skills are installed, and use InsForge CLI for backend tasks."
Action: Discovered InsForge skills in .agents/skills/insforge/ and .agents/skills/insforge-cli/; verified project linked in .insforge/project.json.
Result: Confirmed InsForge BaaS setup (Postgres, Auth, SDK) at https://kgcw84it.us-west.insforge.app.

## Entry 4
Prompt: "I want to very easily create an iPhone app based on the web frontend after getting it working. Please choose the easiest technology for that purpose. After that consideration, I would choose React. But only after that consideration."
Action: Evaluated web-to-iOS conversion options; selected React + Vite + Capacitor.
Result: Technology stack decided: React + Vite + Capacitor for future iOS wrapping.

## Entry 5
Prompt: [Selected "Minimal RLS helper (Recommended)" for admin RLS handling]
Action: Chose to keep is_admin() ONLY as a SECURITY DEFINER RLS plumbing function, no business logic in DB.
Result: RLS infinite recursion solved with minimal DB footprint.

## Entry 6
Prompt: [Rejected first plan with "No, keep planning"]
Action: Continued refining the implementation plan.
Result: Plan iteration continued.

## Entry 7
Prompt: "Please write the project plan to a file so I can review it in detail before you execute on it."
Action: Wrote the full project plan to webApp/planner-plan.md.
Result: Plan document created for review.

## Entry 8
Prompt: "tasks table: remove ON DELETE CASCADE. I want to disallow deletion if there are children tasks. In fact, I would like to use soft delete."
Action: Updated plan: removed CASCADE on parent_id FK, added deleted_at TIMESTAMPTZ column, all queries filter deleted_at IS NULL.
Result: Plan updated with soft delete architecture.

## Entry 9
Prompt: "is_admin is now in the database. I would rather have it in my app as I add more type of users and more roles later. same with get_tasks_with_child_counts. I do not want the navigation APIs in the db. Please use simple CRUD apis, making more than one call if needed, but keep the business logic in the middle tier, not in the storage."
Action: Removed RPCs and DB functions for business logic; moved admin checks, child counts, user listing to app-layer JavaScript (taskTree.js).
Result: Plan updated: DB is thin CRUD + RLS only; all business logic in frontend.

## Entry 10
Prompt: "Similar to 1. Do not allow deletion if there are child task and use soft delete for deletion."
Action: Confirmed soft delete with child-check validation in app layer (canSoftDelete function).
Result: Plan consistent with soft delete and no-cascade design.

## Entry 11
Prompt: [Approved the updated plan]
Action: Began implementation of the planner web app.
Result: Implementation started across 8 steps.

## Entry 12
Prompt: [Repeated the 3 design changes from Entries 8-10 after implementation was complete]
Action: Showed the user that all 3 changes were already incorporated during planning.
Result: Confirmed current implementation matches all requirements: soft delete, no CASCADE, no business logic in DB.

## Entry 13
Prompt: "Please deploy to InsForge and give me the testing steps."
Action: Verified build (425KB JS, 13KB CSS), authenticated with InsForge CLI, deployed dist to InsForge hosting.
Result: App deployed live at https://kgcw84it.insforge.site. Provided step-by-step testing instructions covering sign-up, role seeding, task management, admin dashboard, auth edge cases, and swipe gestures.

## Entry 14
Prompt: "Tried to login through Google authentication and got a page saying I do not have any roles."
Action: Found user in auth.users, seeded admin + user roles via SQL, created profile row, fixed AuthContext.jsx to auto-create profiles for Google OAuth users via ensureProfile() in loadSession. Rebuilt and redeployed.
Result: Roles seeded (admin + user). Profile created. OAuth profile auto-creation fix deployed. User should see Role Selector on refresh.

## Entry 15
Prompt: "Crete a journal folder if one does not exist. Please journal ALL my prompts in the appropriate monthly file under ./Journal (e.g., Journal/Journal-YYYY-MM.md), logging each prompt verbatim with an Action note, and backfill any prompts from this session that are not yet written. After executing each prompt, record the summary of the results. Continue logging and do not stop."
Action: Journal folder already exists. Created Journal/Journal-2026-04.md and backfilled all 15 prompts from this session with actions and results.
Result: All session prompts logged in Journal-2026-04.md. Ongoing logging enabled.

## Entry 16
Prompt: "Sign in and sign out worked. And role selection showed up. But Clicking on any of the roles does nothing."
Action: Found that RoleSelectorPage called selectRole() which set state but never navigated away from /select-role. Added useNavigate and navigate('/', { replace: true }) after selectRole. Rebuilt and redeployed.
Result: Fix deployed. Clicking a role now navigates to the main app view.

## Entry 17
Prompt: "Two issues: 1. On the role page, refresh find page not found error. 2. Select admin page leads to the regular page for adding tasks."
Action: (1) Added vercel.json with SPA rewrite rule (source: "/(.*)" -> destination: "/index.html") in public/ so it's included in build output. (2) Updated RoleSelectorPage handleSelect to navigate to /admin when admin role is selected, / for other roles. Rebuilt and redeployed.
Result: Both fixes deployed. SPA routing should handle refreshes on any route. Admin role selection now routes to /admin (AdminDashboard).
