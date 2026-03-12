async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    throw new Error("No active tab");
  }
  return tab;
}

const SETTINGS_KEY = "toThreadCaptureSettings";
const PENDING_STOP_SAVE_KEY = "toThreadCapturePendingStopSave";
const SESSION_KEY = "toThreadCaptureSession";
const SESSION_STATE_KEY = "toThreadCaptureSessionState";
const DEFAULT_BACKEND_BASE_URL = "https://tothread-webapp.zhian-job.workers.dev";

function setMessage(text) {
  const messageEl = document.getElementById("message");
  if (messageEl) {
    messageEl.textContent = text;
  }
}

function setDebugData(payload) {
  const debugEl = document.getElementById("status");
  if (debugEl) {
    debugEl.textContent = JSON.stringify(payload, null, 2);
  }
}

function report(message, payload) {
  setMessage(message);
  setDebugData(payload);
}

async function getPendingStopSave() {
  const stored = await chrome.storage.local.get(PENDING_STOP_SAVE_KEY);
  return Boolean(stored[PENDING_STOP_SAVE_KEY]);
}

async function setPendingStopSave(value) {
  await chrome.storage.local.set({ [PENDING_STOP_SAVE_KEY]: Boolean(value) });
}

async function clearLocalCaptureStorage() {
  await chrome.storage.local.remove([SESSION_KEY, SESSION_STATE_KEY]);
}

async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const current = stored[SETTINGS_KEY] || {};
  return {
    backendBaseUrl: current.backendBaseUrl || DEFAULT_BACKEND_BASE_URL,
    googleIdToken: current.googleIdToken || ""
  };
}

async function saveSettings() {
  const backendBaseUrl = (document.getElementById("backend-url").value || "").trim().replace(/\/+$/, "");
  const googleIdToken = (document.getElementById("id-token").value || "").trim();

  const settings = { backendBaseUrl, googleIdToken };
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  report("Settings saved.", { ok: true, settings: { backendBaseUrl, hasToken: Boolean(googleIdToken) } });
}

async function loadSettingsIntoForm() {
  const settings = await getSettings();
  document.getElementById("backend-url").value = settings.backendBaseUrl || "";
  document.getElementById("id-token").value = settings.googleIdToken || "";
}

async function openBackendLoginPage() {
  const settings = await getSettings();
  if (!settings.backendBaseUrl) {
    report("Missing Backend Base URL.", { ok: false, error: "Set Backend Base URL first" });
    return;
  }
  const loginUrl = `${settings.backendBaseUrl}/`;
  await chrome.tabs.create({ url: loginUrl });
  report("Opened backend login page.", {
    ok: true,
    message: "Opened backend login page. Sign in with Google there, then paste fresh ID token here.",
    loginUrl
  });
}

async function importTokenFromBackendTab() {
  try {
    const result = await tryImportToken({ reportResult: true });
    if (result.ok) {
      const pendingStopSave = await getPendingStopSave();
      if (pendingStopSave) {
        const saveResult = await saveDraftToRawWriting({ reportResult: false, source: "pending-stop-save" });
        if (saveResult.ok) {
          await setPendingStopSave(false);
          report("Pending stop-save completed after token import.", saveResult.payload);
        } else {
          report("Pending stop-save still not completed.", saveResult.payload);
        }
      }
    }
  } catch (err) {
    report("Token import failed.", { ok: false, error: String(err) });
  }
}

