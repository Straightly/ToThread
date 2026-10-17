# Planner Use Cases and Workflows

## Document Status

This is a product workflow document, not an implementation specification.

Its purpose is to identify useful things the user should be able to do, especially things the current application cannot do, before choosing database tables or building UI. Each workflow should be implemented and validated as an independent vertical slice. Expansion points are recorded, but they are intentionally not part of the first implementation.

## Working Habits This Design Must Support

The user's work is a portfolio containing different kinds of work at the same time:

- **Ongoing efforts** have no natural completion date. Examples include finding a job, maintaining health, organizing projects, and deciding what deserves attention.
- **Finite projects** pursue a defined outcome. Examples include submitting one job application, releasing one product feature, or completing one paper.
- **Projects can exist inside efforts or other projects.** Job Search can contain a finite application project; a product project can contain a finite deployment project.
- **Planning and organization are real work.** Time spent reviewing projects, restructuring plans, and choosing priorities must be visible and trackable.
- **Order is meaningful.** The user prefers an explicit sequence of work over abstract ranking values.
- **Execution happens in several places.** Work may begin in the planner UI, a repository folder, a Codex task, or as unexpected ad hoc activity.
- **Time should remain fully accounted for.** Sleeping, transitioning, planning, and project execution all belong in the same time ledger.
- **Git is valuable for durable context.** Project files, decisions, specifications, and deliverables should remain close to the repository content they describe.

## Core Conceptual Distinctions

The current application uses a hierarchical task tree and also uses `Continuous` as a task status. The future design should avoid making one field answer several different questions.

| Concept | Question it answers | Lifecycle |
|---|---|---|
| Portfolio | What bodies of work am I responsible for? | Continually reviewed |
| Effort | What do I intend to keep doing without a fixed finish line? | Active, paused, or archived |
| Project | What bounded outcome am I trying to achieve? | Proposed, active, completed, canceled, or archived |
| Task | What concrete action can I perform? | Pending, in progress, blocked, or done |
| Daily selection | What have I explicitly chosen to work on today, and in what order? | Planned, performed, skipped, or carried forward |
| Time entry | What actually occupied this interval? | Recorded and later corrected if necessary |
| Review | What happened, what changed, and what should happen next? | Daily, weekly, or project-specific artifact |

An **effort** is not an unfinished project. It succeeds through continuity and periodic review rather than by reaching `Done`.

A **project** must have a desired outcome and a completion condition. A project may belong to an effort or another project.

A **task** is executable work. A task can be an entry point to a child project, but the task and project remain distinct identities.

`Continuous` may continue to work as it does today during incremental development, but it should eventually describe neither plan type nor project ownership.

## Product Principles

1. **One identity, multiple views.** Associating an existing task branch with a plan must not copy the tasks.
2. **Preserve history.** Reorganizing plans must not silently rewrite historical time attribution or destroy completed work.
3. **Use explicit order.** Plans, daily selections, and sibling tasks use position-based ordering.
4. **Separate context from operations.** Git owns rich project context and artifacts; the planner owns operational identity, order, status, budget, and time.
5. **Make planning visible.** Organizing and prioritizing can be selected, timed, and reviewed like other work.
6. **Implement one workflow at a time.** A workflow is complete only when the user can perform it from beginning to end and verify the result.
7. **Do not build expansion mechanisms before they are needed.** Record stable seams, but avoid generic frameworks without a validated use case.

## Current Capability and Workflow Gaps

