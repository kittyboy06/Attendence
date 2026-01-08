-- Safe Schema Creation (Idempotent)

-- 1. Tables (Create if not exists)
CREATE TABLE IF NOT EXISTS teachers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  register_no TEXT NOT NULL UNIQUE,
  department TEXT,
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
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON teachers;
CREATE POLICY "Enable read access for all users" ON teachers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON subjects;
CREATE POLICY "Enable read access for all users" ON subjects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON students;
CREATE POLICY "Enable read access for all users" ON students FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON time_table;
CREATE POLICY "Enable read access for all users" ON time_table FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON attendance_logs;
CREATE POLICY "Enable read access for all users" ON attendance_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON attendance_logs;
CREATE POLICY "Enable insert for all users" ON attendance_logs FOR INSERT WITH CHECK (true);

-- Storage Policies
DROP POLICY IF EXISTS "Give public access to signatures" ON storage.objects;
CREATE POLICY "Give public access to signatures" ON storage.objects FOR SELECT USING (bucket_id = 'signatures');

DROP POLICY IF EXISTS "Enable upload for all users" ON storage.objects;
CREATE POLICY "Enable upload for all users" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'signatures');

-- 4. Mock Data (Ignore unique constraint violations if running again)
INSERT INTO teachers (name) VALUES ('Prof. Smith'), ('Dr. Alice') ON CONFLICT DO NOTHING;
-- Note: Subjects has a UNIQUE constraint on 'code', so this works well.
INSERT INTO subjects (name, code) VALUES ('Mathematics', 'MAT101'), ('Physics', 'PHY102') ON CONFLICT (code) DO NOTHING;
