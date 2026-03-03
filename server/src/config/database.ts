import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn('Warning: DATABASE_URL not configured. Database features will be disabled.');
}

export const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

export async function query(text: string, params?: unknown[]) {
  if (!pool) throw new Error('Database not configured');
  return pool.query(text, params);
}

// Database types
export interface DbUser {
  id: string;
  username: string;
  email: string;
  password_hash: string | null;
  friend_code: string;
  created_at: string;
  stats: {
    wins: number;
    losses: number;
    draws: number;
    gamesAsWhite: number;
    gamesAsBlack: number;
  };
  is_admin: boolean;
  google_id: string | null;
  email_verified: boolean;
}

export interface DbInviteCode {
  id: string;
  code: string;
  max_uses: number;
  used_count: number;
  active: boolean;
}

export interface DbGame {
  id: string;
  white_player: string;
  black_player: string;
  status: 'waiting' | 'playing' | 'finished';
  time_control: string;
  initial_time: number;
  moves: object[];
  result: string | null;
  created_at: string;
}
