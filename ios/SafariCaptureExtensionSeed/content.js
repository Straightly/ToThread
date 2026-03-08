(function () {
  const isOpenAI = /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/.test(location.hostname);
  const isGemini = /(^|\.)gemini\.google\.com$/.test(location.hostname);

  const status = {
    supported: isOpenAI || isGemini,
    provider: isOpenAI ? "openai" : isGemini ? "gemini" : "unknown",
    href: location.href,
    detectedAt: new Date().toISOString()
  };

  window.__toThreadCaptureStatus = status;
  console.log("[ToThread Capture] page status", status);
})();
