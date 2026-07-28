# InsForge Project Management Application

## Context

The existing ToThread project at `/Users/zhian/Projects/ToThread/` has a project management backend (`webApp/backend/lib/plan.js`) that stores hierarchical tasks as YAML files in a Gitea Git repository, with a Cloudflare Workers API layer. The iOS app (`ios/.../Script.js`) provides a full task management UI with drill-down navigation, swipe gestures, task detail editing, and subtask badges. The web client currently has NO project management UI.

**Related design baseline:** `Planner-PlanningLoop-Phase1.md` defines the current planning-model decision package for overall plans, project plans, daily plans, time budgeting, and review workflows on top of this planner.

**Goal**: Build a new, separate web application within the same repo that replicates all existing project management features, backed by InsForge database tables instead of YAML/Git. The app must support admin and regular user roles.

## Design Principles

1. **No business logic in the database.** The DB layer provides simple CRUD and RLS security only. All business logic (admin checks, child counts, navigation, soft-delete validation) lives in the application layer. This keeps the storage layer swappable (e.g., back to a git depot for versioning/diff).
2. **RLS is the exception.** Row-level security is enforced at the DB because it is a security concern at the source. A minimal `is_admin()` SECURITY DEFINER helper exists solely to prevent RLS infinite recursion on `user_roles` — it is security plumbing, not business logic.
3. **Soft delete.** Tasks are never hard-deleted. A `deleted_at` timestamp marks removal. Deletion is blocked if non-deleted children exist (enforced in the app layer).

## Technology Stack

- **Frontend**: React + Vite (Capacitor-ready for future iOS wrapping)
- **Backend**: InsForge BaaS (Postgres + Auth + SDK)
- **Styling**: Tailwind CSS v3.4
- **Auth**: InsForge built-in auth (email/password + Google OAuth)
- **SDK**: `@insforge/sdk` talking to `https://kgcw84it.us-west.insforge.app`

## Directory Structure

New app at `webApp/planner/`:

```
webApp/planner/
├── index.html
├── package.json
├── vite.config.js             # base: './' for Capacitor-readiness
├── tailwind.config.js         # v3.4
├── postcss.config.js
├── public/
│   └── favicon.ico
└── src/
    ├── main.jsx               # Entry point
    ├── App.jsx                # AuthProvider + BrowserRouter + Routes
    ├── insforge.js            # SDK client singleton
    ├── contexts/
    │   └── AuthContext.jsx    # Session management, getCurrentUser
    ├── hooks/
    │   ├── useAuth.js         # useContext(AuthContext) shorthand
    │   ├── useTasks.js        # Task CRUD via simple SDK queries
    │   ├── useUserRoles.js    # Fetch current user's roles
    │   └── useAdminUsers.js   # Admin: list users, manage roles
    ├── lib/
    │   ├── taskTree.js        # isDone, isContinuous, countUnfinished, canDelete, isAdmin
    │   └── constants.js       # STATUS_VALUES, ROLE_NAMES
    ├── pages/
    │   ├── LoginPage.jsx      # Email/password + Google OAuth
    │   ├── RoleSelectorPage.jsx  # Pick role if user has multiple
    │   ├── AdminDashboard.jsx # User + role management
    │   └── PlannerPage.jsx    # Main task management (mimics iOS UI)
    ├── components/
    │   ├── layout/
    │   │   ├── AppShell.jsx   # Top bar, sign out, role badge
    │   │   └── NavBar.jsx     # Breadcrumb trail for task navigation
    │   ├── auth/
    │   │   ├── LoginForm.jsx
    │   │   └── OAuthButton.jsx
    │   ├── tasks/
    │   │   ├── TaskList.jsx
    │   │   ├── TaskRow.jsx    # Title, status, badge, swipe/click
    │   │   ├── TaskDetailOverlay.jsx  # Full editor overlay
    │   │   ├── AddTaskButton.jsx
    │   │   ├── StatusBadge.jsx
    │   │   ├── SubtaskBadge.jsx
    │   │   └── ArbitraryFields.jsx    # Dynamic key-value field editor
    │   └── admin/
    │       ├── UserTable.jsx
    │       ├── RoleEditor.jsx
    │       └── InviteUserForm.jsx
    └── styles/
        └── index.css          # Tailwind directives
```

## Database Schema

The database is a thin storage layer — simple tables with RLS. No stored procedures, no RPC functions, no business logic. All aggregation, validation, and role-checking happens in the app.

### Table: `profiles` (denormalized user info for app-layer queries)

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

Populated by the app on sign-up. Lets the admin dashboard list users without needing a DB function to access `auth.users`.

### Table: `user_roles`

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
```

### Table: `tasks` (adjacency list, soft delete, no CASCADE)

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  parent_id UUID REFERENCES tasks(id),          -- NO CASCADE: prevent orphaning
  position INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'In Progress', 'Done', 'Blocked', 'Continuous')),
  description TEXT,
  result TEXT,
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,                        -- soft delete: NULL = active
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX idx_tasks_user_parent_position ON tasks(user_id, parent_id, position);
CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at);

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();
```

