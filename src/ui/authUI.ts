import {
  register,
  login,
  logout,
  isAuthenticated,
  getCurrentUser,
  isEmailVerified,
  googleLogin,
  verifyEmailToken,
  resendVerification,
  forgotPassword,
  resetPassword,
  refreshUserData,
} from '../multiplayer/auth.js';
import { connectSocket, disconnectSocket } from '../multiplayer/socket.js';
import { setupLobbyListeners } from '../multiplayer/lobby.js';
import { setupGameListeners } from '../multiplayer/onlineGame.js';
import { showLobbyUI, hideLobbyUI } from './lobbyUI.js';
import { initAdminUI } from './adminUI.js';

declare const google: {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }) => void;
      renderButton: (element: HTMLElement, config: {
        theme?: string;
        size?: string;
        width?: number;
        text?: string;
        shape?: string;
        locale?: string;
      }) => void;
    };
  };
};

let authContainer: HTMLElement | null = null;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export function initAuthUI(): void {
  // Create auth container if it doesn't exist
  authContainer = document.getElementById('authContainer');
  if (!authContainer) {
    authContainer = document.createElement('div');
    authContainer.id = 'authContainer';
    document.body.appendChild(authContainer);
  }

  // Check URL for verification/reset tokens
  handleURLTokens();

  // Check if already authenticated
  if (isAuthenticated()) {
    showUserStatus();
    if (isEmailVerified()) {
      initializeMultiplayer();
    } else {
      showVerificationBanner();
    }
    initAdminUI();
  } else {
    showAuthButtons();
  }
}

function showAuthButtons(): void {
  if (!authContainer) return;

  authContainer.innerHTML = `
    <div class="auth-buttons">
      <button id="loginBtn" class="auth-btn">Login</button>
      <button id="registerBtn" class="auth-btn">Register</button>
    </div>
  `;

  document.getElementById('loginBtn')?.addEventListener('click', showLoginForm);
  document.getElementById('registerBtn')?.addEventListener('click', showRegisterForm);
}

function showUserStatus(): void {
  if (!authContainer) return;

  const user = getCurrentUser();
  if (!user) {
    showAuthButtons();
    return;
  }

  authContainer.innerHTML = `
    <div class="user-status">
      <span class="user-info">
        <span class="username">${user.username}</span>
        <span class="friend-code">#${user.friendCode}</span>
      </span>
      <span class="user-stats">${user.stats.wins}W ${user.stats.losses}L ${user.stats.draws}D</span>
      <button id="logoutBtn" class="auth-btn small">Logout</button>
    </div>
  `;

  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
}

function renderGoogleButton(containerId: string): void {
  if (!GOOGLE_CLIENT_ID || typeof google === 'undefined') return;

  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleResponse,
    });
    google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      width: 280,
      text: 'signin_with',
      shape: 'rectangular',
      locale: 'nl',
    });
  } catch {
    // GIS not loaded yet, hide the container
    container.style.display = 'none';
  }
}

async function handleGoogleResponse(response: { credential: string }): Promise<void> {
  const result = await googleLogin(response.credential);
  if (result.success) {
    showUserStatus();
    initializeMultiplayer();
    initAdminUI();
  } else {
    alert(result.error || 'Google login mislukt');
  }
}

function showLoginForm(): void {
  if (!authContainer) return;

  authContainer.innerHTML = `
    <div class="auth-form">
      <h3>Login</h3>
      <form id="loginForm">
        <input type="text" id="loginUsername" placeholder="Username or Email" required>
        <input type="password" id="loginPassword" placeholder="Password" required>
        <div class="auth-error" id="loginError"></div>
        <div class="auth-form-buttons">
          <button type="submit" class="auth-btn primary">Login</button>
          <button type="button" id="loginCancel" class="auth-btn">Cancel</button>
        </div>
        <a href="#" id="forgotPasswordLink" class="auth-link">Wachtwoord vergeten?</a>
      </form>
      <div class="auth-divider"><span>of</span></div>
      <div class="google-signin-wrapper" id="googleLoginBtn"></div>
    </div>
  `;

  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('loginCancel')?.addEventListener('click', showAuthButtons);
  document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    showForgotPasswordForm();
  });
  renderGoogleButton('googleLoginBtn');
}

