const toggleLoginBtn = document.querySelector('#toggleLogin');
const pageBody = document.body;

const loginForm = document.querySelector('#loginForm');
const signupForm = document.querySelector('#signupForm');
const forgotForm = document.querySelector('#forgotForm');
const switchAuthBtn = document.querySelector('#switchAuthBtn');
const switchPrompt = document.querySelector('#switchPrompt');
const formHeading = document.querySelector('#formHeading');
const socialBlock = document.querySelector('#socialBlock');
const showForgotBtn = document.querySelector('#showForgotBtn');
const backToLoginBtn = document.querySelector('#backToLoginBtn');

let authMode = pageBody.dataset.mode === 'signup' ? 'signup' : pageBody.dataset.mode === 'forgot' ? 'forgot' : 'login';

const updateAuthModeUi = () => {
  if (!loginForm || !signupForm || !forgotForm || !switchAuthBtn || !switchPrompt || !formHeading || !socialBlock) {
    return;
  }

  const isSignup = authMode === 'signup';
  const isForgot = authMode === 'forgot';

  loginForm.classList.toggle('hidden', isSignup || isForgot);
  signupForm.classList.toggle('hidden', !isSignup);
  forgotForm.classList.toggle('hidden', !isForgot);
  socialBlock.classList.toggle('hidden', isSignup || isForgot);

  formHeading.textContent = isSignup ? 'Create Account' : isForgot ? 'Reset Password' : 'Welcome Back';
  switchPrompt.textContent = isSignup ? 'Already have an account?' : isForgot ? 'Remembered your password?' : "Don't have an account?";
  switchAuthBtn.textContent = isSignup || isForgot ? 'Log In' : 'Sign Up';
};

switchAuthBtn?.addEventListener('click', () => {
  authMode = authMode === 'signup' ? 'login' : 'signup';
  updateAuthModeUi();
});

showForgotBtn?.addEventListener('click', () => {
  authMode = 'forgot';
  updateAuthModeUi();
});

backToLoginBtn?.addEventListener('click', () => {
  authMode = 'login';
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
