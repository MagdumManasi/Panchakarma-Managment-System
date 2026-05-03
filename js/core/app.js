/* === Core: App Init, Auth, Logout === */

// ── Current state ─────────────────────────────
let currentUser = null;
let currentPage = null;

// ── Logout ────────────────────────────────────
function logout() {
  clearTimeout(window._idleTimer);
  clearTimeout(window._warningTimer);
  currentUser = null;
  DB.cart = [];
  document.getElementById('app').classList.remove('active');
  document.getElementById('pending-page').classList.remove('active');
  document.getElementById('login-page').classList.add('active');
  // Re-render signin
  if (typeof renderSignIn === 'function') renderSignIn();
  showToast('Signed out successfully.', 'info');
}

// ── DOMContentLoaded ──────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Splash animation
  setTimeout(() => {
    const splash = document.getElementById('splash');
    if (splash) { splash.classList.add('hidden'); }
    const loginPage = document.getElementById('login-page');
    if (loginPage) loginPage.classList.add('active');
    // Render default auth view
    App.showAuthMode('signin');
  }, 1800);
});

// ── App namespace ─────────────────────────────
const App = {
  showAuthMode(mode) {
    const area = document.getElementById('auth-card-area');
    if (!area) return;
    document.querySelectorAll('.auth-mode-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('btn-' + mode);
    if (btn) btn.classList.add('active');

    if (mode === 'signin') {
      area.innerHTML = '';
      renderSignIn(area);
    } else {
      area.innerHTML = '';
      renderSignUp(area);
    }
  },

  afterLogin(user) {
    currentUser = user;
    if (user.role === 'doctor' && user.verificationStatus !== 'approved') {
      document.getElementById('login-page').classList.remove('active');
      renderPendingScreen(user);
      return;
    }
    bootApp();
  },
};
