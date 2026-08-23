import { supabase } from './supabase'

const AVATAR_MAX = 2 * 1024 * 1024
const BG_MAX = 5 * 1024 * 1024

function extOf(name, fallback) {
  return (name.split('.').pop() || fallback).replace(/[^a-z0-9]/gi, '').slice(0, 5) || fallback
}

async function upload(path, file) {
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
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

export function validAvatarFile(file) {
  if (!file) return 'Sin archivo'
  if (!/^image\//.test(file.type)) return 'El archivo debe ser una imagen'
  if (file.size > AVATAR_MAX) return 'La imagen debe pesar menos de 2 MB'
  return ''
}

export async function uploadAvatar(mesaId, playerId, file) {
  if (!supabase) throw new Error('Sin conexión con Supabase')
  const invalid = validAvatarFile(file)
  if (invalid) throw new Error(invalid)
  return upload(`${mesaId}/${playerId}-avatar.${extOf(file.name, 'png')}`, file)
}

export async function uploadBackground(mesaId, file) {
  if (!supabase) throw new Error('Sin conexión con Supabase')
  if (!file) throw new Error('Sin archivo')
  if (!/^image\//.test(file.type)) throw new Error('El archivo debe ser una imagen')
  if (file.size > BG_MAX) throw new Error('La imagen debe pesar menos de 5 MB')
  return upload(`${mesaId}/background.${extOf(file.name, 'jpg')}`, file)
}

export async function uploadPhoto(mesaId, playerId, file) {
  if (!supabase) throw new Error('Sin conexión con Supabase')
  if (!file) throw new Error('Sin archivo')
  if (!/^image\//.test(file.type)) throw new Error('El archivo debe ser una imagen')
  if (file.size > BG_MAX) throw new Error('La imagen debe pesar menos de 5 MB')
  return upload(`${mesaId}/photo-${playerId}.${extOf(file.name, 'jpg')}`, file)
}
