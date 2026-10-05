-- Amplía las condiciones de Escena sin modificar filas, claves, FK, RLS ni policies.
-- Localiza el CHECK anterior por su definición, aunque PostgreSQL le haya dado otro nombre.
do $$
declare
  existing_check record;
begin
  for existing_check in
    select conname, pg_get_constraintdef(oid) as definition
    from pg_constraint
    where conrelid = 'public.mesa_player_conditions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~* '\mkey\M'
      and pg_get_constraintdef(oid) ilike '%frenzy%'
  loop
    if existing_check.definition not ilike '%knockdown%'
       or existing_check.definition not ilike '%stunned%' then
      execute format(
        'alter table public.mesa_player_conditions drop constraint %I',
        existing_check.conname
      );
    end if;
  end loop;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mesa_player_conditions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~* '\mkey\M'
      and pg_get_constraintdef(oid) ilike '%frenzy%'
      and pg_get_constraintdef(oid) ilike '%knockdown%'
      and pg_get_constraintdef(oid) ilike '%stunned%'
  ) then
    alter table public.mesa_player_conditions
      add constraint mesa_player_conditions_key_check
      check (key in ('frenzy', 'knockdown', 'stunned')) not valid;
  end if;

  for existing_check in
    select conname
    from pg_constraint
    where conrelid = 'public.mesa_player_conditions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~* '\mkey\M'
      and pg_get_constraintdef(oid) ilike '%frenzy%'
      and pg_get_constraintdef(oid) ilike '%knockdown%'
      and pg_get_constraintdef(oid) ilike '%stunned%'
      and not convalidated
  loop
    execute format(
      'alter table public.mesa_player_conditions validate constraint %I',
      existing_check.conname
    );
  end loop;
end
$$;
