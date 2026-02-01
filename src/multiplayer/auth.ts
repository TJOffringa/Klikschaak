const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const TOKEN_KEY = 'klikschaak_token';
const USER_KEY = 'klikschaak_user';

export interface User {
  id: string;
  username: string;
  friendCode: string;
  stats: {
    wins: number;
    losses: number;
    draws: number;
  };
}

// State
let currentUser: User | null = null;

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser(): User | null {
  if (currentUser) return currentUser;

  const stored = localStorage.getItem(USER_KEY);
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
      return currentUser;
    } catch {
      return null;
    }
  }
  return null;
}

export function isAuthenticated(): boolean {
  return getAuthToken() !== null && getCurrentUser() !== null;
}

function saveAuth(user: User, token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  currentUser = user;
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  currentUser = null;
}

export async function register(
  username: string,
  email: string,
  password: string,
  inviteCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${SERVER_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, inviteCode }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Registration failed' };
    }

    saveAuth(data.user, data.token);
    return { success: true };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'Network error' };
  }
}

export async function login(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Login failed' };
    }

    saveAuth(data.user, data.token);
    return { success: true };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Network error' };
  }
}

export function logout(): void {
  clearAuth();
}

export async function refreshUserData(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;

  try {
    const response = await fetch(`${SERVER_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearAuth();
      }
      return false;
    }

    const user = await response.json();
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    currentUser = user;
    return true;
  } catch {
    return false;
  }
}
