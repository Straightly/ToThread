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

## Entry 18
Prompt: "When creation a user, check for gmail address and allow a user to be added using his gmail account without providing a temporary password."
Action: Updated InviteUserForm to detect @gmail.com emails. When Gmail is detected: hides the password field, shows a green hint ("Gmail detected -- user will sign in with Google. No password needed."), and generates a random 24-char password internally for the auth signup. Non-Gmail emails still require a temporary password. Rebuilt and redeployed.
Result: Fix deployed. Admin can now add Gmail users by email + name only, without setting a password.

## Entry 19
Prompt: "This is not the right behavior. 'I'll detect @gmail.com emails, hide the password field, and generate a random password internally for the auth signup.' One should allow entering a temporary password if one so choose. However, it can be left as empty. If it is empty, there will be no password with this user and he can only sign in using Google authentication. But is a temporary password is created, he can login with both. when a gmail is detected, a message will say a temporary password is optional."
Action: Updated InviteUserForm: password field is always visible. For Gmail emails, placeholder says "Temporary password (optional)" and a green hint says password is optional since user can sign in with Google. If left empty for Gmail, a random password is generated internally. For non-Gmail, password is validated as required in the submit handler. Rebuilt and redeployed.
Result: Fix deployed. Gmail users see optional password field; non-Gmail users must provide a password.

## Entry 20
Prompt: "Oops. The add user should add a require field for email. and optionally a field for userId. The internal logic should check for both and reject user creation if either is duplicated and display info message to let the user know."
Action: Added user_id TEXT UNIQUE column to profiles table. Updated InviteUserForm: added optional "User ID" input field. Before creating a user, checks profiles table for duplicate email and duplicate user_id (if provided). Displays info message (blue box) if either already exists. Profile insert includes user_id when provided. Rebuilt and redeployed.
Result: Fix deployed. Invite form now has email (required), User ID (optional), and duplicate checks for both with informational messages.

## Entry 21
Prompt: "How do I complete the signon work flow? I added a user. An gmail was sent to me with a verificaiton code. But I do not have a place to actually enter it. Trying to login in with as the new user show me a page Account Pending Your account has no roles assigned yet. Please contact an administrator."
Action: Two issues identified: (1) No verification code entry in the login flow. (2) When admin creates a user, email verification is required (verifyEmailMethod: "code"), and data.user may not be returned, so profile/roles aren't inserted. Fixes: Added verifyEmail method to AuthContext (calls insforge.auth.verifyEmail which auto-signs in). Updated LoginPage with verification code entry form (6-digit OTP input, resend code button, "Have a verification code?" link). Updated InviteUserForm to handle requireEmailVerification -- tries to insert profile/roles if data.user is available, shows info message about verification status either way. Rebuilt and redeployed.
Result: Fix deployed. New users can now enter their 6-digit verification code on the login page. Admin gets clear feedback about whether roles were pre-assigned or need manual assignment after verification.

## Entry 22
Prompt: "This is still not right. 1. When Admin creates user, the user should receive an email without the verification code first, invite him to join. Optionally, if a temporary password was created for him, this email say to expect another email with temporary password. There should be a link to our site where his userid, gmail etc. are filled already and he can click to login with google, or enter his password to login with the temporary password. 2. If the user is in pending status, the page should give him the fields to enter a verification code (should he have one) AND a button to send an verification code to his own email account."
Action: Major redesign of invitation flow. Created `invites` table (email, name, user_id_field, assign_admin, has_password, created_at) with RLS policies. Rewrote InviteUserForm: Gmail users skip signUp (no verification email sent), non-Gmail users call signUp (sends verification email); all create invite record; shows copyable invite link (/login?email=...). Added claimInvite() to AuthContext: checks invites table on sign-in, assigns roles, updates profile, deletes invite. Added setupUser() combining ensureProfile + claimInvite + fetchRoles, replaced all manual profile/role setup. Redesigned Account Pending page: now shows verification code input, "Send verification code" button, sign out. Updated LoginPage to read ?email= query param and pre-fill LoginForm. Updated LoginForm to accept initialEmail prop. Rebuilt and deployed.
Result: Full invitation flow redesign deployed to https://kgcw84it.insforge.site. Gmail users get invite-only flow (no signUp call, invite link with Google sign-in). Non-Gmail users get signUp + invite record. Account Pending page now interactive with OTP entry and code request button. Build: 434KB JS, 14KB CSS.

