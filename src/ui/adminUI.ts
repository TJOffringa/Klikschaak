import { getAuthToken } from '../multiplayer/auth.js';
import { getGames, deleteGame as deleteGameFromDB } from '../game/gameStorage.js';
import { openAnalysisFromGame } from './analysisUI.js';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface AdminUser {
  id: string;
  username: string;
  email: string;
  friend_code: string;
  created_at: string;
  stats: { wins: number; losses: number; draws: number };
  is_admin: boolean;
}

let adminPanel: HTMLElement | null = null;
let isAdminPanelOpen = false;

export async function checkIsAdmin(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;

  try {
    const response = await fetch(`${SERVER_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return false;
    const user = await response.json();
    return user.isAdmin === true;
  } catch {
    return false;
  }
}

export async function initAdminUI(): Promise<void> {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) return;

  // Add admin button to auth container
  const authContainer = document.getElementById('authContainer');
  if (!authContainer) return;

  const adminBtn = document.createElement('button');
  adminBtn.id = 'adminBtn';
  adminBtn.className = 'auth-btn admin-btn';
  adminBtn.textContent = 'Admin';
  adminBtn.onclick = toggleAdminPanel;

  const userStatus = authContainer.querySelector('.user-status');
  if (userStatus) {
    userStatus.appendChild(adminBtn);
  }
}

function toggleAdminPanel(): void {
  if (isAdminPanelOpen) {
    closeAdminPanel();
  } else {
    openAdminPanel();
  }
}

async function openAdminPanel(): Promise<void> {
  isAdminPanelOpen = true;

  adminPanel = document.createElement('div');
  adminPanel.id = 'adminPanel';
  adminPanel.className = 'admin-panel';
  adminPanel.innerHTML = `
    <div class="admin-panel-header">
      <h2>Admin Dashboard</h2>
      <div class="admin-tabs">
        <button class="admin-tab active" data-tab="users">Users</button>
        <button class="admin-tab" data-tab="games">Games</button>
      </div>
      <button id="closeAdminBtn" class="admin-close-btn">&times;</button>
    </div>
    <div class="admin-panel-content">
      <div id="adminTabContent">Loading...</div>
    </div>
  `;

  document.body.appendChild(adminPanel);
  document.getElementById('closeAdminBtn')?.addEventListener('click', closeAdminPanel);

  // Tab switching
  adminPanel.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab') as 'users' | 'games';
      switchTab(tabName);
    });
  });

  await loadUsers();
}

function switchTab(tab: 'users' | 'games'): void {
  adminPanel?.querySelectorAll('.admin-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-tab') === tab);
  });
  if (tab === 'users') {
    loadUsers();
  } else {
    loadGames();
  }
}

function closeAdminPanel(): void {
  isAdminPanelOpen = false;
  adminPanel?.remove();
  adminPanel = null;
}

async function loadUsers(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  const content = document.getElementById('adminTabContent');
  if (!content) return;

  try {
    const response = await fetch(`${SERVER_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      content.innerHTML = '<p class="error">Failed to load users</p>';
      return;
    }

    const { users } = await response.json() as { users: AdminUser[] };

    if (users.length === 0) {
      content.innerHTML = '<p>No users found</p>';
      return;
    }

    content.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Code</th>
            <th>Stats</th>
            <th>Admin</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr data-user-id="${user.id}">
              <td>${user.username}</td>
              <td>${user.email}</td>
              <td>${user.friend_code}</td>
              <td>${user.stats.wins}W ${user.stats.losses}L ${user.stats.draws}D</td>
              <td>${user.is_admin ? '✓' : ''}</td>
              <td>
                <button class="admin-action-btn toggle-admin" data-id="${user.id}" title="Toggle admin">
                  ${user.is_admin ? '👤' : '👑'}
                </button>
                <button class="admin-action-btn delete-user" data-id="${user.id}" title="Delete user">
                  🗑️
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Add event listeners
    content.querySelectorAll('.toggle-admin').forEach(btn => {
      btn.addEventListener('click', () => toggleAdmin(btn.getAttribute('data-id')!));
    });

    content.querySelectorAll('.delete-user').forEach(btn => {
      btn.addEventListener('click', () => deleteUser(btn.getAttribute('data-id')!));
    });

  } catch (error) {
    content.innerHTML = '<p class="error">Error loading users</p>';
  }
}

async function loadGames(): Promise<void> {
  const content = document.getElementById('adminTabContent');
  if (!content) return;

  content.innerHTML = 'Loading games...';

  try {
    const games = await getGames();

    if (games.length === 0) {
      content.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px;">No saved games yet.</p>';
      return;
    }

    content.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>White vs Black</th>
            <th>Result</th>
            <th>Moves</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${games.map(game => `
            <tr data-game-id="${game.id}">
              <td>${formatDate(game.date)}</td>
              <td><span class="game-type-badge ${game.type}">${game.type}</span></td>
              <td>${escapeHtml(game.white)} vs ${escapeHtml(game.black)}</td>
              <td>${escapeHtml(game.result)}</td>
              <td>${game.moveCount}</td>
              <td>
                <button class="admin-action-btn analyze-game" data-id="${game.id}" title="Analyze">
                  &#128269;
                </button>
                <button class="admin-action-btn delete-game" data-id="${game.id}" title="Delete">
                  🗑️
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Store games for click handlers
    content.querySelectorAll('.analyze-game').forEach(btn => {
      btn.addEventListener('click', () => {
        const gameId = btn.getAttribute('data-id')!;
        const game = games.find(g => g.id === gameId);
        if (game) {
          closeAdminPanel();
          openAnalysisFromGame(game.moves, game.white, game.black);
        }
      });
    });

    content.querySelectorAll('.delete-game').forEach(btn => {
      btn.addEventListener('click', async () => {
        const gameId = btn.getAttribute('data-id')!;
        if (confirm('Delete this game?')) {
          await deleteGameFromDB(gameId);
          await loadGames();
        }
      });
    });

  } catch (error) {
    content.innerHTML = '<p class="error">Error loading games</p>';
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function toggleAdmin(userId: string): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch(`${SERVER_URL}/api/admin/users/${userId}/toggle-admin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      await loadUsers();
    } else {
      const data = await response.json();
      alert(data.error || 'Failed to toggle admin status');
    }
  } catch {
    alert('Error toggling admin status');
  }
}

async function deleteUser(userId: string): Promise<void> {
  if (!confirm('Are you sure you want to delete this user?')) return;

  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch(`${SERVER_URL}/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      await loadUsers();
    } else {
      const data = await response.json();
      alert(data.error || 'Failed to delete user');
    }
  } catch {
    alert('Error deleting user');
  }
}
