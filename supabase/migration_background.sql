-- Fondo de mesa (imagen de ubicación) elegido por el Narrador.
-- Córrelo en el SQL Editor de Supabase.
alter table mesas add column if not exists background_url text not null default '';