| Capability | Current state | Missing user action |
|---|---|---|
| Ordered task hierarchy | Available | None for basic task nesting |
| Cross-hierarchy Todo display | Available | It cannot explain which plan owns each candidate |
| Continuous-task visibility | Available | It conflates ongoing work with task status |
| Timer and time entries | Available | Actual time cannot reliably roll up by explicit project/effort identity |
| Weekly task allocation | Partially available | Budget is not connected to an explicit portfolio of plans |
| First-class effort/project | Missing | Cannot distinguish Job Search from one job application |
| Plan association | Missing | Cannot associate an existing task branch or repository folder with a plan |
| Plan-scoped view | Missing | Cannot open one plan and see only its work, context, and roll-up |
| Portfolio ordering | Missing | Cannot explicitly order efforts and projects against each other |
| Daily selection | Missing | Cannot intentionally construct and preserve today's ordered work list |
| Project promotion/demotion | Missing | Cannot turn a task into a child project and later absorb it safely |
| Codex work association | Missing | Cannot connect a Codex task/session to the planner item it advances |
| Review loop | Missing | Cannot close a day or project with planned-versus-actual decisions |

## Workflow Overview

```text
Capture work
    -> classify as effort, project, or task
    -> associate existing tasks and project context
    -> order the active portfolio
    -> select today's work
    -> execute and record time
    -> reconcile unexpected work
    -> review outcomes and time
    -> continue the effort or complete the project
```

The workflow is a loop for efforts and a lifecycle for projects:

```text
Effort:  activate -> prioritize -> perform -> review -> continue/pause/archive
Project: define -> plan -> perform -> review -> complete/cancel -> archive
Day:     select -> order -> perform -> reconcile -> close
```

## Use Case 1: Add a Plan and Associate Existing Work

**Recommended first implementation slice**

### User need

The user already has tasks and project folders. The user needs to introduce a plan boundary without recreating, importing, or duplicating that work.

### Examples

- Add `Job Search` as an ongoing effort and associate the existing `Find a Job` task branch with it.
- Add `ToThread Planning Consolidation` as a finite project, associate its existing task branch, and record `/Users/zhian/Projects/ToThread` as its project folder.
- Add `Organize and Prioritize Projects` as an ongoing effort so planning time has an explicit home.

### Primary workflow

1. Open a Plans view.
2. Choose **Add plan**.
3. Choose `Ongoing effort` or `Finite project`.
4. Enter the title.
5. For a finite project, optionally enter the desired outcome and completion condition.
6. Select an existing task branch to associate, or leave the plan empty.
7. Optionally record a repository and folder path.
8. Preview the association: task count, current ordering, and existing time history affected by the roll-up.
9. Confirm the association.
10. Open the plan and see its associated task tree without changing the global Todo behavior.

### Things the user should be able to do but currently cannot

- Name a boundary around an existing body of work.
- Say whether that body of work is ongoing or outcome-oriented.
- Open only that plan's tasks.
- See which repository folder contains the plan's context.
- See time summarized for that plan without copying time entries.

### Success conditions

- Existing task IDs, hierarchy, order, status, and time history are preserved.
- No duplicate tasks are created.
- The association can be removed without deleting the tasks or project files.
- The plan can be opened from the portfolio and from its associated task root.
- An effort does not present a misleading `Mark complete` action.

### Explicitly deferred

- Reading or rewriting a Markdown plan file.
- Automatically cloning or committing a repository.
- Moving repository folders.
- Daily-plan selection.
- Promoting or demoting tasks.
- Multiple users or permissions beyond current ownership rules.

## Use Case 2: Create a Finite Project Inside an Ongoing Effort

### User need

An ongoing effort produces bounded projects. The user needs to complete those projects without completing the containing effort.

### Example

`Job Search` remains active while `Apply for Principal Engineer at Company A` is completed. The application project may contain research, resume tailoring, submission, follow-up, and interview preparation tasks.

### Primary workflow

1. Open an ongoing effort.
2. Choose **Add child project**.
3. Define the desired outcome and completion condition.
4. Add or associate its tasks.
5. Order the project among the effort's other active work.
6. Complete or cancel the child project later.
7. Keep the parent effort active and available for the next project.

### Current gap

The present tree can nest tasks, but it cannot express that one node is an ongoing effort while another node is a bounded project with its own lifecycle and summary.

### Deferred expansion

- Project templates for applications, writing, experiments, or releases.
- Dependencies between projects.
- Automated project creation from repository folders.

