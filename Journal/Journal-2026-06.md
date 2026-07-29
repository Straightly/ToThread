# Journal 2026-06

## Entry 1
**Prompt:**
```text
<environment_context>
  <current_date>2026-06-04</current_date>
  <timezone>America/Los_Angeles</timezone>
</environment_context>
```
**Action:** Logged updated environment context.
**Result Summary:** Environment context recorded.

## Entry 2
**Prompt:**
```text
I used insforge to host my app.  It is a very well architectured AI native tool and system.  Is it possible to find how itself is implemented so I can learn of it?
```
**Action:** Check which parts of InsForge are publicly inspectable (SDK, CLI, docs, repo visibility) and identify practical ways to learn from its implementation.
**Result Summary:** Confirmed that InsForge has a public open-source repo (`InsForge/insforge`) plus official docs/blog that expose major architecture details. The public materials are enough to study large parts of the system, though managed-cloud-specific internals may not all be included.

## Entry 3
**Prompt:**
```text
So all together there are just two skills insforge installed in Codex.  When I ask the applicaiton to be implemented, who does the heavy lifting:  Codex or Insforge?
```
**Action:** Clarified the division of labor between Codex, local InsForge skills, the InsForge CLI/MCP layer, and the InsForge hosted backend.
**Result Summary:** Explained that Codex does the implementation and orchestration work, while InsForge provides backend primitives, docs/skills, and operational tooling.

## Entry 4
**Prompt:**
```text
How exactly are these two SKILL.md file created?  Some programmer actually developed them?  It does not look a lot.  How does one know what to put something in there and/or not?
```
**Action:** Explained how skill files are authored, why they are intentionally small, and what belongs in a skill versus in referenced docs, tools, or code.
**Result Summary:** Clarified that the local InsForge skills are human-authored instruction bundles, with `SKILL.md` acting as the entrypoint and additional docs carrying the detailed reference material.

## Entry 5
**Prompt:**
```text
One can choose to use InsForge CLI or MCP to access it.  If one choose MCP, one would read something similar to these .md files as skills from the MCP, right?
```
**Action:** Clarified the distinction between local skills and MCP tools/data access.
**Result Summary:** Explained that MCP is a live capability/tool layer, while `SKILL.md` files are usually local instruction bundles that guide the agent.

## Entry 6
**Prompt:**
```text
But on InsForge website, InsForge CLI and MCP is presented as two alternatives.  In fact, when I started this project, MCP option was not there.  Reading the doc there, it seemed that if I use MCP route, I do not need the InsForge CLI.
```
**Action:** Checked the current official InsForge docs to reconcile their “CLI vs MCP” presentation with how local skills are installed and used.
**Result Summary:** Pending docs-based clarification.

## Entry 7
**Prompt:**
```text
I got it now.  Now is my next two questions.  1. What is like to develop these skills?  2. How much do such skills dependent on the agent to be successful?  For example, If I add these skills to OpenClaw, will they work?
```
**Action:** Explained what skill authoring is like in practice and checked whether the local `openclaw` project appears to support a compatible skill mechanism.
**Result Summary:** Confirmed that OpenClaw has its own `SKILL.md`-based skill system and validator, so the InsForge skills are conceptually portable, but success depends on agent behavior, available tools, and prompt/runtime integration rather than the markdown file alone.

## Entry 8
**Prompt:**
```text
I am a developer.  I want to know, if I am tasked to write the skill file for OpenClaw, what do I do?  Ask Codex to do it to me is good, but if I do not understnad what need to be done, I would not even know if I asked Codex to do the right or wrong thing.
```
**Action:** Pulled the local OpenClaw skill-authoring guidance and translated it into a concrete developer workflow for designing and validating a new skill.
**Result Summary:** Pending explanation.

## Entry 9
**Prompt:**
```text
To deploy my app, what command should I use under what directory?
```
**Action:** Answered with the exact InsForge CLI deploy command and the working directory that matched the successful deployment path.
**Result Summary:** Provided the recommended deploy directory and command.

## Entry 10
**Prompt:**
```text
Error: No project linked. Run `npx @insforge/cli link` first.
```
**Action:** Check which folder currently contains the InsForge project link and explain how to deploy from the linked directory or re-link the intended directory.
**Result Summary:** Confirmed `/Users/zhian/Projects/ToThread/webApp/backend` is not linked, while `/Users/zhian/Projects/ToThread/webApp/planner/.insforge/project.json` exists. The simplest fix is to run deploy from `webApp/planner`.

## Entry 11
**Prompt:**
```text
Can I deploy fro webApp instead?
```
**Action:** Explained when deploying from `webApp` would work and why `webApp/planner` is the cleaner current deployment root.
**Result Summary:** Advised that `webApp` would need its own link, while `webApp/planner` already works as the linked deploy root.

## Entry 12
**Prompt:**
```text
If I deploy from planner, with my backend also get deployed?
```
**Action:** Clarified whether deploying the `planner` frontend also deploys the separate `backend` folder.
**Result Summary:** Explained that deploying from `webApp/planner` deploys only the planner frontend, not the separate `webApp/backend` code.