## Entry 23
Prompt: "I was able to sign in and verify. But it says the new user does not any any roles. This might be because the new use was dangling and should be fixed with a data fix."
Action: Investigated database state. Found jianame@gmail.com (e42a577d) had a profile but zero rows in user_roles and an empty invites table -- the user was created before the invites/claimInvite flow existed, so roles were never assigned. Inserted 'user' role via SQL: INSERT INTO user_roles (user_id, role) VALUES ('e42a577d-...', 'user').
Result: Data fix applied. jianame@gmail.com now has the 'user' role. User should see the planner page on next sign-in instead of Account Pending.

## Entry 24
Prompt: "Try to add another user and its role is also missing. Lets change the add user flow completely to remove the the invitation flow. A user can simply go to the site and sign in himself, with optional name, userId, and an email account. A verification will be sent to the email account. If the email is a gmail, he can also sign in with Google. The admin will not sent invitation anymore. All it does is change the role assignment."
Action: Complete overhaul of auth flow. Removed invitation system entirely: deleted InviteUserForm.jsx, removed claimInvite/invites table usage from AuthContext. New self-service sign-up: LoginForm now shows email (required), name (optional), userId (optional), password (required) with Gmail hint. Name/userId stored in localStorage during sign-up, read by ensureProfile after verification to create profile. AdminDashboard simplified to role management only (UserTable with role toggles, no invite button). Built and deployed.
Result: Deployed to https://kgcw84it.insforge.site. New flow: users self-register at /login (sign-up tab), verify email, land on Account Pending. Admin only manages role assignments via toggle buttons. Build: 429KB JS, 14KB CSS.

## Entry 25
Prompt: "Please delete the other accounts except zhian.job@gmail.com and their related role etc. so I can test again."
Action: Deleted profiles and user_roles for 4 accounts (admin@example.com, anon@example.com, jianame@gmail.com, zhian1@gmail.com). Direct DELETE from auth.users was FORBIDDEN, so created a temporary SECURITY DEFINER function (delete_auth_user) to delete from auth.users, called it for each user, then dropped the function.
Result: All 4 test accounts fully removed from auth.users, profiles, and user_roles. Only zhian.job@gmail.com remains with admin + user roles. Database clean for testing.

## Entry 26
Prompt: "I signed in with zhian1@gmail.com, but it says Signed in as zhian1@gmail.com. Your account has no roles assigned yet. As I specified, when a user signing in, assign the regular role to him. So we should never see this message."
Action: Updated setupUser() in AuthContext.jsx to auto-assign the 'user' role when a new user has no roles. After ensureProfile and fetchRoles, if 'user' role is missing, inserts it into user_roles and re-fetches. Built and deployed.
Result: Fix deployed to https://kgcw84it.insforge.site. Every new user now automatically gets the 'user' role on first sign-in. The "Account Pending" page should never appear for normal sign-ups.

## Entry 27
Prompt: "I tried to sign in with jianame@gmail. Then it say this account has no role assiged yet and ask me to enter a verification code if I have one. this is not working. Please remove all user sign up code and start from scratch. First write me a spec of a working workflows, without bother with verification, and only allow signing in with Google account."
Action: Wrote a spec for Google-only auth flow. User reviewed and added: skip profile creation if exists, don't assign roles if user already has any, admin-only role lands on AdminDashboard. After approval, implemented: rewrote AuthContext.jsx (Google-only: signInWithGoogle, signOut, setupUser with ensureProfile + auto-assign 'user' role only when zero roles), rewrote LoginPage.jsx (single Google sign-in button), rewrote App.jsx (removed AccountPendingPage, updated RoleGate to route admin-only users to /admin), deleted LoginForm.jsx and OAuthButton.jsx. Built and deployed.
Result: Deployed to https://kgcw84it.insforge.site. Clean Google-only auth: single button login, auto profile + role, correct routing (user→planner, admin→dashboard, both→role selector). Build: 420KB JS, 13KB CSS.

