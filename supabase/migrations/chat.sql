-- rooms
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type text not null default 'group' 
    check (type in ('direct', 'group')),
  created_by uuid not null 
    references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_rooms_updated_at 
  on public.rooms;
create trigger set_rooms_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

create index if not exists idx_rooms_name_trgm 
  on public.rooms using gin (name gin_trgm_ops);

-- room_members
create table if not exists public.room_members (
  room_id uuid not null 
    references public.rooms(id) on delete cascade,
  user_id uuid not null 
    references public.profiles(id) on delete cascade,
  role text not null default 'member' 
    check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists idx_room_members_user 
  on public.room_members using btree (user_id);

-- messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null 
    references public.rooms(id) on delete cascade,
  sender_id uuid not null 
    references public.profiles(id),
  content text not null 
    check (char_length(content) between 1 and 10000),
  type text not null default 'text' 
    check (type in ('text', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists set_messages_updated_at 
  on public.messages;
create trigger set_messages_updated_at
  before update on public.messages
  for each row execute function public.set_updated_at();

create index if not exists idx_messages_room_cursor
  on public.messages using btree (room_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_messages_sender 
  on public.messages using btree (sender_id);

-- read_receipts
create table if not exists public.read_receipts (
  room_id uuid not null 
    references public.rooms(id) on delete cascade,
  user_id uuid not null 
    references public.profiles(id) on delete cascade,
  last_read_message_id uuid 
    references public.messages(id),
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- RLS
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.messages enable row level security;
alter table public.read_receipts enable row level security;

-- helper function
create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id 
      and user_id = auth.uid()
  );
$$;

-- rooms policies
drop policy if exists "Rooms visible to members" 
  on public.rooms;
create policy "Rooms visible to members"
  on public.rooms for select
  to authenticated
  using (
    public.is_room_member(id)
    or created_by = auth.uid()
  );

drop policy if exists "Authenticated users can create rooms" 
  on public.rooms;
create policy "Authenticated users can create rooms"
  on public.rooms for insert
  to authenticated
  with check (created_by = auth.uid());

-- room_members policies
drop policy if exists "Members can see room membership" 
  on public.room_members;
create policy "Members can see room membership"
  on public.room_members for select
  to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "Owner can add members" 
  on public.room_members;
create policy "Owner can add members"
  on public.room_members for insert
  to authenticated
  with check (
    user_id = auth.uid() and role = 'owner'
    or exists (
      select 1 from public.room_members rm
      where rm.room_id = room_members.room_id
        and rm.user_id = auth.uid()
        and rm.role in ('owner', 'admin')
    )
  );

drop policy if exists "Members can leave" 
  on public.room_members;
create policy "Members can leave"
  on public.room_members for delete
  to authenticated
  using (user_id = auth.uid());

-- messages policies
drop policy if exists "Messages visible to room members" 
  on public.messages;
create policy "Messages visible to room members"
  on public.messages for select
  to authenticated
  using (
    public.is_room_member(room_id) 
    and deleted_at is null
  );

drop policy if exists "Room members can send messages" 
  on public.messages;
create policy "Room members can send messages"
  on public.messages for insert
  to authenticated
  with check (
    public.is_room_member(room_id)
    and sender_id = auth.uid()
  );

drop policy if exists "Sender can edit own messages" 
  on public.messages;
create policy "Sender can edit own messages"
  on public.messages for update
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- read_receipts policies
drop policy if exists "Users can read own receipts" 
  on public.read_receipts;
create policy "Users can read own receipts"
  on public.read_receipts for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can upsert own receipts" 
  on public.read_receipts;
create policy "Users can upsert own receipts"
  on public.read_receipts for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own receipts" 
  on public.read_receipts;
create policy "Users can update own receipts"
  on public.read_receipts for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- enable realtime
alter publication supabase_realtime 
  add table public.messages;