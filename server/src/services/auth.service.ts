import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase, DbUser } from '../config/database.js';

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
  if (!supabase) {
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
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`)
      .single();

    if (existingUser) {
      return { success: false, error: 'Username or email already exists' };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate unique friend code
    let friendCode = generateFriendCode();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('friend_code', friendCode)
        .single();

      if (!existing) break;
      friendCode = generateFriendCode();
      attempts++;
    }

    // Create user
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        username,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        friend_code: friendCode,
      })
      .select()
      .single();

    if (createError || !newUser) {
      console.error('Error creating user:', createError);
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
  if (!supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    // Find user by username or email
    const isEmail = usernameOrEmail.includes('@');
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq(isEmail ? 'email' : 'username', isEmail ? usernameOrEmail.toLowerCase() : usernameOrEmail)
      .single();

    if (error || !user) {
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
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return null;
    return data as DbUser;
  } catch {
    return null;
  }
}

export async function updateUserStats(
  userId: string,
  result: 'win' | 'loss' | 'draw',
  playedAs?: 'white' | 'black'
): Promise<void> {
  if (!supabase) return;

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

    await supabase
      .from('users')
      .update({ stats })
      .eq('id', userId);
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
  // Calculate the "white deficit" for each player
  // A positive deficit means they've played more black than white
  const player1Deficit = player1Stats.black - player1Stats.white;
  const player2Deficit = player2Stats.black - player2Stats.white;

  // The player with the higher deficit (played more black) should get white
  // If equal, randomize
  if (player1Deficit > player2Deficit) {
    return { player1Color: 'white', player2Color: 'black' };
  } else if (player2Deficit > player1Deficit) {
    return { player1Color: 'black', player2Color: 'white' };
  } else {
    // Equal deficit - randomize
    const random = Math.random() < 0.5;
    return {
      player1Color: random ? 'white' : 'black',
      player2Color: random ? 'black' : 'white',
    };
  }
}