async function tryImportToken({ reportResult }) {
  const settings = await getSettings();
  const backendOrigin = new URL(settings.backendBaseUrl).origin;
  const tabs = await chrome.tabs.query({});
  const backendTab = tabs.find((t) => t.url && t.url.startsWith(backendOrigin));
  if (!backendTab || !backendTab.id) {
    if (reportResult) {
      report("No backend tab found for token import.", {
        ok: false,
        error: "No backend tab found. Open backend URL and sign in first.",
        expectedOrigin: backendOrigin,
        openTabsChecked: tabs.length
      });
    }
    return { ok: false, reason: "no-backend-tab" };
  }

  const result = await chrome.scripting.executeScript({
    target: { tabId: backendTab.id },
    func: () => {
      const token = localStorage.getItem("google_id_token");
      const authToken =
        window.ToThreadAuth && window.ToThreadAuth.idToken ? window.ToThreadAuth.idToken : null;
      return token || authToken || null;
    }
  });

  const token = result && result[0] && result[0].result ? String(result[0].result) : "";
  if (!token) {
    if (reportResult) {
      report("No token found in backend tab yet.", {
        ok: false,
        error: "No token found in backend tab localStorage yet. Complete Google login first.",
        backendTabUrl: backendTab.url || null
      });
    }
    return { ok: false, reason: "no-token", backendTabUrl: backendTab.url || null };
  }

  const nextSettings = {
    backendBaseUrl: settings.backendBaseUrl,
    googleIdToken: token
  };
  await chrome.storage.local.set({ [SETTINGS_KEY]: nextSettings });
  const tokenField = document.getElementById("id-token");
  if (tokenField) {
    tokenField.value = token;
  }
  if (reportResult) {
    report("Token imported from backend tab.", {
      ok: true,
      message: "Imported token from backend tab",
      tokenLength: token.length,
      backendTabUrl: backendTab.url || null
    });
  }
  return { ok: true, backendTabUrl: backendTab.url || null };
}

async function sendToTab(tabId, type) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type }, (resp) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(resp || { ok: false, error: "No response from content script" });
    });
  });
}

function escapeMd(text) {
  return (text || "").replace(/\r\n/g, "\n");
}

function renderTranscriptMarkdown(draft) {
  const transcript = draft.transcript || {};
  const messages = transcript.messages || [];
  const lines = [];
  lines.push("# LLM Conversation Transcript");
  lines.push("");
  lines.push("- conversationId: " + (transcript.conversationId || "unknown"));
  lines.push("- provider: " + (transcript.provider || "unknown"));
  lines.push("- model: " + (transcript.model || "unknown"));
  lines.push("- startedAt: " + (transcript.startedAt || "unknown"));
  lines.push("- endedAt: " + (transcript.endedAt || "unknown"));
  lines.push("- messageCount: " + messages.length);
  lines.push("");

  for (const msg of messages) {
    const role = msg.role === "assistant" ? "ASSISTANT" : "USER";
    lines.push(`## [${msg.sequence}] ${role} - ${msg.timestamp || "unknown"}`);
    lines.push("");
    lines.push(escapeMd(msg.content || ""));
    lines.push("");
  }

  return lines.join("\n");
}