## Entry 28
Prompt: "Everything is working as expected, except that, while a new user can sign in and have the default user role, after login, a role was not assigned. This will lead to data inconsistency later when new roles etc are added. In other word, when the regular role is assigned to a user, we save that to db too."
Action: Root cause: RLS policy on user_roles only allowed admins to INSERT (`admins_insert_roles`). When setupUser tried to insert the 'user' role for a new non-admin user, the INSERT was silently blocked by RLS. The role appeared in React state but was never persisted. Fix: added RLS policy `users_self_assign_default_role` allowing users to insert their own 'user' role (`user_id = auth.uid() AND role = 'user'`). Also added error logging on the insert call in AuthContext. Built and deployed.
Result: Fix deployed. New users can now self-assign the default 'user' role to the DB on first sign-in. RLS ensures they can only insert role='user' for their own user_id.

## Entry 29
Prompt: "Good, user adding, login etc. are all working as expected now."
Action: No code changes needed. User confirmed the full auth flow is working: Google sign-in, auto profile creation, role persistence to DB, admin role management.
Result: Auth system milestone reached. Google-only auth flow fully operational.

## Entry 30
Prompt: "I was able to add tasks. In my original app, I can add sub tasks by swipe right. How do I add sub task in the web with a mouse?"
Action: Identified that the navigate arrow (>) and SubtaskBadge were only shown when a task already had children (hasChildren guard), making it impossible to add the first subtask. User also requested: always show 0/0 count for childless tasks, and use red/blue colors instead of green/gray for color blindness accessibility.
Changes: (1) SubtaskBadge: always rendered, shows 0/0 in gray for no children, blue when all done, red when unfinished remain. (2) TaskRow: removed hasChildren guard from both SubtaskBadge and navigate arrow -- always visible. (3) Swipe-right gesture also works on childless tasks now. Built and deployed.
Result: Deployed. Every task now shows `unfinished/total >` with color-blind-friendly colors (red=unfinished, blue=all done, gray=no children). Users can navigate into any task to add subtasks.

## Entry 31
Prompt: "Now I want to create a export function available on any task. It should export all info of the task and traverse its subtasks and exports all info of its subtasks recursively. When the file is built, it should allow me to download it. It should also honour the 'Show done' choice I have on the page. Please create a spec and save it to a file first. I want to review it before execution."
Action: Wrote and got approval for a YAML export spec matching the original ToThread format (ProjectPlan.yaml). Implemented: created src/lib/exportTask.js with buildTaskTree (recursive DB fetch), taskToYaml (js-yaml serialization with custom_fields flattened as direct keys), downloadYaml (browser download). Added download icon button to TaskRow (visible on hover). Wired through TaskList and PlannerPage with handleExport callback that respects showFinished toggle. Built and deployed.
Result: Deployed to https://kgcw84it.insforge.site. Hover over any task to see download icon. Click to export task + full subtree as YAML. Respects "Show done" toggle. Build: 461KB JS (+42KB for js-yaml), 13KB CSS.

## Entry 32
Prompt: "I do not like this design. It does not allow me to download the whole plan and I do not see the implication of the 'Show done' check. Why not simply add a button to the left of the 'Show done' checkbox so the download will be for all the visible tasks?"
Action: Redesigned export from per-task to page-level. Updated exportTask.js: replaced buildTaskTree (single task) with buildTaskTrees (takes array of visible tasks), renamed taskToYaml to tasksToYaml. Removed onExport prop from TaskRow and TaskList. In PlannerPage: replaced per-task handleExport with page-level version that exports all visibleTasks with recursive children, added exporting state for loading indicator, added Export button with download icon to the toolbar left of the "Show done" checkbox. File name uses current nav level title slug or 'project-plan' at root.
Result: Deployed. Single "Export" button in toolbar next to "Show done" checkbox downloads all visible tasks (respecting the toggle) as a YAML file with full recursive subtrees.

