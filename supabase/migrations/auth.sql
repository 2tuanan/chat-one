create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  username text;
  display_name text;
begin
  username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  display_name := coalesce(new.raw_user_meta_data->>'display_name', username);

  insert into public.profiles (id, username, display_name, avatar_url)
  values (new.id, username, display_name, new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by users" on public.profiles;
create policy "Profiles are viewable by users"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);
