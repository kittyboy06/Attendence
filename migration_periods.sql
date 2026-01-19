
-- Add period column to time_table
ALTER TABLE time_table ADD COLUMN IF NOT EXISTS period text; -- Using text to store '1', '2', etc. or integer? let's use text for flexibility or int?
-- Actually integer is better for ordering, but 'Break' is not a class.
-- Only 'classes' go into time_table. So 1-8.
-- Let's use integer.
ALTER TABLE time_table ADD COLUMN IF NOT EXISTS period_number integer;

-- Add period column to attendance_logs
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS period_number integer;

-- Update existing records? We might not be able to auto-map old start_times easily without complex logic.
-- For now, allow nullable, but UI will start using it.

-- Check if columns exist before adding? Postgres 'IF NOT EXISTS' handles it.

-- Note: We are NOT removing start_time/end_time columns immediately to prevent breaking existing code running in parallel (if any), 
-- but we will stop using them in the new UI logic.

-- Force schema cache reload
NOTIFY pgrst, 'reload config';
