const toggleLoginBtn = document.querySelector('#toggleLogin');
const pageBody = document.body;

const loginForm = document.querySelector('#loginForm');
const signupForm = document.querySelector('#signupForm');
const switchAuthBtn = document.querySelector('#switchAuthBtn');
const switchPrompt = document.querySelector('#switchPrompt');
const formHeading = document.querySelector('#formHeading');
const socialBlock = document.querySelector('#socialBlock');

let authMode = pageBody.dataset.mode === 'signup' ? 'signup' : 'login';

const updateAuthModeUi = () => {
  if (!loginForm || !signupForm || !switchAuthBtn || !switchPrompt || !formHeading || !socialBlock) {
    return;
  }

  const isSignup = authMode === 'signup';

  loginForm.classList.toggle('hidden', isSignup);
  signupForm.classList.toggle('hidden', !isSignup);
  socialBlock.classList.toggle('hidden', isSignup);

  formHeading.textContent = isSignup ? 'Create Account' : 'Welcome Back';
  switchPrompt.textContent = isSignup ? 'Already have an account?' : "Don't have an account?";
  switchAuthBtn.textContent = isSignup ? 'Log In' : 'Sign Up';
};

switchAuthBtn?.addEventListener('click', () => {
  authMode = authMode === 'signup' ? 'login' : 'signup';
  updateAuthModeUi();
});

const updateToggleLabel = () => {
  if (!toggleLoginBtn) {
    return;
  }

  const isVideoOnly = pageBody.classList.contains('video-only');
  toggleLoginBtn.textContent = isVideoOnly ? 'Show Login' : 'Hide Login';
  toggleLoginBtn.setAttribute('aria-pressed', String(isVideoOnly));
};

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
updateAuthModeUi();