import { supabase } from './supabase'

const MAX_BYTES = 2 * 1024 * 1024

export function validAvatarFile(file) {
  if (!file) return 'Sin archivo'
  if (!/^image\//.test(file.type)) return 'El archivo debe ser una imagen'
  if (file.size > MAX_BYTES) return 'La imagen debe pesar menos de 2 MB'
  return ''
}

export async function uploadAvatar(playerId, file) {
  if (!supabase) throw new Error('Sin conexión con Supabase')
  const ext = (file.name.split('.').pop() || 'png').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'png'
  const path = `${playerId}-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: false, contentType: file.type })
  if (error) {
    const msg = String(error.message || error).toLowerCase()
    if (msg.includes('bucket not found') || msg.includes('not found') || msg.includes('bucket')) {
      throw new Error('Falta el bucket "avatars" en Supabase: ejecuta supabase/migration_avatars.sql en el SQL Editor')
    }
    throw error
  }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