## Entry 13
**Prompt:**
```text
I do not remember having to deploy twice with backend change, that's why I suspecting I was deploying from webApp.  How do I find out?
```
**Action:** Inspect the repo for InsForge link files and deployment config to determine which directory was acting as the deployment root and whether `webApp` could have deployed both frontend and backend together.
**Result Summary:** Found `.insforge/project.json` at the repo root and under `webApp/planner`, but not under `webApp` or `webApp/backend`. Also confirmed `webApp/backend` is a separate Cloudflare Worker backend, while the planner frontend is the InsForge-hosted app. This explains why “backend changes” in the planner workflow would not require deploying `webApp/backend`.

## Entry 14
**Prompt:**
```text
Please update the sdk to the latest verison.
```
**Action:** Check the current `@insforge/sdk` version used by `webApp/planner`, compare it to the latest npm version, and upgrade `package.json` plus lockfile if needed.
**Result Summary:** Upgraded `/Users/zhian/Projects/ToThread/webApp/planner` from `@insforge/sdk@^1.2.7` to `^1.3.1` and updated the lockfile. Verified installed version `1.3.1`.

## Entry 15
**Prompt:**
```text
I was surprised to find out InsForge provides only two skills, even though each skill is very general that one cover frontend and one cover the backend.  The frontend skill does not even have references.  I guess that is because it says do everything possible with the SDK.  If MCP does not need CLI, I would then impage the frontend skill will just need to send this file, but the cli skill will be replaced with a skill file, potentially replacing all these references of making CLI calls with endpoints provided by the MCP?
```
**Action:** Explained how the current InsForge skill split works, corrected the local structure detail about frontend references, and clarified how an MCP-first version would likely change the backend/ops skill from CLI-command guidance to MCP-tool guidance rather than removing the skill concept.
**Result Summary:** Clarified that the frontend `insforge` skill already uses referenced module docs under the skill folder, while the backend `insforge-cli` skill would likely remain conceptually separate but evolve from CLI-first instructions to MCP-first tool guidance.

## Entry 16
**Prompt:**
```text
<environment_context>
  <current_date>2026-06-05</current_date>
  <timezone>America/Los_Angeles</timezone>
</environment_context>
```
**Action:** Logged updated environment context.
**Result Summary:** Environment context recorded.

## Entry 17
**Prompt:**
```text
The instruction of using MCP says one can use the MCP remotely which I understand.  It, however, also says one can run it locally.  For different agent, it actually have different instructions.  I am confused by that.  Don't one have to download the server code and then run it?  When it is running, does it not have an url for the agent to use?
```
**Action:** Checked the official InsForge MCP setup docs to explain the difference between remote-hosted MCP and locally run MCP, and why agent-specific setup instructions differ.
**Result Summary:** Clarified that remote MCP means InsForge hosts the server and the agent connects to its URL, while local MCP means the server runs on the user's machine or self-hosted stack. The docs vary by agent because MCP clients differ in config format, transport, and auth flow.

## Entry 18
**Prompt:**
```text
<environment_context>
  <current_date>2026-06-09</current_date>
  <timezone>America/Los_Angeles</timezone>
</environment_context>
```
**Action:** Logged updated environment context.
**Result Summary:** Environment context recorded.

## Entry 19
**Prompt:**
```text
For this project, I am building an organizer that will improve my effeciecy.  The current feature I want to focused on is to how to manage my plans.  What I want it an overall plan whichis composed of other smaller plans (for different projects) so I know what are the top tasks for me each day, including planning itself.  Further, I also want to be able to track how I am spending my time on the plan(s).  The goal is to accurately record how my 24 hours a day is spent.  After these, I would like to finish the loop so I can budget my time at planning time so I can review afterward to see how my budget and actual time matches.  Please exame my current project and list the tasks I need to do to accomplish all these.
```
**Action:** Inspect the current project plans/specs/code for planner and time-tracking features, then produce a concrete task list to reach hierarchical planning, daily prioritization, full-day time tracking, and budget-vs-actual review.
**Result Summary:** Reviewed the current planner specs and implementation. Confirmed the app already has a single-tree planner, a cross-hierarchy todo view, and weekly time-budget tracking, but still lacks a true overall-plan/subplan model, an explicit daily planning workflow, stricter 24-hour accounting, and a fully closed planning-to-budget-to-review loop.

## Entry 20
**Prompt:**
```text
What will be the artifacts of phase 1?
```
**Action:** Break Phase 1 into its concrete deliverables so the planning-model decision work has clear outputs before implementation starts.
**Result Summary:** Defined the expected Phase 1 artifacts as a planning-model decision package: scope document, domain/data model, workflow definitions, invariants, and an implementation backlog.
## Entry 21
**Prompt:**
```text
Please do Phase 1.
```
**Action:** Create the Phase 1 planning-model artifacts for the planner: choose the planning architecture direction, define the domain/workflow/rules, and add an executable implementation backlog plus references from the existing project plans.
**Result Summary:** Created `Planner-PlanningLoop-Phase1.md` as the Phase 1 decision package, choosing to extend the current InsForge planner with a first-class plan layer, explicit daily plans, full-day accounting rules, and a sequenced backlog for later implementation. Added references from `ProjectPlan.md` and `webApp/planner-plan.md`.