function showRegisterForm(): void {
  if (!authContainer) return;

  authContainer.innerHTML = `
    <div class="auth-form">
      <h3>Register</h3>
      <form id="registerForm">
        <input type="text" id="regUsername" placeholder="Username" required minlength="3" maxlength="32">
        <input type="email" id="regEmail" placeholder="Email" required>
        <input type="password" id="regPassword" placeholder="Password" required minlength="6">
        <div class="auth-error" id="registerError"></div>
        <div class="auth-form-buttons">
          <button type="submit" class="auth-btn primary">Register</button>
          <button type="button" id="registerCancel" class="auth-btn">Cancel</button>
        </div>
      </form>
      <div class="auth-divider"><span>of</span></div>
      <div class="google-signin-wrapper" id="googleRegisterBtn"></div>
    </div>
  `;

  document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
  document.getElementById('registerCancel')?.addEventListener('click', showAuthButtons);
  renderGoogleButton('googleRegisterBtn');
}

async function handleLogin(e: Event): Promise<void> {
  e.preventDefault();

  const username = (document.getElementById('loginUsername') as HTMLInputElement).value;
  const password = (document.getElementById('loginPassword') as HTMLInputElement).value;
  const errorEl = document.getElementById('loginError');

  const result = await login(username, password);

  if (result.success) {
    showUserStatus();
    if (isEmailVerified()) {
      initializeMultiplayer();
    } else {
      showVerificationBanner();
    }
    initAdminUI();
  } else {
    if (errorEl) errorEl.textContent = result.error || 'Login failed';
  }
}

async function handleRegister(e: Event): Promise<void> {
  e.preventDefault();

  const username = (document.getElementById('regUsername') as HTMLInputElement).value;
  const email = (document.getElementById('regEmail') as HTMLInputElement).value;
  const password = (document.getElementById('regPassword') as HTMLInputElement).value;
  const errorEl = document.getElementById('registerError');

  const result = await register(username, email, password);

  if (result.success) {
    showUserStatus();
    showVerificationBanner();
    initAdminUI();
  } else {
    if (errorEl) errorEl.textContent = result.error || 'Registration failed';
  }
}

function handleLogout(): void {
  logout();
  disconnectSocket();
  hideLobbyUI();
  hideVerificationBanner();
  showAuthButtons();
}

// --- Verification Banner ---

function showVerificationBanner(): void {
  hideVerificationBanner();

  const banner = document.createElement('div');
  banner.id = 'verificationBanner';
  banner.className = 'verification-banner';
  banner.innerHTML = `
    <span>Verifieer je e-mailadres om multiplayer te spelen.</span>
    <button id="resendVerificationBtn" class="auth-btn small">Opnieuw versturen</button>
    <span id="resendStatus" class="resend-status"></span>
  `;

  document.body.appendChild(banner);

  document.getElementById('resendVerificationBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('resendVerificationBtn') as HTMLButtonElement;
    const status = document.getElementById('resendStatus');
    btn.disabled = true;

    const result = await resendVerification();

    if (result.success) {
      if (status) status.textContent = 'Verificatie-email verstuurd!';
    } else {
      if (status) status.textContent = result.error || 'Fout bij versturen';
    }

    setTimeout(() => {
      btn.disabled = false;
      if (status) status.textContent = '';
    }, 30000);
  });
}

function hideVerificationBanner(): void {
  document.getElementById('verificationBanner')?.remove();
}

// --- URL Token Handling ---

function handleURLTokens(): void {
  const params = new URLSearchParams(window.location.search);

  const verifyToken = params.get('verify-email');
  if (verifyToken) {
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    handleEmailVerification(verifyToken);
    return;
  }

  const resetToken = params.get('reset-password');
  if (resetToken) {
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    showResetPasswordForm(resetToken);
  }
}