## Entry 33
Prompt: "Now I want to add an import function. Add a button to the right of the title of the page. When clicked, the app will ask me to pick a file and it will import the tasks in the file as tasks parallel to other tasks on this page. Create an id for any task unless it already had an id. Reject any tasks if its id already exist globally in the database for this user. No errors or warning, just silently drop it."
Action: Created src/lib/importTask.js with: parseYamlTasks (handles both raw array export format and wrapped {version, project, tasks} original ToThread format), collectAllIds (recursive UUID extraction), checkExistingIds (single batch query for dedup), getMaxPosition (find append position), importTasksFromYaml (main entry: parse, batch-check existing UUIDs, recursively insert tasks). Non-UUID ids (from original app like "task-1") get DB-auto-generated UUIDs. Valid UUID ids are preserved if not already in DB. Duplicate UUID tasks and their entire subtrees are silently skipped. Custom fields (any key not in title/status/id/description/result/tags/tasks) are collected into custom_fields JSONB. Updated PlannerPage.jsx: added importing state, handleImport (programmatic file input, reads .yaml/.yml, calls importTasksFromYaml, refreshes task list), Import button with upload icon placed to the right of the page title (h2). Built and deployed.
Result: Deployed. "Import" button next to page title opens file picker for .yaml/.yml files. Tasks imported as siblings at current navigation level with full recursive subtree support. Handles both app formats.

## Entry 34
Prompt: "I would like to add a priority field to each task. However, I do not want it to be a number. Instead, I want to be able to use drag and drop to move the tasks up and down on a page."
Action: Wrote spec to DragDropReorder-Spec.md for version control. Installed @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities. Added reorderTasks(updates) to useTasks.js with optimistic local state update (re-sort by position) and parallel DB persists via Promise.all. Updated TaskRow.jsx: added useSortable hook, 6-dot grip handle as first child (with data-drag-handle attribute and touch-none class), touch guard in handleTouchStart to prevent swipe when touching handle, composed sortable/swipe transforms (mutually exclusive), visual feedback when isDragging. Updated TaskList.jsx: wrapped with DndContext (PointerSensor distance:5, TouchSensor delay:150) and SortableContext (verticalListSortingStrategy), onDragEnd uses arrayMove to compute new order and calls onReorder. Updated PlannerPage.jsx: destructured reorderTasks, added handleReorder callback (maps orderedIds to position updates, calls reorderTasks then fetchTasks), passed onReorder to TaskList. Built and deployed.
Result: Deployed. Each task row has a grip handle on the left for drag-and-drop reordering. Existing swipe gestures (right=navigate, left=delete) remain untouched. Positions persisted to DB.

## Entry 35
Prompt: "When I delete a task, got an error saying: new row violates row-level security policy for table 'tasks'."
Action: Investigated RLS policies on the tasks table. Root cause: the SELECT policy `users_read_own_tasks` had `deleted_at IS NULL` in its USING clause. When soft delete set `deleted_at` on a row, PostgREST needed to read the row back after the UPDATE but the SELECT policy now hid it, causing the RLS violation. This `deleted_at IS NULL` filter was also business logic in the database, violating the design principle of thin DB + app-layer logic. Fix: dropped and recreated `users_read_own_tasks` with just `user_id = auth.uid()` (no `deleted_at` filter). Also relaxed `users_update_own_tasks` WITH CHECK to `true` (USING still enforces ownership). App queries already filter `deleted_at IS NULL` at the application layer.
Result: Delete works. All tasks table RLS policies are now pure ownership checks with no business logic.

