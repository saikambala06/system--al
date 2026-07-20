// Background service worker: performs all cross-origin calls to the
// AutoFillAI dashboard API on behalf of the popup and content scripts.

async function apiFetch(baseUrl, token, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "TEST_CONNECTION") {
    (async () => {
      try {
        const result = await apiFetch(message.baseUrl, message.token, "/api/profile");
        if (!result.ok) {
          sendResponse({ ok: false, error: "Invalid token or dashboard URL." });
          return;
        }
        sendResponse({ ok: true, email: result.data?.profile?.email || "" });
      } catch {
        sendResponse({ ok: false, error: "Couldn't reach the dashboard. Check the URL." });
      }
    })();
    return true;
  }

  if (message?.type === "AUTOFILL_MATCH") {
    (async () => {
      try {
        chrome.storage.sync.get(["apiBaseUrl", "apiToken"], async (config) => {
          if (!config.apiBaseUrl || !config.apiToken) {
            sendResponse({ ok: false, error: "Not connected. Open the extension popup to connect your account." });
            return;
          }
          try {
            const result = await apiFetch(config.apiBaseUrl, config.apiToken, "/api/autofill/match", {
              method: "POST",
              body: JSON.stringify({
                fields: message.fields,
                url: message.url,
                title: message.title,
              }),
            });
            if (!result.ok) {
              sendResponse({ ok: false, error: result.data?.error || "Autofill request failed." });
              return;
            }
            sendResponse({ ok: true, matches: result.data.matches || [] });
          } catch {
            sendResponse({ ok: false, error: "Network error while matching fields." });
          }
        });
      } catch {
        sendResponse({ ok: false, error: "Unexpected error." });
      }
    })();
    return true;
  }

  return false;
});
