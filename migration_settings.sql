-- Create settings table
create table if not exists settings (
  key text primary key,
  value text
);

-- Enable RLS
alter table settings enable row level security;

-- Policies for settings
create policy "Allow read access to authenticated users" on settings for select using (auth.role() = 'authenticated');
create policy "Allow all access to authenticated users" on settings for all using (auth.role() = 'authenticated'); -- Or restrict write to admin if needed

-- Insert default academic start date if not exists
insert into settings (key, value) values ('academic_start_date', '2024-06-01') on conflict do nothing;

NOTIFY pgrst, 'reload config';
