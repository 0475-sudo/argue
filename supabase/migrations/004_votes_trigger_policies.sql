-- ============================
-- Migration 004: votes RLS + vote_count sync trigger
-- ============================

-- Allow users to update/delete only their own votes
create policy "Auth update votes" on public.votes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Auth delete votes" on public.votes
  for delete using (auth.uid() = user_id);

-- Keep arguments.vote_count in sync with the votes table.
-- security definer so the trigger can update arguments regardless of RLS.
create or replace function public.sync_argument_vote_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    update public.arguments
    set vote_count = vote_count + NEW.value
    where id = NEW.argument_id;
    return NEW;
  elsif TG_OP = 'UPDATE' then
    if NEW.argument_id = OLD.argument_id then
      update public.arguments
      set vote_count = vote_count + (NEW.value - OLD.value)
      where id = NEW.argument_id;
    else
      update public.arguments
      set vote_count = vote_count - OLD.value
      where id = OLD.argument_id;
      update public.arguments
      set vote_count = vote_count + NEW.value
      where id = NEW.argument_id;
    end if;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.arguments
    set vote_count = vote_count - OLD.value
    where id = OLD.argument_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists votes_sync_count on public.votes;
create trigger votes_sync_count
after insert or update or delete on public.votes
for each row execute function public.sync_argument_vote_count();
