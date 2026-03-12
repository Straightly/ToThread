# Step 13.11 Verification: Google-Authenticated Save Flow

## What was added

- Popup settings for:
  - `Backend Base URL`
  - `Google ID Token (Bearer)`
- `Save Draft to RawWriting` action that calls `POST /writings` with Bearer token.
- On missing/expired token, popup opens backend login page.
- Added `Import Token From Backend Tab` to auto-read `google_id_token` from backend UI localStorage after login.

## Verification steps

1. Rebuild/run extension to iPhone.
2. In extension popup, confirm Backend Base URL is set (defaults to your worker URL).
3. Tap `Open Backend Login Page` and sign in with Google.
4. Keep backend page open and active, then tap `Import Token From Backend Tab`.
5. Ensure you have a captured transcript draft (`Show Draft` has messages).
6. Tap `Save Draft to RawWriting`.
7. Expect `ok: true` and response containing `path` and `commitId`.

## If you get 401

- Tap `Open Backend Login Page`.
- Sign in with Google there.
- Paste a fresh ID token in popup.
- Retry save.

## Gate

Step 13.11 passes when a valid allowlisted Google user can save transcript draft to `/writings` successfully.
