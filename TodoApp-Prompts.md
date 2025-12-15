# TodoApp-Related Prompts (Extracted from Journal)

This file aggregates prompts related to the original Attention Todo App and its subsequent migration / repackaging plans, collected from `Journal/Journal.md` and `Journal/Journal-2025-12.md`.

---

## 2025-11-15 — ToDoApp Security Discussion (Journal.md)

**Prompt (20:05):**
```
I have a question of security of my ToAoApp. I understand that I need to enter and save that token in my browser. I wonder what if I want to add another layer of security where the user must be authentication to Google and the username (google email adress) must match a list of usernames? Is that possible with my app hosted in github? How does that work?
```

**Prompt (20:11):**
```
Time wise, how long will it take me to create, deploy an authenticate service as AWS lambda, what kind of free access one can have on it?
```

**Prompt (20:15):**
```
WIll it make sense to host my whole app in Cloudflare, then, as using the github token was kind of hack to start with.
```

---

## 2025-11-13–11-15 — iPhoneApp Wrapping of ToDoApp (selected prompts) (Journal.md)

These prompts capture the intent and constraints around wrapping the existing ToDoApp as an iPhone app, which are useful for understanding the app’s original behavior and deployment model.

**Prompt (2025-11-13, 16:41):**
```
Please remember to journal my prompts. Now, if I want to wrap my ToDoApp as an iPhone app, for a very experience developer with no iPhone app nor XCode experiences, how long will it take in man hours including learning curve?
```

**Prompt (2025-11-13, 16:50):**
```
Sounds great. Lets start. Please take this approach and give me step by step instructions, maybe start by creating a folder called iPhoneApp and create a projectPlan.md there so I can keep track of progress.
```

**Prompt (2025-11-13, 17:10):**
```
No. That was my local deployed copy I made for demo purpose. My real version is in ToDoApp which is hosted on GitHub and docs folder in my project. Please correct your memory.
```

**Prompt (2025-11-13, 17:11):**
```
Please update my project plan accordingly.
```

**Prompt (2025-11-15, 20:52) — ToDoApp security / migration context:**
```
I have a question of security of my ToAoApp. I understand that I need to enter and save that token in my browser. I wonder what if I want to add another layer of security where the user must be authentication to Google and the username (google email adress) must match a list of usernames? Is that possible with my app hosted in github? How does that work?
```

---

## 2025-12-11 — Repackage TodoApp with Cloudflare + KV (Journal-2025-12.md)

**Prompt (~23:30 PST):**
```
Let me worry about that later.  Now, I would like to repackage my TodoApp.  It used to be hosted as a static web app on GitHub.  Now I need to do a few things.  1. Create a GitHub repository. to host only the app itself.  2.  Make it an app hosted on Cloudflare. 3. Change my todo and raw writing storage to KV in Clounflare.  Please add these to the project's plan first.
```

---

## 2025-12-12 — Session Start: Resume ToDo App Migration (Journal-2025-12.md)

**Prompt (~20:59 PST):**
```
Resuming working on migrating ToDo App.  Session start: Please journal ALL my prompts in the appropriate monthly file under ./Journal (e.g., Journal/Journal-YYYY-MM.md), logging each prompt verbatim with an Action note, and backfill any prompts from this session that are not yet written.
```

---

## 2025-12-12 — Plan to Port ToDoApp Frontend into ToThread UI (Journal-2025-12.md)

**Prompt (~21:06 PST):**
```
I want you to copy as much as code possible from the existing web app in ToDoApp to ToThread\webApp\ui.  We should have already have the backend API for todos.  Leave the writing API as is which we can work on later.  Please updte the project plan first before do anything.
```

---

## 2025-12-12 — Clarify Next Step (6.3) (Journal-2025-12.md)

**Prompt (~21:10 PST):**
```
Is Next Step 6.3?
```

---

## 2025-12-12 — Execute Step 6.3 Port ToDoApp UI (Journal-2025-12.md)

**Prompt (~21:12 PST):**
```
Cool.  Do 6.3.
```

---

## 2025-12-12 — Introduce ToThread Todos Client for /todos (Journal-2025-12.md)

**Prompt (~21:40 PST):**
```
Yes.  Carry out the next step, "Introduce a ToThread todos client that calls GET /todos / PUT /todos with a Google ID token."
```

---

## 2025-12-14 — Reconsider Todo App Migration Plan (Journal-2025-12.md)

**Prompt (~20:30 PST):**
```
I have reconsider my migration plan for the Todo App and realized that the migration has already taken longer than the time I spent developing the original app, which was must faster.  My original app was develop using vibe programming and ALL my prompt should ahve logged in one of the md files under Journal.  Can you read throught the journal files and farm out all related prompts and save them into a .md file under ToThread?  My new plan is to simply write an web ui front directly based on these prompts.
```

---

## 2025-12-14 — Proceed with Todo Prompt Extraction Steps (Journal-2025-12.md)

**Prompt (~20:36 PST):**
```
Please carry out the steps.
```
