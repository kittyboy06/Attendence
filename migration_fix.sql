-- RUN THIS IN SUPABASE SQL EDITOR

ALTER TABLE students 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

-- Then go to API Settings -> Reload Schema Cache
