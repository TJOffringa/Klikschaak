import { getAuthToken } from '../multiplayer/auth.js';

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
      <button id="closeAdminBtn" class="admin-close-btn">&times;</button>
    </div>
    <div class="admin-panel-content">
      <div id="adminUserList">Loading...</div>
    </div>
  `;

  document.body.appendChild(adminPanel);
  document.getElementById('closeAdminBtn')?.addEventListener('click', closeAdminPanel);

  await loadUsers();
}

function closeAdminPanel(): void {
  isAdminPanelOpen = false;
  adminPanel?.remove();
  adminPanel = null;
}

async function loadUsers(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  const userList = document.getElementById('adminUserList');
  if (!userList) return;

  try {
    const response = await fetch(`${SERVER_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      userList.innerHTML = '<p class="error">Failed to load users</p>';
      return;
    }

    const { users } = await response.json() as { users: AdminUser[] };

    if (users.length === 0) {
      userList.innerHTML = '<p>No users found</p>';
      return;
    }

    userList.innerHTML = `
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
    userList.querySelectorAll('.toggle-admin').forEach(btn => {
      btn.addEventListener('click', () => toggleAdmin(btn.getAttribute('data-id')!));
    });

    userList.querySelectorAll('.delete-user').forEach(btn => {
      btn.addEventListener('click', () => deleteUser(btn.getAttribute('data-id')!));
    });

  } catch (error) {
    userList.innerHTML = '<p class="error">Error loading users</p>';
  }
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
