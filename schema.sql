-- Safe Schema Creation (Idempotent)

-- 1. Tables (Create if not exists)
CREATE TABLE IF NOT EXISTS teachers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT DEFAULT '0000', -- Secret PIN for verification
  signature_url TEXT, -- Reference signature for comparison
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT, -- Optional
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  register_no TEXT NOT NULL UNIQUE,
  department TEXT,
  status TEXT DEFAULT 'Active', -- 'Active', 'Long Absent', 'Drop Out'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_table (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject_id UUID REFERENCES subjects(id) NOT NULL,
  teacher_id UUID REFERENCES teachers(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  subject_id UUID REFERENCES subjects(id) NOT NULL,
  teacher_id UUID REFERENCES teachers(id) NOT NULL,
  absentees_json JSONB DEFAULT '[]'::jsonb,
  od_students_json JSONB DEFAULT '[]'::jsonb,
  teacher_signature_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Storage (Handle if bucket exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('signatures', 'signatures', true)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS Policies (Drop first to avoid "policy already exists" error)
-- RLS Policies (Allow ALL for demo purposes)
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON teachers;
CREATE POLICY "Enable all access for all users" ON teachers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON subjects;
CREATE POLICY "Enable all access for all users" ON subjects FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON students;
CREATE POLICY "Enable all access for all users" ON students FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE time_table ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON time_table;
CREATE POLICY "Enable all access for all users" ON time_table FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON attendance_logs;
CREATE POLICY "Enable all access for all users" ON attendance_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON attendance_logs;
-- Merged into "Enable all access" above

-- Storage Policies
DROP POLICY IF EXISTS "Give public access to signatures" ON storage.objects;
CREATE POLICY "Give public access to signatures" ON storage.objects FOR SELECT USING (bucket_id = 'signatures');

DROP POLICY IF EXISTS "Enable upload for all users" ON storage.objects;
CREATE POLICY "Enable upload for all users" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'signatures');

-- 4. Mock Data (Ignore unique constraint violations if running again)
INSERT INTO teachers (name) VALUES ('Prof. Smith'), ('Dr. Alice') ON CONFLICT DO NOTHING;
-- Note: Subjects has a UNIQUE constraint on 'code', so this works well.
INSERT INTO subjects (name, code) VALUES ('Mathematics', 'MAT101'), ('Physics', 'PHY102') ON CONFLICT (code) DO NOTHING;

-- 5. New Tables for V2 (Holidays & Settings)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON settings;
CREATE POLICY "Enable all access for all users" ON settings FOR ALL USING (true) WITH CHECK (true);

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
