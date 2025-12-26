# ToThread Changelog

## 2025-12-26 - localStorage Auto-Save for Draft Protection

### Problem
Users could lose their writing if:
- Google ID token expired during writing
- Browser crashed
- Tab accidentally closed
- Network connection lost

### Solution
Implemented automatic draft saving to browser localStorage with the following features:

#### Features Added

**1. Auto-Save (2-second debounce)**
- Raw Writing textarea: Auto-saves to `tothread_raw_writing_draft`
- Thread Entry textarea: Auto-saves to `tothread_thread_entry_draft_{threadTag}`
- Saves only to browser localStorage (no network calls, no git commits)
- 2-second debounce to avoid excessive saves while typing

**2. Auto-Restore on Page Load**
- Raw Writing: Prompts user to restore draft on page load
- Thread Entry: Prompts user to restore draft when selecting a thread
- Shows age of draft in minutes
- User can choose to restore or discard

**3. Draft Cleanup**
- Automatically clears draft after successful save to git
- User can manually discard draft when prompted

**4. Error Handling**
- If save fails (e.g., token expired), draft remains in localStorage
- Error messages now indicate "(Draft preserved locally)"

#### Technical Details

**localStorage Keys:**
- `tothread_raw_writing_draft` - Raw writing content
- `tothread_raw_writing_draft_timestamp` - Timestamp of last save
- `tothread_thread_entry_draft_{tag}` - Thread entry content (per thread)
- `tothread_thread_entry_draft_{tag}_timestamp` - Timestamp (per thread)

**Functions Added:**
- `autoSaveDraft(key, content)` - Save draft to localStorage
- `restoreDraft(key)` - Retrieve draft with age calculation
- `clearDraft(key)` - Remove draft from localStorage

**Event Listeners:**
- `input` event on textareas with debounced auto-save
- Page load restoration for raw writing
- Thread selection restoration for thread entries

#### User Experience

**Before:**
1. User types long diary entry
2. Token expires
3. Click "Save Entry"
4. Error: "ID token has expired"
5. **All writing lost** ❌

**After:**
1. User types long diary entry
2. Auto-saved to localStorage every 2 seconds (browser only)
3. Token expires
4. Click "Save Entry"
5. Error: "ID token has expired (Draft preserved locally)"
6. User refreshes page or re-authenticates
7. Prompted: "Found unsaved entry from 5 minutes ago. Restore it?"
8. User clicks OK
9. **All writing restored** ✅
10. User saves successfully to git

#### Deployment
- Version: `0231f54b-5951-486b-9a31-d5f04329d7c1`
- Deployed: 2025-12-26
- URL: https://tothread-webapp.zhian-job.workers.dev

#### Files Modified
- `webApp/backend/ui/main.js` - Added auto-save logic, restore prompts, draft cleanup
