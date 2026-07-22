importScripts('config.js');

chrome.runtime.onInstalled.addListener(() => {
  console.log('SKVK Autofill Assistant installed');
});

// All network calls live here rather than in content.js on purpose:
// background runs in the extension's own context, so it isn't subject to a
// job site's Content-Security-Policy the way a content-script fetch would be.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'autofillRequest') {
    handleAutofillRequest(message.questions).then(sendResponse);
    return true; // keeps the message channel open for the async response
  }
  if (message.action === 'login') {
    handleLogin(message.email, message.password).then(sendResponse);
    return true;
  }
  if (message.action === 'getProfile') {
    handleGetProfile().then(sendResponse);
    return true;
  }
});

async function getToken() {
  const { skvk_token } = await chrome.storage.local.get(['skvk_token']);
  return skvk_token;
}

async function handleAutofillRequest(questions) {
  try {
    const token = await getToken();
    if (!token) return { ok: false, error: 'not_logged_in' };

    const res = await fetch(`${SKVK_CONFIG.API_BASE}/autofill/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ questions })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.error || `Request failed (${res.status})` };
    }

    const data = await res.json();
    return { ok: true, results: data.results };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// content.js needs the raw profile (not just single Q&A answers) so it can
// fill repeating "Experience"/"Education" blocks itself - one block per
// array entry - without a round trip per field. Same not-subject-to-CSP
// reasoning as handleAutofillRequest above: this runs in the background
// context, not the job site's page.
async function handleGetProfile() {
  try {
    const token = await getToken();
    if (!token) return { ok: false, error: 'not_logged_in' };

    const res = await fetch(`${SKVK_CONFIG.API_BASE}/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.error || `Request failed (${res.status})` };
    }

    const profile = await res.json();
    return { ok: true, profile };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handleLogin(email, password) {
  try {
    const res = await fetch(`${SKVK_CONFIG.API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Login failed' };
    await chrome.storage.local.set({ skvk_token: data.token, skvk_email: email });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
