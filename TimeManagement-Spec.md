# Time Management Feature Spec

## Context

The user wants to add time tracking to the planner app. The core idea: a three-state timer (Transitioning / Sleeping / Working) runs continuously once started, recording how time is spent. Working time on tasks rolls up to the nearest Continuous ancestor task for weekly budget tracking. A dedicated /time page allows setting weekly hour budgets, allocating to continuous tasks, and reviewing history (planned vs actual).

## Design Omissions Flagged

1. **No "off" state**: Once the timer starts, it's always in one of three states. There's no way to pause tracking entirely (e.g., vacation). All time accumulates as sleeping, working, or transitioning. This is consistent with the "168 hours per week" requirement.

2. **First partial week**: The very first week of usage won't add up to 168 hours because tracking starts mid-week. Subsequent full weeks will.

3. **Reparenting retroactivity**: If a task is moved to a different continuous parent, all historical time retroactively shifts to the new parent in the weekly view (since aggregation walks the *current* hierarchy). This is a deliberate simplification.

4. **Multi-device race**: If two devices transition simultaneously, last-write-wins on timer_state. Could produce slightly overlapping time_entries. Acceptable for single-user app.

---

## State Transition Diagram

```
                    +-----------------+
       +---stop-----| TRANSITIONING   |---stop---+
       |            |  (initial state)|          (no-op)
       |            +---+--------+----+
       |                |        |
       |   start_sleep  |        | start_work(T)
       |                v        v
    +--+-------+              +--------------+
    | SLEEPING |<-start_sleep-| WORKING(T)   |
    +--+--+----+              +--+-------+---+
       |  |                      |       |
       |  | start_work(T)       |       | start_work(T2), T2!=T
       |  +----------------------+       +------+
       |                                        |
       | start_sleep                    (swap tasks)
       +-(no-op)

  Every arrow exiting Sleeping or Working first records a
  time_entry for the departing segment, then starts the new one.
```

**Transition Table:**

| Current | Action | Result |
|---|---|---|
| Transitioning | start_sleep | -> Sleeping |
| Transitioning | start_work(T) | -> Working(T) |
| Transitioning | stop | no-op |
| Sleeping | stop | -> Transitioning |
| Sleeping | start_work(T) | -> Working(T) |
| Sleeping | start_sleep | no-op |
| Working(T) | stop | -> Transitioning |
| Working(T) | start_sleep | -> Sleeping |
| Working(T) | start_work(T2), T2!=T | -> Working(T2) |
| Working(T) | start_work(T) | no-op |

---

## Database Tables (4 new)

All have RLS with pure ownership check (`user_id = auth.uid()`). No CASCADE, no business logic.

### timer_state
- `user_id` UUID PK
- `mode` TEXT NOT NULL DEFAULT 'transitioning' CHECK (mode IN ('sleeping','working','transitioning'))
- `task_id` UUID nullable (no FK - consistent with soft-delete design)
- `started_at` TIMESTAMPTZ NOT NULL DEFAULT now()

### time_entries
- `id` UUID PK DEFAULT gen_random_uuid()
- `user_id` UUID NOT NULL
- `mode` TEXT NOT NULL CHECK (mode IN ('sleeping','working','transitioning'))
- `task_id` UUID nullable
- `started_at` TIMESTAMPTZ NOT NULL
- `ended_at` TIMESTAMPTZ NOT NULL
- `created_at` TIMESTAMPTZ DEFAULT now()
- INDEX on (user_id, started_at)

### weekly_budgets
- `id` UUID PK DEFAULT gen_random_uuid()
- `user_id` UUID NOT NULL
- `week_start` DATE NOT NULL (always a Monday)
- `total_hours` NUMERIC NOT NULL DEFAULT 0
- UNIQUE (user_id, week_start)

### weekly_allocations
- `id` UUID PK DEFAULT gen_random_uuid()
- `user_id` UUID NOT NULL
- `week_start` DATE NOT NULL
- `task_id` UUID NOT NULL
- `planned_hours` NUMERIC NOT NULL DEFAULT 0
- UNIQUE (user_id, week_start, task_id)

---

## New Files

### src/lib/timeUtils.js — Pure utility functions

- `getWeekStart(date)` — Monday 00:00 local time
- `getWeekEnd(weekStart)` — Next Monday 00:00
- `formatWeekLabel(weekStart)` — "Mar 30 - Apr 5, 2026"
- `computeElapsedMs(startedAt)` — ms since started_at
- `formatDuration(ms)` — "H:MM:SS"
- `msToHours(ms)` — decimal hours, 1 decimal
- `clipEntryToWeek(entry, weekStart, weekEnd)` — clips a time segment to a week window, returns ms in range
- `findLowestContinuousAncestor(taskId, taskMap)` — walks parent chain, returns first Continuous task (including self), or null
- `aggregateWeeklyTime(entries, runningSegment, weekStart, weekEnd, taskMap)` — returns `{ byTask: Map<id, {title, actualMs}>, unallocatedWorkMs, sleepingMs, transitioningMs, totalTrackedMs }`
- `isNoOp(currentMode, currentTaskId, action, newTaskId)` — returns true if transition would be a no-op