**Soft delete rules (enforced in app layer, NOT in DB):**
- To "delete" a task: `UPDATE tasks SET deleted_at = NOW() WHERE id = ?`
- Before soft-deleting: app queries for active children (`parent_id = task_id AND deleted_at IS NULL`). If any exist, reject the deletion with an error message.
- All queries filter `deleted_at IS NULL` to show only active tasks.

### Helper function: `is_admin` (RLS plumbing only)

This is the sole DB function. It exists only to prevent infinite RLS recursion on `user_roles` (a Postgres technical constraint). It is NOT business logic — it is security infrastructure in the same category as RLS itself.

```sql
CREATE OR REPLACE FUNCTION is_admin(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = uid AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### RLS Policies

**`profiles`**:
- `authenticated_read_profiles`: SELECT WHERE `auth.uid() IS NOT NULL` (any logged-in user can read profiles)
- `users_insert_own_profile`: INSERT WITH CHECK `id = (SELECT auth.uid())`
- `users_update_own_profile`: UPDATE USING/WITH CHECK `id = (SELECT auth.uid())`

**`user_roles`**:
- `users_read_own_roles`: SELECT WHERE `user_id = (SELECT auth.uid())`
- `admins_read_all_roles`: SELECT WHERE `is_admin((SELECT auth.uid()))`
- `admins_insert_roles`: INSERT WITH CHECK `is_admin((SELECT auth.uid()))`
- `admins_delete_roles`: DELETE WHERE `is_admin((SELECT auth.uid()))`

**`tasks`**:
- `users_read_own_tasks`: SELECT WHERE `user_id = (SELECT auth.uid()) AND deleted_at IS NULL`
- `users_insert_own_tasks`: INSERT WITH CHECK `user_id = (SELECT auth.uid())`
- `users_update_own_tasks`: UPDATE USING `user_id = (SELECT auth.uid())` WITH CHECK `user_id = (SELECT auth.uid())`
- No DELETE policy — tasks are never hard-deleted; soft delete is an UPDATE

### Seed Data (run after zhian.job@gmail.com signs up)

```sql
INSERT INTO user_roles (user_id, role)
SELECT id, unnest(ARRAY['admin', 'user']) FROM auth.users WHERE email = 'zhian.job@gmail.com';
```

## Auth Flow

1. App loads -> `AuthContext` calls `insforge.auth.getCurrentUser()` for existing session
2. No session -> `LoginPage` with email/password form + Google OAuth button
3. On auth success -> `useUserRoles` queries `user_roles` for current user
4. Multiple roles -> `RoleSelectorPage` asks user to pick admin or regular user
5. Single role or role selected -> route to `AdminDashboard` or `PlannerPage`
6. No roles -> show "account pending" message (admin hasn't assigned roles)

## Features to Implement (mirroring existing iOS app)

### Task Management (PlannerPage - mimics iOS Script.js)
- **Navigation stack**: Drill-down into subtasks with breadcrumb trail
- **Task list**: Shows tasks at current level ordered by position
- **Subtask badge**: "unfinished/total" count per task (computed in app: fetch children, count in JS)
- **Add task**: At current level (top-level or as subtask of current parent)
- **Mark done**: Button visible when task is not done/continuous and all children are done
- **Soft delete**: Sets `deleted_at = NOW()`. App checks for active children first — blocks deletion if any exist. Confirmation dialog before soft-deleting.
- **Task detail overlay**: Edit title, status, tags, description, result, arbitrary custom fields
- **Arbitrary fields**: Dynamic key-value editor in `custom_fields` JSONB
- **Show/hide finished**: Toggle to filter out Done tasks
- **Touch interactions**: Swipe right = open subtasks, swipe left = delete
- **Desktop interactions**: Chevron icon for drill-down, trash icon for delete
- **Status values**: Pending, In Progress, Done, Blocked, Continuous

### Admin (AdminDashboard)
- **User list**: Query `profiles` + `user_roles` via SDK, join in JS (no DB function)
- **Role check**: App queries `user_roles` for current user, checks role in JS
- **Role editor**: Toggle admin/user roles per user (INSERT/DELETE on `user_roles`)
- **Invite user**: Form to create new user with email + temp password + role assignment

## Implementation Steps

### Step 1: Scaffold Project
- Create `webApp/planner/` with Vite + React template
- Install deps: `@insforge/sdk`, `react-router-dom`, `tailwindcss@3.4`, `postcss`, `autoprefixer`
- Configure Vite (`base: './'`), Tailwind, PostCSS
- Create `src/insforge.js` SDK client singleton

### Step 2: Create Database Schema
- Run all SQL via `npx @insforge/cli db query` (use insforge-cli skill):
  1. `profiles` table + RLS policies
  2. `user_roles` table + RLS policies
  3. `is_admin()` SECURITY DEFINER function (RLS plumbing only)
  4. `tasks` table + indexes + trigger + RLS policies (soft delete, no CASCADE, no DELETE policy)
- No RPC functions. No stored procedures.

### Step 3: Authentication
- `AuthContext.jsx` with InsForge session management
- `LoginPage.jsx` with email/password + Google OAuth
- On sign-up: app inserts a row into `profiles` with user's id/email/name
- `useUserRoles.js` hook: queries `user_roles` via SDK, checks roles in JS
- `RoleSelectorPage.jsx` for multi-role users
- `ProtectedRoute` + `AdminRoute` wrappers (admin check in JS, not DB)
- Test: sign up as zhian.job@gmail.com, seed admin+user roles via CLI

### Step 4: Task Management UI
- `PlannerPage.jsx` with navigation stack state
- `useTasks.js` hook: simple SDK CRUD queries
  - Fetch tasks at level: `from('tasks').select().eq('parent_id', parentId).is('deleted_at', null).order('position')`
  - Fetch children for badges: `from('tasks').select('id, status').eq('parent_id', taskId).is('deleted_at', null)`
  - Child counts computed in JS from the fetched children
- `TaskList.jsx` + `TaskRow.jsx` rendering
- `NavBar.jsx` breadcrumbs
- `AddTaskButton.jsx`, mark done
- "Show finished" toggle

### Step 5: Soft Delete
- Before soft-deleting: `from('tasks').select('id').eq('parent_id', taskId).is('deleted_at', null)`
- If children exist: show error "Cannot delete task with active subtasks"
- If no children: `from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', taskId)`
- Confirmation dialog before executing