## Use Case 3: Promote a Task to a Project and Demote It Safely

### User need

The user may discover that a task has become large enough to need its own plan, or that a small project no longer needs a separate boundary.

### Primary workflow

1. Select a task and choose **Promote to project**.
2. Preview the new project boundary and the subtasks that will belong to it.
3. Confirm without changing task IDs or order.
4. Later choose **Demote to task**.
5. Preview where child tasks, time history, notes, and links will go.
6. Confirm; archive the project identity rather than deleting its history.

### Current gap

The application can indent and outdent tasks, but it cannot create or remove a project boundary independently from task hierarchy.

### Safety rule

Promotion and demotion must be reversible until repository or external-link changes make reversal unsafe. The UI must show those consequences before confirmation.

## Use Case 4: Review and Order the Active Portfolio

### User need

The user needs to decide how ongoing efforts and finite projects compete for limited attention.

### Primary workflow

1. Open the active portfolio.
2. See ongoing efforts and finite projects as distinct items.
3. See a compact roll-up: next task, blocked state, planned time, actual time, and recent activity.
4. Drag or otherwise move plans into an explicit order.
5. Pause work that should not currently generate Todo candidates.
6. Select a planning task when the portfolio itself needs organization.

### Current gap

The app orders sibling tasks, but it cannot order project-level commitments while retaining separate project plans.

### Deferred expansion

- Numeric scoring, urgency formulas, or AI ranking.
- Capacity forecasting.
- Multi-person portfolio views.

Explicit order should be implemented before ranking or scoring.

## Use Case 5: Construct Today's Ordered Work

### User need

The computed Todo page shows candidates, but the user needs to make an intentional, persistent choice about today.

### Primary workflow

1. Open Today.
2. Review candidates from active efforts and projects.
3. Select a small set of tasks.
4. Put them in intended execution order.
5. Allocate time, including planning and review time.
6. Preserve the list while underlying plans evolve.
7. Mark an item done, skipped, or carried forward.

### Current gap

The current Todo list is derived. It cannot preserve the user's daily commitment, distinguish planned from unplanned work, or explain why an item was selected.

### Deferred expansion

- Calendar scheduling.
- Automatic daily-plan generation.
- AI recommendations.

## Use Case 6: Execute Work Through the Planner or Codex

### User need

The user needs one work record whether execution starts from a planner button, repository folder, or Codex task.

### Primary workflow

1. Start work on a selected task.
2. Start or associate a Codex task when needed.
3. Record elapsed time against the executable task.
4. Preserve the owning project and effort for roll-up.
5. Capture a result, next action, or blocker when the work session ends.
6. Continue from the same task later without losing context.

### Current gap

The timer can record task time, but Codex tasks and repository work are not explicitly associated with planner identities or outcomes.

### Deferred expansion

- Automatically reading Codex task state.
- Automatically committing work-session summaries.
- Multiple simultaneous agents.

## Use Case 7: Reconcile Unexpected Work

### User need

Real work does not always start from Today's plan. Unexpected research, communication, and organizing still consume time and may reveal new projects.

### Primary workflow

1. Record unexpected work against an existing task or a temporary inbox item.
2. Preserve it as visibly unplanned for the day.
3. During review, associate it with an effort/project, convert it into a task/project, or classify it as overhead.
4. Keep the actual time record unchanged while improving its classification.

### Current gap

The timer can track time, but there is no explicit reconciliation workflow for unplanned work or newly discovered commitments.

## Use Case 8: Review an Ongoing Effort

### User need

An effort such as Job Search should be evaluated periodically even though it is never marked complete.

### Primary workflow

1. Open the effort review.
2. See time spent, projects attempted, outcomes, blockers, and current next actions.
3. Decide whether to continue, change strategy, pause, or archive the effort.
4. Create or reorder follow-up projects and tasks.
5. Record the review itself as planned work and actual time.

### Current gap

