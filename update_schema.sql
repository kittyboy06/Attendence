-- Run this script to add the new tables for Holiday Management

-- 1. Create Settings Table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON settings;
CREATE POLICY "Enable all access for all users" ON settings FOR ALL USING (true) WITH CHECK (true);

-- 2. Create Holidays Table
CREATE TABLE IF NOT EXISTS holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  description TEXT,
  type TEXT DEFAULT 'Holiday', -- 'Holiday', 'Event', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON holidays;
CREATE POLICY "Enable all access for all users" ON holidays FOR ALL USING (true) WITH CHECK (true);

-- 3. Create Special Schedules Table (Overrides)
CREATE TABLE IF NOT EXISTS special_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  day_order TEXT NOT NULL, -- 'Monday', 'Tuesday', etc.
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE special_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON special_schedules;
CREATE POLICY "Enable all access for all users" ON special_schedules FOR ALL USING (true) WITH CHECK (true);
