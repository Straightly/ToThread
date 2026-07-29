# Planner Planning Loop — Phase 1 Decision Package

## Purpose

This Phase 1 package defines the planning model for the ToThread planner before we change the app. The goal is to remove ambiguity so later implementation work can focus on execution instead of re-deciding core concepts.

## Phase 1 Outputs

- Planning architecture decision
- Domain/data model
- Workflow model
- Product rules/invariants
- Gap analysis against the current planner
- Executable implementation backlog

---

## Decision Summary

### Decision 1 — Build on the current InsForge planner app

Use the existing planner at `webApp/planner/` as the implementation base.

**Why**
- It already has working task hierarchy, todo derivation, auth, and time tracking.
- The user’s current need is planning effectiveness, not a storage-platform migration.
- The deferred Git-native project-graph direction in `ProjectPlan.md` remains valuable, but it is too large to be the first step for this planning/time-budget loop.

### Decision 2 — Add a first-class plan layer above tasks

The current app has a single task tree. That is not enough to represent:
- one overall plan,
- multiple smaller project plans,
- explicit daily plans,
- and review artifacts.

So Phase 2+ should introduce first-class **plans**, while keeping **tasks** as the executable work items.

### Decision 3 — Make daily planning explicit, not only derived

The current `/` page is a useful computed “what’s next” list, but it is not a true daily plan. We need a materialized daily plan so the user can intentionally choose:
- today’s top tasks,
- planning/review tasks,
- and a time budget for the day.

### Decision 4 — Keep full-day accounting as a hard product rule

The time system should continue to treat the day as fully accounted for. The product should report whether a day is complete and how the 24 hours were spent.

### Decision 5 — Planning itself is work

Planning, review, and admin/organizing effort should be modeled as real tasks and real time, not invisible overhead.

---

## Scope

## In Scope

- Overall plan composed of smaller project plans
- Explicit daily planning
- Daily and weekly time budgeting
- Actual-time tracking that supports full-day accounting
- Review loop comparing budget vs actual

## Out of Scope For This Phase

- Implementing the UI or migrations
- Replacing InsForge with the deferred Git-native plan graph
- Advanced analytics, permissions, or collaboration workflows

---

## Current-State Assessment

## What already exists

- A single hierarchical task planner: `webApp/planner/src/pages/PlannerPage.jsx`
- A cross-hierarchy “top tasks” page: `webApp/planner/src/pages/TodoPage.jsx`
- Todo derivation logic across the task tree: `webApp/planner/src/hooks/useTodoTasks.js`
- A weekly time-budget page: `webApp/planner/src/pages/TimePage.jsx`
- A running timer and time ledger foundation: `webApp/planner/src/contexts/TimerContext.jsx`

## What is missing

- No first-class overall plan
- No separation between one project plan and another project plan
- No explicit daily plan artifact
- No explicit day-close or week-close review workflow
- No strong “24-hour completeness” validation/report
- No direct link from plan selection -> time budget -> actual review

---

## Domain Model

This section defines the logical model. It is intentionally product-first, not yet a final SQL schema.

## 1. Plan

A **plan** is a container for intentional work.

### Plan types

- `overall` — the top-level umbrella plan
- `project` — a plan for one project or subproject
- `daily` — a plan for one calendar day
- `review` — a plan/review artifact for daily or weekly reflection

### Required fields

- `id`
- `user_id`
- `type`
- `title`
- `status` (`active`, `archived`, `draft`)
- `date_scope` (`none`, `day`, `week`)
- `scope_date` or `scope_start/scope_end`
- `parent_plan_id` nullable
- `created_at`
- `updated_at`

## 2. Task

A **task** remains the executable unit of work and the anchor for time tracking.

### Task rules

- A task belongs to exactly one plan.
- A task may have subtasks.
- A task may optionally link to a child project plan.
- A task may be designated as a planning/review task.

### Additional task concepts needed

- `plan_id`
- `linked_plan_id` nullable
- `is_planning_task` boolean
- `is_review_task` boolean

## 3. Daily Plan Entry

A **daily plan entry** is a selected task for a specific day.

It is not just a pointer. It is a planning snapshot for that day.

### Required fields

- `id`
- `daily_plan_id`
- `task_id`
- `source_plan_id`
- `priority`
- `planned_minutes`
- `notes`
- `position`
- `status` (`planned`, `in_progress`, `done`, `skipped`, `carried_forward`)

## 4. Budget Entry

A **budget entry** represents intended time allocation.

### Budget scopes

- daily budget
- weekly budget

### Allocation targets

- task
- project plan
- system bucket (`sleeping`, `transitioning`)

The current weekly budget tables can likely be evolved instead of discarded, but the logical model should support both daily and weekly views.

## 5. Time Entry

The current `time_entries` foundation remains valid.

The logical additions are:
- day-level completeness validation
- reporting by task
- roll-up by project plan
- roll-up by overall plan

## 6. Review Artifact

A **review artifact** records what happened and what to change.

### Review scopes

- end-of-day review
- end-of-week review

### Review contents

- planned vs actual summary
- variance notes
- carry-forward decisions
- next-step adjustments

