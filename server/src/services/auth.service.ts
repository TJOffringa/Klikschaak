import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, query, DbUser } from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

export interface JwtPayload {
  userId: string;
  username: string;
  friendCode: string;
}

export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    username: string;
    friendCode: string;
    stats: { wins: number; losses: number; draws: number };
  };
  token?: string;
  error?: string;
}

function generateFriendCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function registerUser(
  username: string,
  email: string,
  password: string
): Promise<AuthResult> {
  if (!pool) {
    return { success: false, error: 'Database not configured' };
  }

  // Validate input
  if (!username || username.length < 3 || username.length > 32) {
    return { success: false, error: 'Username must be 3-32 characters' };
  }
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Invalid email address' };
  }
  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }

  try {
    // Check if username or email already exists
    const { rows: existing } = await query(
      'SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1',
      [username, email.toLowerCase()]
    );

    if (existing.length > 0) {
      return { success: false, error: 'Username or email already exists' };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate unique friend code
    let friendCode = generateFriendCode();
    let attempts = 0;
    while (attempts < 10) {
      const { rows } = await query(
        'SELECT id FROM users WHERE friend_code = $1 LIMIT 1',
        [friendCode]
      );
      if (rows.length === 0) break;
      friendCode = generateFriendCode();
      attempts++;
    }

    // Create user
    const { rows } = await query(
      `INSERT INTO users (username, email, password_hash, friend_code)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [username, email.toLowerCase(), passwordHash, friendCode]
    );

    const newUser = rows[0];
    if (!newUser) {
      return { success: false, error: 'Failed to create account' };
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: newUser.id,
        username: newUser.username,
        friendCode: newUser.friend_code,
      } as JwtPayload,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        friendCode: newUser.friend_code,
        stats: newUser.stats,
      },
      token,
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'Registration failed' };
  }
}

export async function loginUser(
  usernameOrEmail: string,
  password: string
): Promise<AuthResult> {
  if (!pool) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    // Find user by username or email
    const isEmail = usernameOrEmail.includes('@');
    const { rows } = await query(
      isEmail
        ? 'SELECT * FROM users WHERE email = $1'
        : 'SELECT * FROM users WHERE username = $1',
      [isEmail ? usernameOrEmail.toLowerCase() : usernameOrEmail]
    );

    const user = rows[0];
    if (!user) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        friendCode: user.friend_code,
      } as JwtPayload,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        friendCode: user.friend_code,
        stats: user.stats,
      },
      token,
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}

export async function getUserById(userId: string): Promise<DbUser | null> {
  if (!pool) return null;

  try {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
    return (rows[0] as DbUser) || null;
  } catch {
    return null;
  }
}

export async function updateUserStats(
  userId: string,
  result: 'win' | 'loss' | 'draw',
  playedAs?: 'white' | 'black'
): Promise<void> {
  if (!pool) return;

  try {
    const user = await getUserById(userId);
    if (!user) return;

    const stats = {
      wins: user.stats.wins || 0,
      losses: user.stats.losses || 0,
      draws: user.stats.draws || 0,
      gamesAsWhite: user.stats.gamesAsWhite || 0,
      gamesAsBlack: user.stats.gamesAsBlack || 0,
    };

    if (result === 'win') stats.wins++;
    else if (result === 'loss') stats.losses++;
    else stats.draws++;

    if (playedAs === 'white') stats.gamesAsWhite++;
    else if (playedAs === 'black') stats.gamesAsBlack++;

    await query('UPDATE users SET stats = $1 WHERE id = $2', [JSON.stringify(stats), userId]);
  } catch (error) {
    console.error('Error updating user stats:', error);
  }
}

export async function getColorStats(userId: string): Promise<{ white: number; black: number }> {
  const user = await getUserById(userId);
  if (!user) return { white: 0, black: 0 };

  return {
    white: user.stats.gamesAsWhite || 0,
    black: user.stats.gamesAsBlack || 0,
  };
}

export function determineColors(
  player1Stats: { white: number; black: number },
  player2Stats: { white: number; black: number }
): { player1Color: 'white' | 'black'; player2Color: 'white' | 'black' } {
  const player1Deficit = player1Stats.black - player1Stats.white;
  const player2Deficit = player2Stats.black - player2Stats.white;

  if (player1Deficit > player2Deficit) {
    return { player1Color: 'white', player2Color: 'black' };
  } else if (player2Deficit > player1Deficit) {
    return { player1Color: 'black', player2Color: 'white' };
  } else {
    const random = Math.random() < 0.5;
    return {
      player1Color: random ? 'white' : 'black',
      player2Color: random ? 'black' : 'white',
    };
  }
}
