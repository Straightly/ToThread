# Testing Thread Journal APIs

## Prerequisites
You need a valid Google ID token from the ToThread web app.

## Steps to Get Token

1. Open https://tothread-webapp.zhian-job.workers.dev in your browser
2. Sign in with Google
3. Open browser DevTools (F12)
4. Go to Console tab
5. Type: `localStorage.getItem('google_id_token')`
6. Copy the token value (without quotes)

## Test Commands

Replace `YOUR_TOKEN_HERE` with your actual Google ID token.

### 1. Test GET /threads (List all thread tags)

```powershell
curl.exe -X GET "https://tothread-webapp.zhian-job.workers.dev/threads" `
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected:** `{"status":"ok","threads":[]}` (empty if no threads exist yet)

### 2. Test POST /threads/test (Create a test thread entry)

```powershell
curl.exe -X POST "https://tothread-webapp.zhian-job.workers.dev/threads/test" `
  -H "Authorization: Bearer YOUR_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d '{\"content\":\"This is my first test journal entry\"}'
```

**Expected:** `{"status":"ok","email":"your@email.com","tag":"test","path":"Writing/Threads/test.md","timestamp":"2025-12-23T...",...}`

### 3. Test GET /threads again (Should now show 'test' tag)

```powershell
curl.exe -X GET "https://tothread-webapp.zhian-job.workers.dev/threads" `
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected:** `{"status":"ok","threads":["test"]}`

### 4. Test GET /threads/test (Fetch last 30 lines)

```powershell
curl.exe -X GET "https://tothread-webapp.zhian-job.workers.dev/threads/test" `
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected:** JSON with `lines` array containing last 30 lines, `fullContent`, and `totalLines`

### 5. Test POST /threads/test again (Append another entry)

```powershell
curl.exe -X POST "https://tothread-webapp.zhian-job.workers.dev/threads/test" `
  -H "Authorization: Bearer YOUR_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d '{\"content\":\"Second entry to test appending\"}'
```

### 6. Verify in Gitea

Go to: https://gitea.nothingbuttrust.com/zhian.job/attention/src/branch/main/Writing/Threads

You should see `test.md` with entries formatted as:

```markdown
## 2025-12-23T07:32:00.000Z

This is my first test journal entry

## 2025-12-23T07:33:00.000Z

Second entry to test appending
```

## Troubleshooting

- **401 Unauthorized**: Token expired or invalid - get a fresh token from the web app
- **403 Forbidden**: Your email is not in the allowlist
- **404 on GET /threads/:tag**: Thread doesn't exist yet (expected before first POST)
