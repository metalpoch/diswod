const STARTUP_MESSAGES = {
  client_id_missing: 'Configura VITE_DISCORD_CLIENT_ID en las variables de build de Discord Activity.',
  sdk_import: 'No se pudo cargar el SDK de Discord. Revisa el Client ID y la configuración de la Activity.',
  sdk_import_timeout: 'La carga del SDK de Discord tardó demasiado. Reintenta o vuelve a abrir la Activity.',
  sdk_initialize: 'No se pudo inicializar Discord. Revisa el Client ID de la Activity.',
  sdk_ready_timeout: 'Discord no respondió al handshake de inicio a tiempo. Reintenta la conexión.',
  sdk_ready_rejected: 'Discord rechazó el inicio. Revisa el Client ID y los URL Mappings de la Activity.',
  oauth_authorize: 'Discord no pudo autorizar la cuenta; elige un usuario de la Activity para continuar.',
  discord_token: 'No se pudo verificar la cuenta con Discord; elige un usuario de la Activity para continuar.',
  oauth_authenticate: 'Discord no pudo confirmar la cuenta; elige un usuario de la Activity para continuar.',
  post_connect_room_url: 'La conexión con Discord continúa, pero no se pudo guardar la sala en la URL.',
  activity_startup: 'No se pudo iniciar Discord Activity. Reintenta o vuelve a abrir la Activity.',
}

const CATEGORIES = new Set(Object.keys(STARTUP_MESSAGES))

export function categorizedStartupError(category) {
  const safeCategory = CATEGORIES.has(category) ? category : 'activity_startup'
  const error = new Error(safeCategory)
  error.startupCategory = safeCategory
  return error
}

export function startupFailureCategory(error) {
  try {
    const descriptor = error && Object.getOwnPropertyDescriptor(error, 'startupCategory')
    const category = descriptor && 'value' in descriptor ? descriptor.value : ''
    return CATEGORIES.has(category) ? category : 'activity_startup'
  } catch {
    return 'activity_startup'
  }
}

export function sdkUnavailableCategory(result) {
  if (result?.sdk) return ''
  return CATEGORIES.has(result?.failureCategory) ? result.failureCategory : 'activity_startup'
}

export function startupSafeMessage(category) {
  return STARTUP_MESSAGES[CATEGORIES.has(category) ? category : 'activity_startup']
}

export function persistRoomSafely(persist, room) {
  try {
    persist(room)
    return { persisted: true, warning: '' }
  } catch {
    return { persisted: false, warning: 'post_connect_room_url' }
  }
}

export async function loadSdkModule(load, { timeoutMs = 8000, signal } = {}) {
  if (signal?.aborted) return { module: null, cancelled: true }

  let timer
  let onAbort
  try {
    const outcome = await Promise.race([
      Promise.resolve()
        .then(() => (signal?.aborted ? null : load()))
        .then((module) => signal?.aborted
          ? { module: null, cancelled: true }
          : { module, cancelled: false })
        .catch(() => { throw categorizedStartupError('sdk_import') }),
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(categorizedStartupError('sdk_import_timeout')), timeoutMs)
        if (signal) {
          onAbort = () => resolve({ module: null, cancelled: true })
          signal.addEventListener('abort', onAbort, { once: true })
        }
      }),
    ])
    return outcome
  } finally {
    clearTimeout(timer)
    if (signal && onAbort) signal.removeEventListener('abort', onAbort)
  }
}

export async function waitForSdkReady(ready, { timeoutMs = 30_000, signal } = {}) {
  if (signal?.aborted) return false

  let timer
  let onAbort
  try {
    const outcome = await Promise.race([
      Promise.resolve()
        .then(() => ready())
        .then(() => ({ ready: true }))
        .catch(() => { throw categorizedStartupError('sdk_ready_rejected') }),
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(categorizedStartupError('sdk_ready_timeout')), timeoutMs)
        if (signal) {
          onAbort = () => resolve({ cancelled: true })
          signal.addEventListener('abort', onAbort, { once: true })
        }
      }),
    ])
    return !signal?.aborted && outcome.ready === true
  } finally {
    clearTimeout(timer)
    if (signal && onAbort) signal.removeEventListener('abort', onAbort)
  }
}
