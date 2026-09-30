-- ============================================================
-- To-Do List App — Supabase RLS policy setup (with RLS ON)
--
-- Run this entire script once in the Supabase SQL Editor.
-- It keeps RLS enabled (secure) but allows the app's public
-- (anon/publishable) key to perform all CRUD operations.
--
-- Table: public.todos
-- Columns:
--   id          bigint        (primary key, identity)
--   task        text
--   is_complete boolean
--   date        date
--   created_at  timestamptz   (defaults to now())
-- ============================================================

-- 1. Make sure RLS is enabled
alter table public.todos enable row level security;

-- 2. Drop any existing policies (avoids "policy already exists" errors
--    and removes any conflicting restrictive policies)
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where tablename = 'todos' and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.todos', p.policyname);
  end loop;
end $$;

-- 3. Create permissive policies for all CRUD operations
--    (using (true) / with check (true) means "allow everyone")

-- SELECT — read all tasks
create policy "todos allow select"
  on public.todos for select
  using (true);

-- INSERT — add new tasks
create policy "todos allow insert"
  on public.todos for insert
  with check (true);

-- UPDATE — mark tasks done / edit tasks
create policy "todos allow update"
  on public.todos for update
  using (true);

-- DELETE — remove tasks
create policy "todos allow delete"
  on public.todos for delete
  using (true);

-- 4. Make created_at auto-fill with the current time
--    (so tasks can be ordered by time)
alter table public.todos
  alter column created_at set default now();
