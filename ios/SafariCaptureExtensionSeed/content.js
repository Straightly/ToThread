(function () {
  const SESSION_KEY = "toThreadCaptureSession";
  const SESSION_STATE_KEY = "toThreadCaptureSessionState";
  const AUTO_CAPTURE_INTERVAL_MS = 2000;

  const isOpenAI = /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/.test(location.hostname);
  const isGemini = /(^|\.)gemini\.google\.com$/.test(location.hostname);
  const provider = isOpenAI ? "openai" : isGemini ? "gemini" : "unknown";

  const status = {
    supported: isOpenAI || isGemini,
    provider,
    href: location.href,
    detectedAt: new Date().toISOString(),
    captureReady: isOpenAI
  };

  function textOrEmpty(node) {
    if (!node) {
      return "";
    }
    const text = (node.innerText || node.textContent || "").trim();
    return text;
  }

  function collectNodes(selectors) {
    const out = [];
    const seen = new Set();
    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector);
      for (const node of nodes) {
        if (!seen.has(node)) {
          seen.add(node);
          out.push(node);
        }
      }
    }
    return out;
  }

  function isBefore(a, b) {
    return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function pickLatestUserAssistantPair(userNodes, assistantNodes) {
    const nonEmptyAssistantNodes = assistantNodes.filter((n) => textOrEmpty(n));
    const targetAssistant =
      nonEmptyAssistantNodes.length > 0
        ? nonEmptyAssistantNodes[nonEmptyAssistantNodes.length - 1]
        : assistantNodes[assistantNodes.length - 1];
    if (!targetAssistant) {
      return { userNode: null, assistantNode: null };
    }

    const usersBeforeAssistant = userNodes.filter((n) => isBefore(n, targetAssistant) && textOrEmpty(n));
    const targetUser =
      usersBeforeAssistant.length > 0
        ? usersBeforeAssistant[usersBeforeAssistant.length - 1]
        : userNodes[userNodes.length - 1] || null;
    return { userNode: targetUser, assistantNode: targetAssistant };
  }

  function buildSelectorDebug(userSelectors, assistantSelectors) {
    const counts = {};
    for (const selector of userSelectors) {
      counts[`user:${selector}`] = document.querySelectorAll(selector).length;
    }
    for (const selector of assistantSelectors) {
      counts[`assistant:${selector}`] = document.querySelectorAll(selector).length;
    }
    return counts;
  }

  function extractOpenAITurn() {
    const userSelectors = [
      '[data-message-author-role="user"]',
      '[data-testid*="user-message"]',
      '[data-testid^="conversation-turn-"] [data-message-author-role="user"]',
      'article [data-message-author-role="user"]'
    ];
    const assistantSelectors = [
      '[data-message-author-role="assistant"]',
      '[data-testid*="assistant-message"]',
      '[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]',
      'article [data-message-author-role="assistant"]'
    ];

    const userNodes = collectNodes(userSelectors);
    const assistantNodes = collectNodes(assistantSelectors);
    const pair = pickLatestUserAssistantPair(userNodes, assistantNodes);
    const prompt = textOrEmpty(pair.userNode);
    const response = textOrEmpty(pair.assistantNode);

    if (!prompt || !response) {
      return {
        ok: false,
        error: "Could not find both prompt and response on page yet",
        debug: {
          userNodeCount: userNodes.length,
          assistantNodeCount: assistantNodes.length,
          selectorCounts: buildSelectorDebug(userSelectors, assistantSelectors)
        }
      };
    }

    return {
      ok: true,
      provider: "openai",
      prompt,
      response,
      capturedAt: new Date().toISOString()
    };
  }

  function signatureOf(turn) {
    return `${turn.prompt}\n---\n${turn.response}`;
  }

  function newConversationId() {
    return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function ensureSession(existingSession, turn, activeProvider) {
    const now = new Date().toISOString();
    const base = existingSession || {};
    return {
      conversationId: base.conversationId || newConversationId(),
      provider: base.provider || activeProvider || turn.provider,
      model: base.model || "unknown",
      startedAt: base.startedAt || turn.capturedAt || now,
      endedAt: base.endedAt || null,
      messages: Array.isArray(base.messages) ? base.messages : [],
      turns: Array.isArray(base.turns) ? base.turns : [],
      updatedAt: now
    };
  }

  function nextSequence(messages) {
    if (!messages.length) {
      return 1;
    }
    return messages[messages.length - 1].sequence + 1;
  }

  async function saveCapturedTurn(turn) {
    const existing = await chrome.storage.local.get([SESSION_KEY, SESSION_STATE_KEY]);
    const session = ensureSession(existing[SESSION_KEY], turn, provider);
    const state = existing[SESSION_STATE_KEY] || { active: false, lastSignature: null };

    const sig = signatureOf(turn);
    const duplicate = state.lastSignature === sig;
    if (!duplicate) {
      const startSeq = nextSequence(session.messages);
      session.messages.push(
        {
          role: "user",
          content: turn.prompt,
          timestamp: turn.capturedAt,
          sequence: startSeq
        },
        {
          role: "assistant",
          content: turn.response,
          timestamp: turn.capturedAt,
          sequence: startSeq + 1
        }
      );
      session.turns.push(turn);
      state.lastSignature = sig;
    }

    session.provider = turn.provider;
    session.endedAt = null;
    session.updatedAt = new Date().toISOString();
    await chrome.storage.local.set({ [SESSION_KEY]: session, [SESSION_STATE_KEY]: state });
    return { saved: !duplicate, session, state };
  }

  async function handleCaptureTurn() {
    if (!isOpenAI) {
      return { ok: false, error: "Capture not implemented for this provider yet", provider };
    }
    const turn = extractOpenAITurn();
    if (!turn.ok) {
      return turn;
    }
    const result = await saveCapturedTurn(turn);
    return {
      ok: true,
      captured: result.saved,
      turn,
      turnCount: result.session.turns.length
    };
  }

  async function getCapturePreview() {
    const existing = await chrome.storage.local.get([SESSION_KEY, SESSION_STATE_KEY]);
    const session = existing[SESSION_KEY] || { provider, turns: [] };
    const state = existing[SESSION_STATE_KEY] || { active: false };
    return {
      ok: true,
      provider: session.provider || provider,
      active: Boolean(state.active),
      turnCount: session.turns.length,
      latestTurn: session.turns.length ? session.turns[session.turns.length - 1] : null
    };
  }

  async function getTranscriptDraft() {
    const existing = await chrome.storage.local.get(SESSION_KEY);
    const session = ensureSession(existing[SESSION_KEY], { provider, capturedAt: new Date().toISOString() }, provider);
    return {
      ok: true,
      transcript: {
        conversationId: session.conversationId,
        provider: session.provider,
        model: session.model,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        messages: session.messages
      },
      turnCount: session.turns.length,
      messageCount: session.messages.length
    };
  }

  async function clearCaptureSession() {
    await chrome.storage.local.remove([SESSION_KEY, SESSION_STATE_KEY]);
    return { ok: true, cleared: true };
  }

  async function startSession() {
    const now = new Date().toISOString();
    const session = {
      conversationId: newConversationId(),
      provider,
      model: "unknown",
      startedAt: now,
      endedAt: null,
      messages: [],
      turns: [],
      updatedAt: now
    };
    const state = {};

    state.active = true;
    state.lastSignature = null;
    state.startedAt = now;
    state.stoppedAt = null;
    await chrome.storage.local.set({ [SESSION_KEY]: session, [SESSION_STATE_KEY]: state });

    startAutoCaptureLoop();
    const capture = await handleCaptureTurn();
    return { ok: true, active: true, capture };
  }

  async function stopSession() {
    const existing = await chrome.storage.local.get([SESSION_KEY, SESSION_STATE_KEY]);
    const state = existing[SESSION_STATE_KEY] || {};
    const session = existing[SESSION_KEY] || null;
    state.active = false;
    state.stoppedAt = new Date().toISOString();
    if (session) {
      session.endedAt = state.stoppedAt;
      session.updatedAt = state.stoppedAt;
    }
    await chrome.storage.local.set({
      [SESSION_STATE_KEY]: state,
      ...(session ? { [SESSION_KEY]: session } : {})
    });
    stopAutoCaptureLoop();
    return { ok: true, active: false };
  }

  let captureTimerId = null;

  async function autoCaptureTick() {
    const existing = await chrome.storage.local.get(SESSION_STATE_KEY);
    const state = existing[SESSION_STATE_KEY] || {};
    if (!state.active) {
      stopAutoCaptureLoop();
      return;
    }
    await handleCaptureTurn();
  }

  function startAutoCaptureLoop() {
    if (captureTimerId) {
      return;
    }
    captureTimerId = setInterval(() => {
      autoCaptureTick().catch((err) => {
        console.log("[ToThread Capture] auto capture error", String(err));
      });
    }, AUTO_CAPTURE_INTERVAL_MS);
  }

  function stopAutoCaptureLoop() {
    if (!captureTimerId) {
      return;
    }
    clearInterval(captureTimerId);
    captureTimerId = null;
  }

  async function getDebugSnapshot() {
    const openAi = extractOpenAITurn();
    const preview = await getCapturePreview();
    return {
      ok: true,
      status,
      extraction: openAi,
      preview
    };
  }

  window.__toThreadCaptureStatus = status;
  console.log("[ToThread Capture] page status", status);

  chrome.storage.local.get(SESSION_STATE_KEY).then((existing) => {
    const state = existing[SESSION_STATE_KEY] || {};
    if (state.active) {
      startAutoCaptureLoop();
    }
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "GET_PAGE_STATUS") {
      sendResponse({ ok: true, status });
      return;
    }
    if (msg && msg.type === "CAPTURE_LATEST_TURN") {
      handleCaptureTurn().then(sendResponse).catch((err) => {
        sendResponse({ ok: false, error: String(err) });
      });
      return true;
    }
    if (msg && msg.type === "GET_CAPTURE_PREVIEW") {
      getCapturePreview().then(sendResponse).catch((err) => {
        sendResponse({ ok: false, error: String(err) });
      });
      return true;
    }
    if (msg && msg.type === "GET_DEBUG_SNAPSHOT") {
      getDebugSnapshot().then(sendResponse).catch((err) => {
        sendResponse({ ok: false, error: String(err) });
      });
      return true;
    }
    if (msg && msg.type === "START_SESSION") {
      startSession().then(sendResponse).catch((err) => {
        sendResponse({ ok: false, error: String(err) });
      });
      return true;
    }
    if (msg && msg.type === "STOP_SESSION") {
      stopSession().then(sendResponse).catch((err) => {
        sendResponse({ ok: false, error: String(err) });
      });
      return true;
    }
    if (msg && msg.type === "GET_TRANSCRIPT_DRAFT") {
      getTranscriptDraft().then(sendResponse).catch((err) => {
        sendResponse({ ok: false, error: String(err) });
      });
      return true;
    }
    if (msg && msg.type === "CLEAR_CAPTURE_SESSION") {
      clearCaptureSession().then(sendResponse).catch((err) => {
        sendResponse({ ok: false, error: String(err) });
      });
      return true;
    }
  });
})();
