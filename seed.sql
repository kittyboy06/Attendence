-- 1. Insert or Get Teacher ID
-- Returns the ID for 'Prof. Smith' so we can use it later.
-- If you are running this line by line in dashboard, just copy the ID.
-- For a script, we often use CTEs or just direct inserts.

-- EXAMPLE 1: Adding a Subject and Linking a Class
WITH new_teacher AS (
    INSERT INTO teachers (name) VALUES ('Prof. John Doe') RETURNING id
),
new_subject AS (
    INSERT INTO subjects (name, code) VALUES ('Computer Networks', 'CS301') RETURNING id
)
INSERT INTO time_table (day_of_week, start_time, end_time, subject_id, teacher_id)
SELECT 
    'Monday',         -- Day
    '09:00:00',       -- Start Time
    '10:00:00',       -- End Time
    new_subject.id,
    new_teacher.id
FROM new_teacher, new_subject;


-- EXAMPLE 2: Adding a class for an EXISTING Teacher and Subject
-- First, find the IDs from your tables (use the Table Editor view)
-- Teacher ID: invalid-uuid-placeholder (Replace this with real UUID from teachers table)
-- Subject ID: invalid-uuid-placeholder (Replace this with real UUID from subjects table)

-- INSERT INTO time_table (day_of_week, start_time, end_time, subject_id, teacher_id)
-- VALUES 
-- ('Tuesday', '10:00:00', '11:00:00', 'subject-uuid-here', 'teacher-uuid-here');


-- EXAMPLE 3: Bulk Insert needed for a whole week? 
-- It is often easier to use the "Table Editor" in Supabase to click "Insert Row".
-- 1. Go to 'subjects' table -> Add your subjects.
-- 2. Go to 'teachers' table -> Add your teachers.
-- 3. Go to 'time_table' table -> Add rows manually selecting the Subject and Teacher ID.
