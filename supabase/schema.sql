-- Notluk · Supabase veritabanı şeması
-- Supabase Dashboard > SQL Editor içinde tek seferde çalıştırın.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Kullanıcı',
  avatar_initials text not null default 'SN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references auth.users(id) on delete cascade,
  color text not null default '#5965e8',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null check (email = lower(email)),
  display_name text not null default 'Davetli',
  avatar_initials text not null default 'SN',
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  status text not null default 'pending' check (status in ('active', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null default 'İsimsiz not' check (char_length(title) <= 240),
  content text not null default '<p><br></p>',
  plain_text text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by_name text not null default 'Bir üye',
  favorite boolean not null default false,
  archived boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_members_user_idx on public.workspace_members(user_id);
create index if not exists workspace_members_email_idx on public.workspace_members(email);
create index if not exists notes_workspace_updated_idx on public.notes(workspace_id, updated_at desc);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.workspaces w
      where w.id = target_workspace_id and w.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = target_workspace_id
        and (
          m.user_id = auth.uid()
          or m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    );
$$;

create or replace function public.can_edit_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.workspaces w
      where w.id = target_workspace_id and w.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = target_workspace_id
        and m.role in ('owner', 'editor')
        and m.status = 'active'
        and (
          m.user_id = auth.uid()
          or m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = target_workspace_id and w.owner_id = auth.uid()
  );
$$;

create or replace function public.claim_workspace_invites()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.workspace_members
  set
    user_id = auth.uid(),
    status = 'active',
    updated_at = now()
  where email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and (user_id is null or user_id = auth.uid());
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  full_name text;
  generated_initials text;
  personal_workspace_id uuid;
begin
  full_name := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'Kullanıcı');
  generated_initials := upper(
    left(full_name, 1)
    || left(coalesce(nullif(split_part(full_name, ' ', 2), ''), substring(full_name from 2)), 1)
  );
  insert into public.profiles (id, display_name, avatar_initials)
  values (new.id, full_name, coalesce(nullif(generated_initials, ''), 'SN'))
  on conflict (id) do nothing;

  insert into public.workspaces (name, owner_id, color)
  values ('Kişisel', new.id, '#737985')
  returning id into personal_workspace_id;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    email,
    display_name,
    avatar_initials,
    role,
    status
  ) values (
    personal_workspace_id,
    new.id,
    lower(new.email),
    full_name,
    coalesce(nullif(generated_initials, ''), 'SN'),
    'owner',
    'active'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute procedure public.touch_updated_at();

drop trigger if exists workspaces_touch_updated_at on public.workspaces;
create trigger workspaces_touch_updated_at before update on public.workspaces
  for each row execute procedure public.touch_updated_at();

drop trigger if exists members_touch_updated_at on public.workspace_members;
create trigger members_touch_updated_at before update on public.workspace_members
  for each row execute procedure public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.notes enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "workspaces_select_members" on public.workspaces;
create policy "workspaces_select_members" on public.workspaces for select
  using (public.is_workspace_member(id));

drop policy if exists "workspaces_insert_owner" on public.workspaces;
create policy "workspaces_insert_owner" on public.workspaces for insert
  with check (owner_id = auth.uid());

drop policy if exists "workspaces_update_owner" on public.workspaces;
create policy "workspaces_update_owner" on public.workspaces for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "workspaces_delete_owner" on public.workspaces;
create policy "workspaces_delete_owner" on public.workspaces for delete
  using (owner_id = auth.uid());

drop policy if exists "members_select_members" on public.workspace_members;
create policy "members_select_members" on public.workspace_members for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "members_insert_editors" on public.workspace_members;
create policy "members_insert_editors" on public.workspace_members for insert
  with check (
    public.is_workspace_owner(workspace_id)
    or (public.can_edit_workspace(workspace_id) and role in ('editor', 'viewer'))
  );

drop policy if exists "members_update_editors" on public.workspace_members;
create policy "members_update_editors" on public.workspace_members for update
  using (
    public.is_workspace_owner(workspace_id)
    or (public.can_edit_workspace(workspace_id) and role <> 'owner')
  )
  with check (
    public.is_workspace_owner(workspace_id)
    or (public.can_edit_workspace(workspace_id) and role in ('editor', 'viewer'))
  );

drop policy if exists "members_delete_editors" on public.workspace_members;
create policy "members_delete_editors" on public.workspace_members for delete
  using (
    public.is_workspace_owner(workspace_id)
    or (public.can_edit_workspace(workspace_id) and role <> 'owner')
  );

drop policy if exists "notes_select_members" on public.notes;
create policy "notes_select_members" on public.notes for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "notes_insert_editors" on public.notes;
create policy "notes_insert_editors" on public.notes for insert
  with check (public.can_edit_workspace(workspace_id) and created_by = auth.uid());

drop policy if exists "notes_update_editors" on public.notes;
create policy "notes_update_editors" on public.notes for update
  using (public.can_edit_workspace(workspace_id))
  with check (public.can_edit_workspace(workspace_id));

drop policy if exists "notes_delete_editors" on public.notes;
create policy "notes_delete_editors" on public.notes for delete
  using (public.can_edit_workspace(workspace_id));

grant execute on function public.claim_workspace_invites() to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.can_edit_workspace(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.notes to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notes'
  ) then
    alter publication supabase_realtime add table public.notes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workspace_members'
  ) then
    alter publication supabase_realtime add table public.workspace_members;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workspaces'
  ) then
    alter publication supabase_realtime add table public.workspaces;
  end if;
end $$;
