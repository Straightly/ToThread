chrome.runtime.onInstalled.addListener(() => {
  console.log("ToThread Capture extension installed");
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "PING") {
    sendResponse({ ok: true, from: "background" });
  }
});
