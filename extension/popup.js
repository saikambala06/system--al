const loginView = document.getElementById('loginView');
const appView = document.getElementById('appView');

async function init() {
  const { skvk_token, skvk_email } = await chrome.storage.local.get(['skvk_token', 'skvk_email']);
  if (skvk_token) {
    loginView.classList.add('hidden');
    appView.classList.remove('hidden');
    document.getElementById('userEmail').textContent = skvk_email || '';
  } else {
    loginView.classList.remove('hidden');
    appView.classList.add('hidden');
  }
}

document.getElementById('loginBtn').addEventListener('click', () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('loginError');
  errorEl.textContent = '';

  if (!email || !password) {
    errorEl.textContent = 'Enter your email and password.';
    return;
  }

  chrome.runtime.sendMessage({ action: 'login', email, password }, (response) => {
    if (!response || !response.ok) {
      errorEl.textContent = response?.error || 'Login failed';
      return;
    }
    init();
  });
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await chrome.storage.local.remove(['skvk_token', 'skvk_email']);
  init();
});

document.getElementById('autofillBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: 'runAutofill' });
  window.close();
});

document.getElementById('dashboardLink').href = SKVK_CONFIG.DASHBOARD_URL;

init();
