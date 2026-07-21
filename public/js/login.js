if (SKVK.getToken()) {
  window.location.href = 'dashboard.html';
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('error');
  errorEl.textContent = '';

  try {
    const data = await SKVK.apiRequest('/auth/login', { method: 'POST', body: { email, password } });
    SKVK.setToken(data.token);
    window.location.href = 'dashboard.html';
  } catch (err) {
    errorEl.textContent = err.message;
  }
});
