const setupView = document.getElementById("setup-view");
const mainView = document.getElementById("main-view");
const statusDot = document.getElementById("status-dot");

const baseUrlInput = document.getElementById("base-url");
const tokenInput = document.getElementById("api-token");
const connectBtn = document.getElementById("connect-btn");
const setupMessage = document.getElementById("setup-message");
const dashboardLink = document.getElementById("dashboard-link");

const accountName = document.getElementById("account-name");
const startBtn = document.getElementById("start-btn");
const startIcon = document.getElementById("start-icon");
const startText = document.getElementById("start-text");
const resultMessage = document.getElementById("result-message");
const lastResults = document.getElementById("last-results");
const settingsBtn = document.getElementById("settings-btn");

function setMessage(el, text, type) {
  el.textContent = text || "";
  el.className = "message" + (type ? ` ${type}` : "");
}

function normalizeBaseUrl(url) {
  return url.trim().replace(/\/+$/, "");
}

async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["apiBaseUrl", "apiToken"], (data) => resolve(data));
  });
}

async function saveConfig(config) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(config, resolve);
  });
}

async function showMainView(baseUrl) {
  setupView.classList.add("hidden");
  mainView.classList.remove("hidden");
  dashboardLink.href = baseUrl || "#";
  statusDot.classList.remove("offline");
  statusDot.classList.add("online");
}

function showSetupView() {
  mainView.classList.add("hidden");
  setupView.classList.remove("hidden");
  statusDot.classList.remove("online");
  statusDot.classList.add("offline");
}

async function init() {
  const { apiBaseUrl, apiToken } = await getConfig();
  if (apiBaseUrl) {
    baseUrlInput.value = apiBaseUrl;
    dashboardLink.href = normalizeBaseUrl(apiBaseUrl) + "/dashboard/extension";
  }
  if (apiToken) tokenInput.value = apiToken;

  if (apiBaseUrl && apiToken) {
    const result = await testConnection(apiBaseUrl, apiToken);
    if (result.ok) {
      accountName.textContent = result.email || "Connected";
      showMainView(apiBaseUrl);
      return;
    }
  }
  showSetupView();
}

async function testConnection(baseUrl, token) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "TEST_CONNECTION", baseUrl: normalizeBaseUrl(baseUrl), token },
      (response) => resolve(response || { ok: false, error: "No response" }),
    );
  });
}

connectBtn.addEventListener("click", async () => {
  const baseUrl = normalizeBaseUrl(baseUrlInput.value);
  const token = tokenInput.value.trim();

  if (!baseUrl || !token) {
    setMessage(setupMessage, "Enter both the dashboard URL and access token.", "error");
    return;
  }

  connectBtn.disabled = true;
  setMessage(setupMessage, "Connecting...", "");

  const result = await testConnection(baseUrl, token);
  connectBtn.disabled = false;

  if (!result.ok) {
    setMessage(setupMessage, result.error || "Could not connect. Check the URL and token.", "error");
    return;
  }

  await saveConfig({ apiBaseUrl: baseUrl, apiToken: token });
  setMessage(setupMessage, "Connected!", "success");
  accountName.textContent = result.email || "Connected";
  showMainView(baseUrl);
});

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  startIcon.textContent = "⏳";
  startText.textContent = "Filling...";
  setMessage(resultMessage, "Scanning the page for form fields...", "");
  lastResults.classList.add("hidden");
  lastResults.innerHTML = "";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab found");

    // Ensure the content script is present (in case the page loaded before
    // the extension was installed/reloaded).
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    } catch {
      // ignore — script may already be injected
    }

    chrome.tabs.sendMessage(tab.id, { type: "START_AUTOFILL" }, (response) => {
      startBtn.disabled = false;
      startIcon.textContent = "▶";
      startText.textContent = "Start Autofill";

      if (chrome.runtime.lastError) {
        setMessage(resultMessage, "Couldn't reach this page. Try refreshing it.", "error");
        return;
      }
      if (!response || response.error) {
        setMessage(resultMessage, response?.error || "Something went wrong.", "error");
        return;
      }

      const { filled, total, details } = response;
      setMessage(
        resultMessage,
        total === 0 ? "No fillable fields detected on this page." : `Filled ${filled} of ${total} fields.`,
        filled > 0 ? "success" : "",
      );

      if (details?.length) {
        lastResults.classList.remove("hidden");
        lastResults.innerHTML = details
          .slice(0, 12)
          .map(
            (d) =>
              `<div class="result-row"><span>${escapeHtml(truncate(d.label, 26))}</span><span>${
                d.filled ? "✅" : "—"
              }</span></div>`,
          )
          .join("");
      }
    });
  } catch (err) {
    startBtn.disabled = false;
    startIcon.textContent = "▶";
    startText.textContent = "Start Autofill";
    setMessage(resultMessage, err instanceof Error ? err.message : "Something went wrong.", "error");
  }
});

settingsBtn.addEventListener("click", () => {
  showSetupView();
});

function truncate(str, len) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

init();