async function handleEmailVerification(token: string): Promise<void> {
  if (!authContainer) return;

  authContainer.innerHTML = `
    <div class="auth-form">
      <h3>E-mail verifiëren...</h3>
      <p>Even geduld...</p>
    </div>
  `;

  const result = await verifyEmailToken(token);

  if (result.success) {
    // Refresh user data so emailVerified is updated
    await refreshUserData();

    authContainer.innerHTML = `
      <div class="auth-form">
        <h3>E-mail geverifieerd!</h3>
        <p>Je account is geverifieerd. Je kunt nu multiplayer spelen.</p>
        <button id="verifiedContinueBtn" class="auth-btn primary">Doorgaan</button>
      </div>
    `;

    document.getElementById('verifiedContinueBtn')?.addEventListener('click', () => {
      hideVerificationBanner();
      if (isAuthenticated()) {
        showUserStatus();
        initializeMultiplayer();
        initAdminUI();
      } else {
        showAuthButtons();
      }
    });
  } else {
    authContainer.innerHTML = `
      <div class="auth-form">
        <h3>Verificatie mislukt</h3>
        <p class="auth-error">${result.error || 'Ongeldige of verlopen link'}</p>
        <button id="verifyFailContinueBtn" class="auth-btn">Terug</button>
      </div>
    `;

    document.getElementById('verifyFailContinueBtn')?.addEventListener('click', () => {
      if (isAuthenticated()) {
        showUserStatus();
        if (isEmailVerified()) {
          initializeMultiplayer();
        } else {
          showVerificationBanner();
        }
      } else {
        showAuthButtons();
      }
    });
  }
}

// --- Forgot / Reset Password ---

function showForgotPasswordForm(): void {
  if (!authContainer) return;

  authContainer.innerHTML = `
    <div class="auth-form">
      <h3>Wachtwoord vergeten</h3>
      <form id="forgotForm">
        <input type="email" id="forgotEmail" placeholder="Je e-mailadres" required>
        <div class="auth-error" id="forgotError"></div>
        <div class="auth-form-buttons">
          <button type="submit" class="auth-btn primary">Stuur reset link</button>
          <button type="button" id="forgotCancel" class="auth-btn">Terug</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('forgotForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('forgotEmail') as HTMLInputElement).value;
    const errorEl = document.getElementById('forgotError');

    const result = await forgotPassword(email);

    if (result.success) {
      if (!authContainer) return;
      authContainer.innerHTML = `
        <div class="auth-form">
          <h3>E-mail verstuurd</h3>
          <p>Als er een account met dit e-mailadres bestaat, ontvang je een reset link.</p>
          <button id="forgotDoneBtn" class="auth-btn primary">Terug naar login</button>
        </div>
      `;
      document.getElementById('forgotDoneBtn')?.addEventListener('click', showLoginForm);
    } else {
      if (errorEl) errorEl.textContent = result.error || 'Er ging iets mis';
    }
  });

  document.getElementById('forgotCancel')?.addEventListener('click', showLoginForm);
}

function showResetPasswordForm(token: string): void {
  if (!authContainer) return;

  authContainer.innerHTML = `
    <div class="auth-form">
      <h3>Nieuw wachtwoord instellen</h3>
      <form id="resetForm">
        <input type="password" id="resetPassword" placeholder="Nieuw wachtwoord" required minlength="6">
        <input type="password" id="resetPasswordConfirm" placeholder="Bevestig wachtwoord" required minlength="6">
        <div class="auth-error" id="resetError"></div>
        <div class="auth-form-buttons">
          <button type="submit" class="auth-btn primary">Wachtwoord resetten</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('resetForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = (document.getElementById('resetPassword') as HTMLInputElement).value;
    const confirm = (document.getElementById('resetPasswordConfirm') as HTMLInputElement).value;
    const errorEl = document.getElementById('resetError');

    if (password !== confirm) {
      if (errorEl) errorEl.textContent = 'Wachtwoorden komen niet overeen';
      return;
    }

    const result = await resetPassword(token, password);

    if (result.success) {
      if (!authContainer) return;
      authContainer.innerHTML = `
        <div class="auth-form">
          <h3>Wachtwoord gewijzigd!</h3>
          <p>Je kunt nu inloggen met je nieuwe wachtwoord.</p>
          <button id="resetDoneBtn" class="auth-btn primary">Naar login</button>
        </div>
      `;
      document.getElementById('resetDoneBtn')?.addEventListener('click', showLoginForm);
    } else {
      if (errorEl) errorEl.textContent = result.error || 'Reset mislukt';
    }
  });
}

async function initializeMultiplayer(): Promise<void> {
  try {
    await connectSocket();
    setupLobbyListeners();
    setupGameListeners();
    showLobbyUI();
  } catch (error) {
    console.error('Failed to connect:', error);
  }
}

export function getAuthContainer(): HTMLElement | null {
  return authContainer;
}