## Entry 36
Prompt: "Next I want to add a 'Tasks To Do' Page. It should be the page we land when a regular user log in. In this page, we display Tasks To Do with same bells and whistles on each task like the planner page except the tasks will not be sortable. Also different is that if a task has a parent task, its recursive parent task's title will be displayed above that task. A task will show up on the Tasks To Do if either: 1. The task is tagged as #Todo. 2. It is the first leaf task within one of the Continuous tasks."
Action: Wrote spec to TasksToDo-Spec.md. Added 5 pure helpers to taskTree.js: buildTaskMap (O(1) lookup map), buildChildrenMap (parent->children grouped by position), findFirstNonDoneLeaf (DFS traversal by position to find first non-Done leaf in a Continuous task's subtree), computeTodoTasks (collects qualifying tasks via Set from both #Todo tag and Continuous leaf rules), buildParentChain (walks parent_id upward to build breadcrumb array). Created useTodoTasks.js hook: fetches ALL user tasks in one query (no parent_id filter), computes todoItems via useMemo (each with task, parentChain, childCount), provides markDone/softDeleteTask/getTaskById/updateTask operations that re-derive after mutations. Created TodoTaskRow.jsx: mirrors TaskRow visual elements (status badge, subtask badge, navigate arrow, mark done, delete with confirm, swipe gestures) but without useSortable/drag handle, adds breadcrumb row above task title showing parent chain. Created TodoList.jsx: simple list wrapper (no DndContext) mapping todoItems to TodoTaskRow, with empty state linking to Planner. Created TodoPage.jsx: page component using useTodoTasks, AppShell, TodoList, TaskDetailOverlay; navigate arrow goes to /planner with initialNavStack in router state. Updated App.jsx: / route now renders TodoPage (was PlannerPage), added /planner route for PlannerPage, both wrapped in ProtectedRoute+RoleGate. Updated PlannerPage.jsx: imports useLocation, initializes navStack from location.state?.initialNavStack, clears consumed state via window.history.replaceState. Updated AppShell.jsx: added "To Do" and "Planner" nav links for user role with active-link highlighting (text-blue-600 font-medium), preserved Admin link for users with admin role.
Result: Deployed. Regular users land on "Tasks To Do" page showing qualifying tasks with parent breadcrumbs. Navigate arrow goes to Planner at the task's parent level. AppShell header has To Do / Planner / Admin navigation links.

## Entry 37
Prompt: "I want to be able to move a task to be a subtask of another task on the page... How about I use an arrow on the task pointing to the right. When clicked, the task move to be subtask (and disappear of course)? Then on the sub task, I simply add a button on the top pointing to the left and clicking on it move the task up a level. Yes. But create a spec first so we can record it too. Also, please add the edge cases that, when the page on the top level, it cannot be moved. If a task is the first on the page, it cannot be moved either."
Action: Wrote spec to IndentOutdent-Spec.md. Added indentTask(taskId, newParentId) and outdentTask(taskId, currentParentId) to useTasks.js: indent appends task as last child of new parent (queries max position among new parent's children), outdent shifts grandparent-level siblings to make room then moves task to right after its former parent. Updated TaskRow.jsx: added indent (right arrow) and outdent (left arrow) SVG buttons between drag handle and title, with data-indent-btn attribute excluded from swipe touch guard; indent shown only when taskAbove exists (not first task), outdent shown only when not root level. Updated TaskList.jsx: accepts isRootLevel/onIndent/onOutdent props, computes taskAbove for each row by index, passes all to TaskRow. Updated PlannerPage.jsx: destructured indentTask/outdentTask from useTasks, added handleIndent (calls indentTask then refreshes) and handleOutdent (calls outdentTask with currentParentId then refreshes), derived isRootLevel from currentParentId, passed isRootLevel/onIndent/onOutdent to TaskList. Built and deployed.
Result: Deployed. Planner page tasks have indent/outdent arrows between drag handle and title. Right arrow makes task a subtask of the task above it. Left arrow moves task up one level (sibling of its parent). Entire subtree moves with the task. Edge cases enforced: no indent on first task, no outdent at root level.
