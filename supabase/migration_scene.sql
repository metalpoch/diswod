-- Estado de escena independiente de las fichas y membresías.
create table if not exists public.mesa_scene_settings (
  mesa_id uuid primary key references public.mesas(id) on delete cascade,
  music_mode text not null default 'auto' check (music_mode in ('auto', 'off', 'track')),
  track_id text,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  constraint mesa_scene_settings_track_check check (
    (music_mode = 'track' and track_id is not null) or
    (music_mode in ('auto', 'off') and track_id is null)
  )
);

create table if not exists public.mesa_player_conditions (
  mesa_id uuid not null,
  player_id text not null,
  key text not null check (key in ('frenzy')),
  active boolean not null default false,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  primary key (mesa_id, player_id, key),
  constraint mesa_player_conditions_member_fk
    foreign key (mesa_id, player_id)
    references public.mesa_members (mesa_id, player_id)
    on delete cascade
);

alter table public.mesa_scene_settings enable row level security;
alter table public.mesa_player_conditions enable row level security;

drop policy if exists mesa_scene_settings_read on public.mesa_scene_settings;
drop policy if exists mesa_player_conditions_read on public.mesa_player_conditions;
create policy mesa_scene_settings_read on public.mesa_scene_settings
  for select to anon, authenticated using (true);
create policy mesa_player_conditions_read on public.mesa_player_conditions
  for select to anon, authenticated using (true);

revoke all on table public.mesa_scene_settings from public, anon, authenticated;
revoke all on table public.mesa_player_conditions from public, anon, authenticated;
grant select on table public.mesa_scene_settings to anon, authenticated;
grant select on table public.mesa_player_conditions to anon, authenticated;
grant all on table public.mesa_scene_settings to service_role;
grant all on table public.mesa_player_conditions to service_role;
