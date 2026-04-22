-- Allow authenticated users to insert their own profile
create policy "Auth insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Allow authenticated users to update their own profile
create policy "Auth update own profile" on public.profiles
  for update using (auth.uid() = id);
