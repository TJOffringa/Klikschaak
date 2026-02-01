import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Warning: Supabase credentials not configured. Database features will be disabled.');
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Database types
export interface DbUser {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  friend_code: string;
  created_at: string;
  stats: {
    wins: number;
    losses: number;
    draws: number;
  };
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

// SQL schema for reference (run this in Supabase SQL editor)
export const SCHEMA_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(32) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  friend_code VARCHAR(8) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  stats JSONB DEFAULT '{"wins":0,"losses":0,"draws":0}'
);

-- Invite codes table
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(32) UNIQUE NOT NULL,
  max_uses INTEGER DEFAULT 5,
  used_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  white_player UUID REFERENCES users(id),
  black_player UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'waiting',
  time_control VARCHAR(20) DEFAULT 'standard',
  initial_time INTEGER DEFAULT 420000,
  moves JSONB DEFAULT '[]',
  result VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_friend_code ON users(friend_code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);

-- Insert some initial invite codes (remove in production)
INSERT INTO invite_codes (code, max_uses, active) VALUES
  ('BETA2024', 100, true),
  ('KLIKSCHAAK', 50, true)
ON CONFLICT (code) DO NOTHING;
`;
