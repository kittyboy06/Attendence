-- Fix RLS for settings table to allow public access (since we use hardcoded admin password)
alter table settings enable row level security;

-- Drop existing restrictive policies if they exist
drop policy if exists "Allow read access to authenticated users" on settings;
drop policy if exists "Allow all access to authenticated users" on settings;

-- Create permissive policy for anon/public users
create policy "Enable all access for all users"
on settings
for all
using (true)
with check (true);

NOTIFY pgrst, 'reload config';
