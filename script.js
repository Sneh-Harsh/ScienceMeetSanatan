const loginForm = document.querySelector('.login-form');
const toggleLoginBtn = document.querySelector('#toggleLogin');
const pageBody = document.body;

const updateToggleLabel = () => {
  if (!toggleLoginBtn) {
    return;
  }

  const isVideoOnly = pageBody.classList.contains('video-only');
  toggleLoginBtn.textContent = isVideoOnly ? 'Show Login' : 'Hide Login';
  toggleLoginBtn.setAttribute('aria-pressed', String(isVideoOnly));
};

loginForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  alert('Login submitted. Connect this to your backend when ready.');
});

toggleLoginBtn?.addEventListener('click', () => {
  pageBody.classList.toggle('video-only');
  updateToggleLabel();
});

toggleLoginBtn?.addEventListener('mouseenter', () => {
  toggleLoginBtn.textContent = 'Watch Animation';
});

toggleLoginBtn?.addEventListener('mouseleave', () => {
  updateToggleLabel();
});

updateToggleLabel();