The current system can show weekly time but cannot preserve an effort-level review decision or distinguish strategic change from task completion.

## Use Case 9: Complete and Review a Finite Project

### User need

A bounded project needs a deliberate close rather than merely having all tasks marked Done.

### Primary workflow

1. Verify the completion condition.
2. Review planned versus actual time and unfinished tasks.
3. Record the result and lessons.
4. Move residual tasks to another plan or explicitly abandon them.
5. Mark the project complete.
6. Keep its history available while removing it from active planning.

### Current gap

Task completion exists, but there is no project-level outcome, completion condition, close workflow, or historical summary.

## Use Case 10: Connect a Plan to Git Context

### User need

The user needs to move from a plan to the files that explain and implement it without making Markdown carry all operational state.

### Primary workflow

1. Associate a plan with a repository and folder.
2. Open or copy the folder location from the plan.
3. Display selected context files as links.
4. Let Codex work in that folder while associated with a planner task.
5. Optionally generate a human-readable project summary from planner data.

### Current gap

Repository folders and InsForge tasks exist independently. There is no stable project identity joining them.

### Deferred expansion

- Bidirectional Markdown synchronization.
- Server-side clone agents and automatic commits.
- Folder-move detection.
- Broken-link and cycle scanning across repositories.

## Recommended Incremental Delivery Order

Each slice should leave the app usable and should not require the later slices.

| Slice | Workflow delivered | User-visible proof |
|---|---|---|
| 1 | Add plan and associate existing work | User can create Job Search as an effort, associate its existing task branch, and open a scoped view |
| 2 | Plan roll-up | User can see actual time and next work for that plan without duplicate tasks |
| 3 | Child projects | User can create and complete one job-application project without completing Job Search |
| 4 | Promote/demote | User can change the boundary between task and project safely |
| 5 | Portfolio ordering | User can explicitly order active efforts and projects |
| 6 | Today's ordered work | User can preserve today's choices and planned time |
| 7 | Execution association | User can connect timer and Codex work to one task and plan |
| 8 | Reconciliation and review | User can classify unexpected work and close a day, effort review, or project |
| 9 | Git context integration | User can navigate between plans and repository folders; automation remains optional |

## First Slice Boundary

The first slice should implement only **Use Case 1: Add a Plan and Associate Existing Work**.

It needs enough design to avoid blocking later slices:

- Stable plan identity.
- Plan kind: `effort` or `project`.
- Optional parent plan for future nesting.
- Association to one existing task root without copying it.
- Optional repository and folder reference stored as context only.
- Explicit plan position for future portfolio ordering.
- Active, paused, and archived lifecycle support; project completion may remain unavailable until the project-close workflow exists.

It should not yet implement:

- Daily plans.
- Reviews.
- Promotion/demotion.
- Git synchronization.
- Codex integration.
- Generic link frameworks.
- Automated prioritization.

## Questions to Resolve Immediately Before Slice 1 Implementation

These decisions should be made only when implementation begins:

1. Can one task branch be associated with more than one plan, or must plan ownership be exclusive?
2. Does associating a task root assign all descendants to the plan dynamically, or snapshot the current subtree?
3. Should historical time roll up using the plan association that existed when time was recorded, or the task's current association?
4. Is a repository folder stored as a local path, repository-relative path, remote URL plus path, or a combination?
5. Should the initial Plans view replace any current screen or appear as an additional view?

The recommended defaults are exclusive ownership, dynamic descendant membership, historical association snapshots for time, remote repository identity plus repository-relative path, and an additional Plans view during the incremental transition.

## Expansion Seams to Preserve but Not Implement

- More plan kinds, such as campaigns, areas of responsibility, or routines.
- More context links, such as documents, websites, contacts, datasets, or external issue trackers.
- More work-session sources beyond Codex.
- Team ownership and permissions.
- Dependencies and cross-plan references.
- Automated recommendations and portfolio simulations.

These should remain conceptual extension points until a concrete workflow requires them.
