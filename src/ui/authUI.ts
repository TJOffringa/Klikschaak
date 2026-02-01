import { register, login, logout, isAuthenticated, getCurrentUser, User } from '../multiplayer/auth.js';
import { connectSocket, disconnectSocket } from '../multiplayer/socket.js';
import { setupLobbyListeners } from '../multiplayer/lobby.js';
import { setupGameListeners } from '../multiplayer/onlineGame.js';
import { showLobbyUI, hideLobbyUI } from './lobbyUI.js';
import { getTranslation } from '../i18n/translations.js';

let authContainer: HTMLElement | null = null;

export function initAuthUI(): void {
  // Create auth container if it doesn't exist
  authContainer = document.getElementById('authContainer');
  if (!authContainer) {
    authContainer = document.createElement('div');
    authContainer.id = 'authContainer';
    document.body.appendChild(authContainer);
  }

  // Check if already authenticated
  if (isAuthenticated()) {
    showUserStatus();
    initializeMultiplayer();
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
      </form>
    </div>
  `;

  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('loginCancel')?.addEventListener('click', showAuthButtons);
}

function showRegisterForm(): void {
  if (!authContainer) return;

  authContainer.innerHTML = `
    <div class="auth-form">
      <h3>Register</h3>
      <form id="registerForm">
        <input type="text" id="regInviteCode" placeholder="Invite Code" required>
        <input type="text" id="regUsername" placeholder="Username" required minlength="3" maxlength="32">
        <input type="email" id="regEmail" placeholder="Email" required>
        <input type="password" id="regPassword" placeholder="Password" required minlength="6">
        <div class="auth-error" id="registerError"></div>
        <div class="auth-form-buttons">
          <button type="submit" class="auth-btn primary">Register</button>
          <button type="button" id="registerCancel" class="auth-btn">Cancel</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
  document.getElementById('registerCancel')?.addEventListener('click', showAuthButtons);
}

async function handleLogin(e: Event): Promise<void> {
  e.preventDefault();

  const username = (document.getElementById('loginUsername') as HTMLInputElement).value;
  const password = (document.getElementById('loginPassword') as HTMLInputElement).value;
  const errorEl = document.getElementById('loginError');

  const result = await login(username, password);

  if (result.success) {
    showUserStatus();
    initializeMultiplayer();
  } else {
    if (errorEl) errorEl.textContent = result.error || 'Login failed';
  }
}

async function handleRegister(e: Event): Promise<void> {
  e.preventDefault();

  const inviteCode = (document.getElementById('regInviteCode') as HTMLInputElement).value;
  const username = (document.getElementById('regUsername') as HTMLInputElement).value;
  const email = (document.getElementById('regEmail') as HTMLInputElement).value;
  const password = (document.getElementById('regPassword') as HTMLInputElement).value;
  const errorEl = document.getElementById('registerError');

  const result = await register(username, email, password, inviteCode);

  if (result.success) {
    showUserStatus();
    initializeMultiplayer();
  } else {
    if (errorEl) errorEl.textContent = result.error || 'Registration failed';
  }
}

function handleLogout(): void {
  logout();
  disconnectSocket();
  hideLobbyUI();
  showAuthButtons();
}

async function initializeMultiplayer(): Promise<void> {
  try {
    await connectSocket();
    setupLobbyListeners();
    setupGameListeners();
    showLobbyUI();
  } catch (error) {
    console.error('Failed to connect:', error);
    // Could show error to user here
  }
}

export function getAuthContainer(): HTMLElement | null {
  return authContainer;
}
