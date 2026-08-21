alter table mesas add column if not exists dm_id text not null default '';
alter table mesas add column if not exists invite_code text;

do $$ begin
  alter table mesas add constraint mesas_invite_code_key unique (invite_code);
exception when duplicate_object then null;
end $$;

create table if not exists mesa_members (
  mesa_id uuid not null references mesas(id) on delete cascade,
  player_id text not null,
  player_name text not null default '',
  avatar text,
  role text not null default 'visitor',
  joined_at timestamptz not null default now(),
  primary key (mesa_id, player_id)
);

create index if not exists mesa_members_player on mesa_members (player_id);
create index if not exists mesas_invite on mesas (invite_code);

alter table mesa_members enable row level security;
drop policy if exists mesa_members_all on mesa_members;
create policy mesa_members_all on mesa_members for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table mesa_members;
exception when duplicate_object then null;
end $$;

update mesas
set invite_code = upper(substr(replace(id::text, '-', ''), 1, 6))
where invite_code is null;