---

## Relationship Model

## Overall plan

- Contains top-level goals, initiatives, and planning tasks
- Links to project plans
- Produces the set of candidate work for each day

## Project plan

- Owns project-specific tasks and subtasks
- Can link to subproject plans
- Rolls actual time and planned time upward

## Daily plan

- Pulls selected tasks from overall/project plans
- Includes planning/review tasks
- Includes a time budget for the day
- Becomes the main execution list for “today”

## Review

- Consumes the daily plan, time entries, and budgets
- Produces carry-forward and replanning decisions

---

## Workflow Model

## 1. Weekly planning

- Review the overall plan
- Review active project plans
- Select the projects/tasks that matter this week
- Set a weekly time budget
- Allocate weekly planned hours by project/task

## 2. Daily planning

- Create or refresh today’s daily plan
- Pull top candidate tasks from active plans
- Choose today’s priorities
- Add planning/review/admin tasks if needed
- Allocate daily planned time

## 3. Execution

- Work from the daily plan first
- Use the timer against the task actually being worked
- Allow ad hoc work, but mark it explicitly as unplanned

## 4. End-of-day review

- Validate that the day is fully accounted for
- Compare planned vs actual
- Mark items done/skipped/carried forward
- Capture why the budget differed from reality

## 5. End-of-week review

- Compare weekly budget vs actual
- Review project-level variance
- Decide what rolls into the next week

---

## Product Rules / Invariants

- [ ] Every user has at most one active `overall` plan.
- [ ] Every task belongs to exactly one plan.
- [ ] A linked child plan must belong to the same user.
- [ ] A daily plan is date-scoped and unique per user per day.
- [ ] Daily plan entries are ordered explicitly.
- [ ] Planning/review time is tracked as normal work time.
- [ ] The system must be able to report how a full day was spent.
- [ ] A day is “complete” only when recorded time covers the entire day, subject to DST edge cases.
- [ ] Budget-vs-actual must be computable at daily, weekly, task, and project levels.
- [ ] Ad hoc work is allowed, but it must be visible as unplanned work in review.

---

## Gap Analysis Against The Current Planner

## Current strengths

- Task CRUD and hierarchy already work
- Cross-hierarchy todo derivation already works
- Timer state and time-entry recording already work
- Weekly budget/allocation/history already exist

## Required additions

- New plan layer
- Plan-aware navigation and roll-up
- Explicit daily-plan model
- Daily budgeting and review
- Day-completeness reporting
- Budget roll-up from daily to weekly

## Things to avoid

- Do not overload the existing todo derivation logic to impersonate a daily plan
- Do not mix all projects into one undifferentiated task tree forever
- Do not treat review as informal notes outside the system

---

## Recommended Implementation Strategy

### Strategy choice

Extend the current planner app incrementally:

1. introduce plans,
2. preserve existing tasks,
3. add daily planning,
4. then tighten the time/review loop.

This keeps the current app useful throughout the transition.

### Deferred strategy

Keep the Git-native project-graph direction in `ProjectPlan.md` as a future architecture option after the product model is proven in the planner app.

---

## Executable Backlog

## Phase 2 — Introduce plan model

- [ ] Define final SQL schema for `plans` and plan-scoped task changes
- [ ] Decide whether `daily plan entries` are a separate table or modeled through tasks plus metadata
- [ ] Add migrations and RLS for new planning tables
- [ ] Update planner queries/hooks to be plan-aware

## Phase 3 — Overall plan and project plans

- [ ] Create overall-plan view
- [ ] Add project-plan list/navigation
- [ ] Support linking a task to a child project plan
- [ ] Add roll-up summaries from project plans into the overall plan

## Phase 4 — Daily planning

- [ ] Create daily-plan data model
- [ ] Create “Today” planning UI
- [ ] Let the user pull candidates from overall/project plans
- [ ] Add explicit priority ordering and carry-forward behavior
- [ ] Add planning/review tasks as first-class selectable work

## Phase 5 — Full-day time accounting

- [ ] Add day-level completeness report
- [ ] Add daily timeline/day summary view
- [ ] Surface unplanned work clearly
- [ ] Handle DST and partial-day edge cases explicitly

## Phase 6 — Budget vs actual loop

- [ ] Add daily budgeting
- [ ] Roll daily budgets into weekly budgets
- [ ] Show variance by task/project/day/week
- [ ] Add end-of-day review workflow
- [ ] Add end-of-week review workflow

## Phase 7 — Operational hardening

- [ ] Add tests for plan roll-up, daily-plan selection, and budget calculations
- [ ] Add migration/backfill plan for existing task data
- [ ] Add admin/debug visibility for broken plan links or invalid day completeness

---

## Exit Criteria For Phase 1

- [x] Architecture direction chosen for the near term
- [x] Domain model defined
- [x] Workflow model defined
- [x] Product rules documented
- [x] Gap analysis completed
- [x] Implementation backlog created

---

## References

- `webApp/planner-plan.md`
- `TasksToDo-Spec.md`
- `TimeManagement-Spec.md`
- `ProjectPlan.md`
