-- Run this SQL in your Supabase project SQL editor
-- Create the app_data table
CREATE TABLE IF NOT EXISTS app_data (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'
);

-- Seed initial data
INSERT INTO app_data (key, data) VALUES
  ('members', '[]'),
  ('matches', '[]'),
  ('users', '[{"username":"admin","password":"1921","firstName":"Admin","lastName":"User","status":"active","perms":{"addPlayer":true,"editPlayer":true,"deletePlayer":true,"addMatch":true,"deleteMatch":true,"useScout":true,"exportData":true}}]')
ON CONFLICT (key) DO NOTHING;

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public) VALUES ('members', 'members', true)
ON CONFLICT (id) DO NOTHING;
