import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { pool, query, DbUser } from '../config/database.js';
import { sendVerificationEmail, sendPasswordResetEmail } from './email.service.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

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
    emailVerified: boolean;
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

    // Create user (email_verified defaults to false)
    const { rows } = await query(
      `INSERT INTO users (username, email, password_hash, friend_code, email_verified)
       VALUES ($1, $2, $3, $4, false)
       RETURNING *`,
      [username, email.toLowerCase(), passwordHash, friendCode]
    );

    const newUser = rows[0];
    if (!newUser) {
      return { success: false, error: 'Failed to create account' };
    }

    // Generate verification token and send email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
      [newUser.id, verificationToken]
    );
    sendVerificationEmail(newUser.email, newUser.username, verificationToken).catch(
      (err) => console.error('Failed to send verification email:', err)
    );

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
        emailVerified: false,
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

    // Check if this is a Google-only account
    if (!user.password_hash) {
      return { success: false, error: 'Dit account gebruikt Google login' };
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
        emailVerified: user.email_verified,
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

// --- Google OAuth ---

export async function googleLogin(idToken: string): Promise<AuthResult> {
  if (!pool) {
    return { success: false, error: 'Database not configured' };
  }
  if (!googleClient) {
    return { success: false, error: 'Google login not configured' };
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return { success: false, error: 'Invalid Google token' };
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const name = payload.name || email.split('@')[0];

    // Check if user exists by google_id
    let { rows } = await query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    let user = rows[0];

    if (!user) {
      // Check if user exists by email (link accounts)
      ({ rows } = await query('SELECT * FROM users WHERE email = $1', [email]));
      user = rows[0];

      if (user) {
        // Link Google to existing account
        await query('UPDATE users SET google_id = $1, email_verified = true WHERE id = $2', [googleId, user.id]);
        user.email_verified = true;
        user.google_id = googleId;
      } else {
        // Create new account
        let friendCode = generateFriendCode();
        let attempts = 0;
        while (attempts < 10) {
          const { rows: fc } = await query('SELECT id FROM users WHERE friend_code = $1 LIMIT 1', [friendCode]);
          if (fc.length === 0) break;
          friendCode = generateFriendCode();
          attempts++;
        }

        // Ensure unique username
        let username = name.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 32);
        if (username.length < 3) username = 'user' + googleId.substring(0, 8);
        const { rows: nameCheck } = await query('SELECT id FROM users WHERE username = $1', [username]);
        if (nameCheck.length > 0) {
          username = username.substring(0, 28) + Math.floor(Math.random() * 10000);
        }

        ({ rows } = await query(
          `INSERT INTO users (username, email, google_id, friend_code, email_verified)
           VALUES ($1, $2, $3, $4, true)
           RETURNING *`,
          [username, email, googleId, friendCode]
        ));
        user = rows[0];
      }
    }

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
        emailVerified: true,
        stats: user.stats,
      },
      token,
    };
  } catch (error) {
    console.error('Google login error:', error);
    return { success: false, error: 'Google login failed' };
  }
}

// --- Email Verification ---

export async function verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
  if (!pool) return { success: false, error: 'Database not configured' };

  try {
    const { rows } = await query(
      `SELECT * FROM email_verification_tokens
       WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );

    if (rows.length === 0) {
      return { success: false, error: 'Ongeldige of verlopen verificatielink' };
    }

    const tokenRow = rows[0];
    await query('UPDATE users SET email_verified = true WHERE id = $1', [tokenRow.user_id]);
    await query('DELETE FROM email_verification_tokens WHERE user_id = $1', [tokenRow.user_id]);

    return { success: true };
  } catch (error) {
    console.error('Email verification error:', error);
    return { success: false, error: 'Verificatie mislukt' };
  }
}

export async function resendVerificationEmail(userId: string): Promise<{ success: boolean; error?: string }> {
  if (!pool) return { success: false, error: 'Database not configured' };

  try {
    const user = await getUserById(userId);
    if (!user) return { success: false, error: 'User not found' };
    if (user.email_verified) return { success: false, error: 'E-mail is al geverifieerd' };

    // Delete old tokens
    await query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);

    // Create new token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
      [userId, verificationToken]
    );

    await sendVerificationEmail(user.email, user.username, verificationToken);
    return { success: true };
  } catch (error) {
    console.error('Resend verification error:', error);
    return { success: false, error: 'Kon verificatie-email niet versturen' };
  }
}

// --- Password Reset ---

export async function requestPasswordReset(email: string): Promise<{ success: boolean }> {
  if (!pool) return { success: true }; // Always return success to prevent email enumeration

  try {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = rows[0];

    if (user && user.password_hash) {
      // Only send reset for accounts with a password (not Google-only)
      await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);

      const resetToken = crypto.randomBytes(32).toString('hex');
      await query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
        [user.id, resetToken]
      );

      await sendPasswordResetEmail(user.email, user.username, resetToken);
    }
  } catch (error) {
    console.error('Password reset request error:', error);
  }

  return { success: true }; // Always success
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!pool) return { success: false, error: 'Database not configured' };

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'Wachtwoord moet minimaal 6 tekens zijn' };
  }

  try {
    const { rows } = await query(
      `SELECT * FROM password_reset_tokens
       WHERE token = $1 AND expires_at > NOW() AND used = false`,
      [token]
    );

    if (rows.length === 0) {
      return { success: false, error: 'Ongeldige of verlopen resetlink' };
    }

    const tokenRow = rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, tokenRow.user_id]);
    await query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [tokenRow.id]);

    return { success: true };
  } catch (error) {
    console.error('Password reset error:', error);
    return { success: false, error: 'Wachtwoord resetten mislukt' };
  }
}

// --- Token Cleanup ---

export async function cleanupExpiredTokens(): Promise<void> {
  if (!pool) return;

  try {
    await query('DELETE FROM email_verification_tokens WHERE expires_at < NOW()');
    await query('DELETE FROM password_reset_tokens WHERE expires_at < NOW()');
  } catch (error) {
    console.error('Token cleanup error:', error);
  }
}
