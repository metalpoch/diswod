create extension if not exists pgcrypto;

create table if not exists mesas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  kind text not null default 'principal',
  status text not null default 'active',
  created_by text not null default '',
  dm_id text not null default '',
  invite_code text unique,
  current_session_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references mesas(id) on delete cascade,
  title text not null,
  started_at timestamptz not null default now()
);

create table if not exists log_entries (
  id text primary key,
  mesa_id uuid not null references mesas(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  ts timestamptz not null,
  player_id text,
  player_name text,
  payload jsonb not null
);

create table if not exists player_notes (
  mesa_id uuid not null references mesas(id) on delete cascade,
  player_id text not null,
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (mesa_id, player_id)
);

create table if not exists player_boards (
  mesa_id uuid not null references mesas(id) on delete cascade,
  player_id text not null,
  strokes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (mesa_id, player_id)
);

create table if not exists mesa_members (
  mesa_id uuid not null references mesas(id) on delete cascade,
  player_id text not null,
  player_name text not null default '',
  avatar text,
  role text not null default 'visitor',
  joined_at timestamptz not null default now(),
  primary key (mesa_id, player_id)
);

create index if not exists log_entries_mesa_ts on log_entries (mesa_id, ts);
create index if not exists sessions_mesa on sessions (mesa_id, started_at);
create index if not exists mesa_members_player on mesa_members (player_id);
create index if not exists mesas_invite on mesas (invite_code);

alter table mesas enable row level security;
alter table sessions enable row level security;
alter table log_entries enable row level security;
alter table player_notes enable row level security;
alter table player_boards enable row level security;
alter table mesa_members enable row level security;

drop policy if exists mesas_all on mesas;
drop policy if exists sessions_all on sessions;
drop policy if exists log_entries_all on log_entries;
drop policy if exists player_notes_all on player_notes;
drop policy if exists player_boards_all on player_boards;
drop policy if exists mesa_members_all on mesa_members;

create policy mesas_all on mesas for all using (true) with check (true);
create policy sessions_all on sessions for all using (true) with check (true);
create policy log_entries_all on log_entries for all using (true) with check (true);
create policy player_notes_all on player_notes for all using (true) with check (true);
create policy player_boards_all on player_boards for all using (true) with check (true);
create policy mesa_members_all on mesa_members for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table log_entries;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table player_notes;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table player_boards;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table mesa_members;
exception when duplicate_object then null;
end $$;
