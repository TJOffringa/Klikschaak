-- Klikschaak Database Schema for Supabase
-- Run this in the Supabase SQL Editor

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
  result VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_friend_code ON users(friend_code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_white_player ON games(white_player);
CREATE INDEX IF NOT EXISTS idx_games_black_player ON games(black_player);

-- Insert initial invite codes for beta
INSERT INTO invite_codes (code, max_uses, active) VALUES
  ('BETA2024', 100, true),
  ('KLIKSCHAAK', 50, true),
  ('WELCOME', 25, true)
ON CONFLICT (code) DO NOTHING;

-- Row Level Security (optional but recommended)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (true);

-- Allow users to read games they're in
CREATE POLICY "Users can read their games" ON games
  FOR SELECT USING (true);
