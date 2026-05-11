# Journal 2026-05

## Entry 1
**Prompt:**
```text
<environment_context>
  <shell>zsh</shell>
  <current_date>2026-05-08</current_date>
  <timezone>America/Los_Angeles</timezone>
</environment_context>
```
**Action:** Logged updated environment context.
**Result Summary:** Environment context recorded.

## Entry 2
**Prompt:**
```text
The same problem is happening again that my app expired and I have to restart it.  Last time, I had to update the library version and redeploy the app.  Please do that.
```
**Action:** Upgrade `@insforge/sdk` in `webApp/planner` to the latest available version and redeploy the planner app to InsForge hosting.
**Result Summary:** Upgraded `@insforge/sdk` from `1.2.5` to `1.2.7`, rebuilt, and redeployed successfully. Live at https://kgcw84it.insforge.site (Deployment ID: ef393834-9404-4297-93d5-fc6656366924).

## Entry 3
**Prompt:**
```text
What is the google site to get a clientid and auth key to use Google sign in?
```
**Action:** Looked up the official Google workflow to create an OAuth 2.0 Client ID (and clarify client secret vs API key) for Google Sign-In.
**Result Summary:** Pending links and steps.

## Entry 4
**Prompt:**
```text
This is a little strange.  I had obtained Google Auth client id and key before.  But now in google, it says My identifiy platform has not been configured yet.  Could Google has an individual account and an enterprise site?  Right now it look like I am on the enterprise site.  I might have been on the individual site before.
```
**Action:** Explained why the Google Cloud Console UI may say the Google Auth platform/consent screen isn’t configured (different project/account/org policies) and how to locate prior OAuth client IDs.
**Result Summary:** Provided concrete checks: correct Google account, correct Cloud project, consent screen setup, and where to find existing credentials in the console.

## Entry 5
**Prompt:**
```text
Can you check my project where I used a google client id and wonder if one can tell where that id comes from?
```
**Action:** Searched the ToThread repo for any Google OAuth Client ID usage (e.g., `*.apps.googleusercontent.com`) and identified where it is configured (hardcoded vs env var) so it can be traced back to a Google Cloud project/credential entry.
**Result Summary:** Found OAuth client IDs hardcoded/configured in `/Users/zhian/Projects/ToThread/webApp/backend/wrangler.toml` and the iOS app. IDs share project-number prefix `130905058858`, which is the Google Cloud project number for the OAuth credentials.

## Entry 6
**Prompt:**
```text
I was there and there is no such project.  All I can see is the "My First Project" which has a project id which looks like a GUID.
```
**Action:** Explained likely reasons the Google Cloud project that owns the OAuth client IDs is not visible under the current signed-in account and gave concrete ways to locate the owning project or confirm deletion/ownership.
**Result Summary:** Provided troubleshooting steps (account mismatch vs deleted project vs permissions/org) and next actions to recover or recreate credentials.