async function saveDraftToRawWriting(options = {}) {
  const { reportResult = true, source = "manual-save" } = options;
  try {
    const settings = await getSettings();
    if (!settings.backendBaseUrl) {
      const payload = { ok: false, error: "Missing Backend Base URL. Save settings first.", source };
      if (reportResult) {
        report("Missing Backend Base URL.", payload);
      }
      return { ok: false, needsLogin: false, payload };
    }
    if (!settings.googleIdToken) {
      const imported = await tryImportToken({ reportResult: false });
      if (!imported.ok) {
        await openBackendLoginPage();
        const payload = { ok: false, error: "Missing Google ID token; login page opened.", needsLogin: true, source };
        if (reportResult) {
          report("Login required before save.", payload);
        }
        return { ok: false, needsLogin: true, payload };
      }
    }

    const tab = await getActiveTab();
    const draft = await sendToTab(tab.id, "GET_TRANSCRIPT_DRAFT");
    if (!draft.ok) {
      const payload = { ok: false, error: "Unable to load transcript draft", draft, source };
      if (reportResult) {
        report("Could not load transcript draft.", payload);
      }
      return { ok: false, needsLogin: false, payload };
    }
    if (!draft.transcript || !Array.isArray(draft.transcript.messages) || draft.transcript.messages.length < 2) {
      const payload = { ok: false, error: "Draft has fewer than 2 messages; nothing to save.", source };
      if (reportResult) {
        report("Draft is too short to save.", payload);
      }
      return { ok: false, needsLogin: false, payload };
    }

    const markdown = renderTranscriptMarkdown(draft);
    const requestBody = {
      kind: "conversation_transcript",
      content: markdown,
      meta: {
        conversationId: draft.transcript.conversationId,
        provider: draft.transcript.provider,
        model: draft.transcript.model,
        startedAt: draft.transcript.startedAt,
        endedAt: draft.transcript.endedAt,
        messageCount: draft.transcript.messages.length,
        source: "iphone_safari_extension"
      }
    };

    const res = await fetch(`${settings.backendBaseUrl}/writings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + settings.googleIdToken
      },
      body: JSON.stringify(requestBody)
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_err) {
      data = { raw: "Non-JSON response" };
    }

    if (res.status === 401) {
      await openBackendLoginPage();
      const payload = {
        ok: false,
        error: "Unauthorized. Re-login required. Backend login page opened.",
        response: data,
        needsLogin: true,
        source
      };
      if (reportResult) {
        report("Unauthorized; re-login required.", payload);
      }
      return { ok: false, needsLogin: true, payload };
    }

    const payload = {
      ok: res.ok,
      status: res.status,
      response: data,
      mode: "save-draft",
      source
    };
    if (res.ok) {
      await clearLocalCaptureStorage();
      payload.clearSession = { ok: true, mode: "popup-storage-clear" };
    }
    if (reportResult) {
      const path = payload.response && payload.response.path ? payload.response.path : null;
      const msg = res.ok
        ? (path ? `Saved to repo: ${path}` : "Draft saved to RawWriting.")
        : "Save failed.";
      report(msg, payload);
    }
    return { ok: res.ok, needsLogin: false, payload };
  } catch (err) {
    const payload = { ok: false, error: String(err), source };
    if (reportResult) {
      report("Save request failed.", payload);
    }
    return { ok: false, needsLogin: false, payload };
  }
}

async function finalizeAndSave() {
  try {
    const tab = await getActiveTab();
    const stopResult = await sendToTab(tab.id, "STOP_SESSION");
    const saveResult = await saveDraftToRawWriting({ reportResult: false, source: "finalize-and-save" });
    if (saveResult.needsLogin) {
      await setPendingStopSave(true);
    } else if (saveResult.ok) {
      await setPendingStopSave(false);
    }
    const saveOk = saveResult && saveResult.ok;
    const saveMsg = saveOk
      ? "Finalize + Save succeeded."
      : (saveResult && saveResult.needsLogin ? "Finalize stopped. Login required to finish save." : "Finalize + Save failed.");
    report(saveMsg, {
      finalize: stopResult,
      save: saveResult.payload,
      mode: "finalize-and-save"
    });
  } catch (err) {
    report("Finalize + Save failed.", { ok: false, error: String(err) });
  }
}

async function render() {
  try {
    const tab = await getActiveTab();
    const pageStatus = await sendToTab(tab.id, "GET_PAGE_STATUS");
    const capturePreview = await sendToTab(tab.id, "GET_CAPTURE_PREVIEW");

    setDebugData(
      {
        pageStatus,
        capturePreview,
        pageUrl: tab.url || null
      }
    );
    setMessage(capturePreview && capturePreview.active ? "Session started." : "Ready.");
  } catch (err) {
    report("Unable to read tab status.", { ok: false, error: String(err) });
  }
}

async function captureLatestTurn() {
  try {
    const tab = await getActiveTab();
    const captureResult = await sendToTab(tab.id, "CAPTURE_LATEST_TURN");
    const capturePreview = await sendToTab(tab.id, "GET_CAPTURE_PREVIEW");
    report("Manual capture executed.", { captureResult, capturePreview });
  } catch (err) {
    report("Manual capture failed.", { ok: false, error: String(err) });
  }
}

async function startSession() {
  try {
    const tab = await getActiveTab();
    const startResult = await sendToTab(tab.id, "START_SESSION");
    const capturePreview = await sendToTab(tab.id, "GET_CAPTURE_PREVIEW");
    report("Session started.", { startResult, capturePreview });
  } catch (err) {
    report("Failed to start session.", { ok: false, error: String(err) });
  }
}

async function stopSession() {
  try {
    const tab = await getActiveTab();
    const stopResult = await sendToTab(tab.id, "STOP_SESSION");
    const saveResult = await saveDraftToRawWriting({ reportResult: false, source: "stop-session-auto-save" });
    if (saveResult.needsLogin) {
      await setPendingStopSave(true);
      report("Session stopped. Login required to finish save.", { stopResult, save: saveResult.payload });
      return;
    }
    if (saveResult.ok) {
      await setPendingStopSave(false);
      const path = saveResult.payload && saveResult.payload.response && saveResult.payload.response.path
        ? saveResult.payload.response.path
        : null;
      report(path ? `Session stopped and saved to ${path}` : "Session stopped and saved.", { stopResult, save: saveResult.payload });
      return;
    }
    report("Session stopped but save failed.", { stopResult, save: saveResult.payload });
  } catch (err) {
    report("Failed to stop session.", { ok: false, error: String(err) });
  }
}

async function debugSnapshot() {
  try {
    const tab = await getActiveTab();
    const snapshot = await sendToTab(tab.id, "GET_DEBUG_SNAPSHOT");
    report("Debug snapshot loaded.", snapshot);
  } catch (err) {
    report("Debug snapshot failed.", { ok: false, error: String(err) });
  }
}

async function showDraft() {
  try {
    const tab = await getActiveTab();
    const draft = await sendToTab(tab.id, "GET_TRANSCRIPT_DRAFT");
    report("Draft loaded.", draft);
  } catch (err) {
    report("Draft load failed.", { ok: false, error: String(err) });
  }
}

function applyDebugVisibility(debugEnabled) {
  const panel = document.getElementById("debug-panel");
  const toggle = document.getElementById("debug-toggle");
  panel.classList.toggle("hidden", !debugEnabled);
  toggle.checked = debugEnabled;
}

function onDebugToggleChange() {
  const debugEnabled = document.getElementById("debug-toggle").checked;
  applyDebugVisibility(debugEnabled);
  setMessage(debugEnabled ? "Debug mode enabled." : "Debug mode disabled.");
}

document.getElementById("refresh").addEventListener("click", render);
document.getElementById("save-settings").addEventListener("click", saveSettings);
document.getElementById("open-login").addEventListener("click", openBackendLoginPage);
document.getElementById("import-token").addEventListener("click", importTokenFromBackendTab);
document.getElementById("finalize-save").addEventListener("click", finalizeAndSave);
document.getElementById("save-draft").addEventListener("click", saveDraftToRawWriting);
document.getElementById("start").addEventListener("click", startSession);
document.getElementById("stop").addEventListener("click", stopSession);
document.getElementById("capture").addEventListener("click", captureLatestTurn);
document.getElementById("draft").addEventListener("click", showDraft);
document.getElementById("debug").addEventListener("click", debugSnapshot);
document.getElementById("debug-toggle").addEventListener("change", onDebugToggleChange);

Promise.all([loadSettingsIntoForm()])
  .then(() => {
    applyDebugVisibility(false);
    return Promise.all([render(), tryImportToken({ reportResult: false })])
      .then(async () => {
        const pending = await getPendingStopSave();
        if (pending) {
          const saveResult = await saveDraftToRawWriting({ reportResult: false, source: "pending-stop-save-init" });
          if (saveResult.ok) {
            await setPendingStopSave(false);
            report("Pending stop-save completed.", saveResult.payload);
          }
        }
      });
  })
  .catch((err) => {
    report("Popup initialization failed.", { ok: false, error: String(err) });
  });
