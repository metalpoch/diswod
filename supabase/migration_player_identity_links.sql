create table if not exists public.mesa_player_identity_links (
  mesa_id uuid not null,
  discord_user_id text not null,
  player_id text not null,
  claimed_at timestamptz not null default now(),
  primary key (mesa_id, discord_user_id),
  unique (mesa_id, player_id),
  constraint mesa_player_identity_links_member_fk
    foreign key (mesa_id, player_id)
    references public.mesa_members (mesa_id, player_id)
    on delete cascade
);

alter table public.mesa_player_identity_links enable row level security;
-- Deliberately no public/anon/authenticated policy. The Edge Function uses service role.
revoke all on table public.mesa_player_identity_links from public, anon, authenticated;
grant select, insert on public.mesa_player_identity_links to service_role;

create or replace function public.claim_legacy_mesa_player(
  p_mesa_id uuid,
  p_discord_user_id text,
  p_player_id text,
  p_invite_code text,
  p_confirmed_dm boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_player_id text;
  candidate_role text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_mesa_id::text, 0));

  if not exists (
    select 1 from mesas where id = p_mesa_id and invite_code = p_invite_code
  ) then
    return jsonb_build_object('status', 'invalid_invite');
  end if;

  select player_id into existing_player_id
  from mesa_player_identity_links
  where mesa_id = p_mesa_id and discord_user_id = p_discord_user_id;
  if found then
    if existing_player_id = p_player_id then
      return jsonb_build_object('status', 'claimed', 'player_id', existing_player_id);
    end if;
    return jsonb_build_object('status', 'conflict');
  end if;

  select role into candidate_role
  from mesa_members
  where mesa_id = p_mesa_id
    and player_id = p_player_id
    and player_id like 'local-%';
  if candidate_role is null or candidate_role not in ('dm', 'player') then
    return jsonb_build_object('status', 'invalid_candidate');
  end if;
  if candidate_role = 'dm' and p_confirmed_dm is not true then
    return jsonb_build_object('status', 'dm_confirmation_required');
  end if;

  if exists (
    select 1 from mesa_player_identity_links
    where mesa_id = p_mesa_id and player_id = p_player_id
  ) then
    return jsonb_build_object('status', 'conflict');
  end if;

  insert into mesa_player_identity_links (mesa_id, discord_user_id, player_id)
  values (p_mesa_id, p_discord_user_id, p_player_id);
  return jsonb_build_object('status', 'claimed', 'player_id', p_player_id);
exception when unique_violation then
  return jsonb_build_object('status', 'conflict');
end;
$$;

revoke all on function public.claim_legacy_mesa_player(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_legacy_mesa_player(uuid, text, text, text, boolean) to service_role;
