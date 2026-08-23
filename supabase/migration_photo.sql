-- Retrato completo del personaje (además del avatar circular).
-- Córrelo en el SQL Editor de Supabase.
alter table mesa_members add column if not exists photo text;
