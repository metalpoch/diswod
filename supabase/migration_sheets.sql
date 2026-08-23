create table if not exists player_sheets (
  mesa_id uuid not null references mesas(id) on delete cascade,
  player_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (mesa_id, player_id)
);

alter table player_sheets enable row level security;
drop policy if exists player_sheets_all on player_sheets;
create policy player_sheets_all on player_sheets for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table player_sheets;
exception when duplicate_object then null;
end $$;
