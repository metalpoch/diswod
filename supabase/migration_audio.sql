-- Bucket de audio para streaming de pistas ambientales.
-- Sube los mp3 desde el dashboard de Supabase (Storage → audio).
INSERT INTO storage.buckets (id, name, public) VALUES ('audio', 'audio', true)
ON CONFLICT (id) DO NOTHING;
