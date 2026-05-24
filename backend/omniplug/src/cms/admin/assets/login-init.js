import { api, icon, setTheme, setToken, themeSwitcher, toast } from './shell.js';

document.getElementById('themeMount').innerHTML = themeSwitcher();
document.getElementById('loginLogo').innerHTML = icon.logo;

document.querySelectorAll('[data-theme-btn]').forEach((btn) => {
  btn.addEventListener('click', () => setTheme(btn.dataset.themeBtn));
});

document.getElementById('togglePassword').innerHTML = icon.eye;
document.getElementById('togglePassword').addEventListener('click', () => {
  const field = document.getElementById('password');
  field.type = field.type === 'password' ? 'text' : 'password';
});

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Đang đăng nhập...';
  await new Promise((resolve) => setTimeout(resolve, 500));
  try {
    const payload = await api('/api/auth/login', {
      method: 'POST',
      skipAuth: true,
      body: {
        email: form.email.value.trim(),
        password: form.password.value,
      },
    });
    setToken(payload.token);
    location.href = '/admin/dashboard.html';
  } catch (err) {
    toast(err.message || 'Không đăng nhập được', 'error');
    button.disabled = false;
    button.textContent = original;
  }
});