### src/contexts/TimerContext.jsx — Global timer state

- Wraps app inside AuthProvider
- State: `{ mode, task_id, started_at, taskTitle }`, `elapsedMs` (1-sec tick)
- Actions: `startWork(taskId, taskTitle)`, `startSleep()`, `stop()`, `refresh()`
- On mount: fetch timer_state from DB; if no row, default to transitioning with null started_at
- First-use: skip time_entry insert on first transition (nothing to record)
- Visibility change listener: refresh() on tab focus (multi-device sync)
- Upsert timer_state, insert time_entry on each transition

### src/hooks/useWeeklyTime.js — Weekly data for TimePage

- Fetches: all tasks, time_entries overlapping the week, weekly_budget, weekly_allocations
- Computes: aggregated actuals via aggregateWeeklyTime
- Returns: budget, allocations, actuals, continuousTasks, saveBudget(), saveAllocation()

### src/hooks/useWeeklyHistory.js — Past weeks summary

- Fetches weekly_budgets + weekly_allocations + time_entries for past ~12 weeks
- For each past week, computes per-task breakdown: planned vs actual per continuous task
- Returns array of { weekStart, budgetHours, allocations: [{taskId, taskTitle, plannedHours, actualHours}], sleepingHours, transitioningHours, unallocatedWorkHours }
- Past weeks are read-only (budgets/allocations cannot be edited after the week ends)

### src/components/timer/TimerBar.jsx — Timer display

- Reads from TimerContext
- Shows: mode indicator (colored dot), task name (if working), elapsed time (monospace)
- Buttons: Stop (when sleeping/working), Sleep (when transitioning/working), "Time ->" (navigates to /time)

### src/components/timer/StartWorkButton.jsx — Play button for task rows

- Props: taskId, taskTitle, isActive
- Active: pulsing green dot (no-op click)
- Inactive: play icon, calls startWork()

### src/pages/TimePage.jsx — Weekly allocation & history page

Layout (no week navigation — always shows current week at top):

```
[<- Back to Tasks To Do]
[TimerBar]

--- This Week (Mar 30 - Apr 5, 2026) ---
Budget: [___] hours

| Continuous Task    | Planned | Actual |
|--------------------|---------|--------|
| Task A             | [10]    | 8.5h   |
| Task B             | [15]    | 12.0h  |
| Allocated total    | 25h     |        |
| Unallocated work   |         | 2.0h   |
| Sleeping           |         | 56.0h  |
| Transitioning      |         | 5.5h   |

--- History ---
(Each past week shown as read-only per-task breakdown)
Week: Mar 23 - Mar 29 | Budget: 40h
| Task A    | Planned: 20h | Actual: 18h |
| Task B    | Planned: 20h | Actual: 22h |
| Unalloc   |              | 3h          |
| Sleep     |              | 55h         |
| Transit   |              | 6h          |
...more past weeks...
```

- Current week section: editable budget + allocation inputs
- History section: read-only past weeks with per-task planned vs actual breakdown
- Budget is optional (can leave blank — actuals still tracked)
- No forward navigation (no future weeks)
- No backward navigation (history scrolls below)

---

## Modified Files

### src/App.jsx
- Import and wrap with TimerProvider (inside AuthProvider)
- Add route: /time -> TimePage (ProtectedRoute + RoleGate)

### src/pages/TodoPage.jsx
- Add TimerBar above task list
- Pass onStartWork and activeTimerTaskId through TodoList to TodoTaskRow

### src/pages/PlannerPage.jsx
- Pass onStartWork and activeTimerTaskId through TaskList to TaskRow

### src/components/tasks/TodoList.jsx
- Accept and pass through: onStartWork, activeTimerTaskId

### src/components/tasks/TodoTaskRow.jsx
- Add StartWorkButton in action area

### src/components/tasks/TaskList.jsx
- Accept and pass through: onStartWork, activeTimerTaskId

### src/components/tasks/TaskRow.jsx
- Add StartWorkButton in action area

---

## Implementation Sequence

1. Create 4 DB tables via SQL (insforge CLI)
2. Create src/lib/timeUtils.js (pure functions)
3. Create src/contexts/TimerContext.jsx
4. Wrap app in TimerProvider (App.jsx)
5. Create TimerBar.jsx, add to TodoPage.jsx
6. Create StartWorkButton.jsx
7. Wire StartWorkButton into TodoTaskRow/TodoList + TaskRow/TaskList + PlannerPage
8. Create useWeeklyTime.js + useWeeklyHistory.js
9. Create TimePage.jsx, add /time route
10. Build, deploy, journal

## Verification

- Build: `cd webApp/planner && CI=true npm run build`
- Deploy: `npx @insforge/cli@0.1.39 deployments deploy ./webApp/planner/dist -y`
- Test: Timer transitions (all 10 rows in transition table), persistence across reload, week boundary splitting, aggregation to continuous ancestors, budget/allocation save/load, history display