### Step 6: Task Detail Editor
- `TaskDetailOverlay.jsx` with form fields
- `ArbitraryFields.jsx` for custom key-value pairs
- `StatusBadge.jsx` + `SubtaskBadge.jsx`
- Save flow: merge fields + SDK update

### Step 7: Admin Features
- `AdminDashboard.jsx` page
- `useAdminUsers.js` hook:
  - Fetch all profiles: `from('profiles').select()`
  - Fetch all roles: `from('user_roles').select()` (admin RLS allows this)
  - Join in JS to build user-with-roles list
  - `isAdmin()` check in JS: look for 'admin' role in current user's roles
- `UserTable.jsx` + `RoleEditor.jsx` (SDK insert/delete on `user_roles`)
- `InviteUserForm.jsx` (create user + assign roles)
- `AdminRoute` guard (checks roles in React state)

### Step 8: Polish & Deploy
- Loading/error/empty states
- Responsive design for mobile/tablet/desktop
- Build and deploy via `npx @insforge/cli deployments deploy ./dist`

## App-Layer Business Logic (lib/taskTree.js)

All business logic lives here, not in the database:

```javascript
// Role checking
export function isAdmin(roles) { return roles.includes('admin'); }

// Task status helpers
export function isDone(task) { return task.status === 'Done'; }
export function isContinuous(task) { return task.status === 'Continuous'; }

// Subtask badge computation (called with fetched children)
export function countChildren(children) {
  const total = children.length;
  const unfinished = children.filter(c => c.status !== 'Done').length;
  return { total, unfinished };
}

// Soft delete validation (called with fetched children)
export function canSoftDelete(activeChildren) {
  return activeChildren.length === 0;
}

// Can mark done: not already done, not continuous, all children done
export function canMarkDone(task, children) {
  if (isDone(task) || isContinuous(task)) return false;
  return children.every(c => c.status === 'Done');
}

// Build user-with-roles list from separate queries
export function joinUsersWithRoles(profiles, roles) {
  const roleMap = {};
  for (const r of roles) {
    if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
    roleMap[r.user_id].push(r.role);
  }
  return profiles.map(p => ({ ...p, roles: roleMap[p.id] || [] }));
}
```

## Reference Files (existing implementations to mimic)

- `webApp/backend/lib/plan.js` — Task CRUD backend logic, YAML parsing, tree traversal
- `ios/ToThreadCaptureApp/ToThreadCapture/Shared (App)/Resources/Script.js` — iOS UI: navigation stack, swipe handlers, task detail overlay, subtask badges
- `webApp/backend/lib/routes.js` — API route handlers
- `webApp/backend/lib/auth.js` — Existing auth pattern
- `webApp/backend/ui/main.js` — Existing web UI patterns

## Verification

1. **Schema**: Run `npx @insforge/cli db tables` to confirm `profiles`, `user_roles`, `tasks` exist
2. **Auth**: Sign up, sign in, verify profile row created, role fetching works
3. **Role selector**: Confirm multi-role user sees selector page
4. **Task CRUD**: Create task, add subtask, edit details, mark done
5. **Soft delete**: Verify soft-deleting a task with children is blocked with error message
6. **Soft delete**: Verify soft-deleting a leaf task sets `deleted_at` and hides it from the list
7. **Navigation**: Drill into subtasks, navigate back via breadcrumbs
8. **Subtask badges**: Verify counts update after adding/completing subtasks (computed in JS)
9. **Admin**: List users (profiles + roles joined in JS), assign/remove roles
10. **RLS**: Verify regular user cannot read other users' tasks or modify `user_roles`
11. **Build**: `npm run build` succeeds, deploy to InsForge hosting
