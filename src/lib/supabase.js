import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''

export const supabase = url && key ? createClient(url, key) : null

export function hasSupabase() {
  return Boolean(supabase)
}

export function cleanError(err) {
  const raw = String(err?.message || err || '').trim()
  if (!raw) return 'Error desconocido'
  if (/^\s*</.test(raw) || /<!doctype|<html/i.test(raw) || raw.length > 400) {
    return 'No se pudo conectar con Supabase. Revisa el URL Mapping /supabase en el portal de Discord.'
  }
  return raw
}
