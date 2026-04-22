-- ============================
-- Argue: Database Schema
-- ============================

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- Rooms
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'other',
  status text not null default 'open' check (status in ('open', 'active', 'closed')),
  source_url text, -- SNS URL that triggered room creation
  created_by uuid references public.profiles on delete set null,
  time_limit int, -- minutes, 0 = unlimited
  created_at timestamptz default now() not null,
  closed_at timestamptz
);

-- Arguments (debate posts)
create table if not exists public.arguments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  user_id uuid references public.profiles on delete set null,
  stance text not null check (stance in ('for', 'against')),
  content text not null,
  evidence_url text not null, -- required evidence URL
  evidence_description text, -- optional description of evidence
  parent_id uuid references public.arguments on delete set null,
  created_at timestamptz default now() not null,
  vote_count int default 0 not null
);

-- Votes
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  argument_id uuid not null references public.arguments on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  value int not null check (value in (1, -1)),
  created_at timestamptz default now() not null,
  unique (argument_id, user_id)
);

-- AI Moderations
create table if not exists public.ai_moderations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  type text not null check (type in ('summary', 'fact_check', 'feedback', 'topic_analysis', 'rejection')),
  content text not null,
  suggestion text, -- suggested revision for rejected posts
  triggered_by uuid references public.arguments on delete set null,
  created_at timestamptz default now() not null
);

-- RLS policies
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.arguments enable row level security;
alter table public.votes enable row level security;
alter table public.ai_moderations enable row level security;

-- Everyone can read
create policy "Public read profiles" on public.profiles for select using (true);
create policy "Public read rooms" on public.rooms for select using (true);
create policy "Public read arguments" on public.arguments for select using (true);
create policy "Public read votes" on public.votes for select using (true);
create policy "Public read ai_moderations" on public.ai_moderations for select using (true);

-- Authenticated users can insert
create policy "Auth insert rooms" on public.rooms for insert with check (auth.uid() = created_by);
create policy "Auth insert arguments" on public.arguments for insert with check (auth.uid() = user_id);
create policy "Auth insert votes" on public.votes for insert with check (auth.uid() = user_id);

-- Service role for AI moderation inserts (via server-side)
create policy "Service insert ai_moderations" on public.ai_moderations for insert with check (true);
