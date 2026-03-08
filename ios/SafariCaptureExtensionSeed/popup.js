async function render() {
  const el = document.getElementById("status");
  try {
    const data = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "PING" }, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve({
          ok: true,
          shellReady: true,
          background: resp || null,
          now: new Date().toISOString()
        });
      });
    });
    el.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    el.textContent = JSON.stringify({ ok: false, error: String(err) }, null, 2);
  }
}

document.getElementById("refresh").addEventListener("click", render);
render();
