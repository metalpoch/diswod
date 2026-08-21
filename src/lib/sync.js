import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'

export function createGameSync(roomId, onChange) {
  const doc = new Y.Doc()
  const ylog = doc.getArray('log')
  let provider = null

  const emit = () => {
    const entries = ylog.toArray().map((item) => {
      if (typeof item === 'string') {
        try {
          return JSON.parse(item)
        } catch {
          return null
        }
      }
      return item
    }).filter(Boolean)
    entries.sort((a, b) => a.ts - b.ts)
    const remotes = []
    provider?.awareness?.getStates()?.forEach((state) => {
      if (state.player?.id) remotes.push(state.player)
    })
    onChange({
      entries,
      remotes,
      peers: provider?.awareness?.getStates()?.size || 1,
      connected: Boolean(provider?.connected),
    })
  }

  ylog.observe(emit)

  try {
    provider = new WebrtcProvider(`diswod-${roomId}`, doc, {
      signaling: [
        'wss://signaling.yjs.dev',
        'wss://y-webrtc-signaling-eu.herokuapp.com',
        'wss://y-webrtc-signaling-us.herokuapp.com',
      ],
      maxConns: 20,
      filterBcConns: false,
    })
    provider.on('status', emit)
    provider.awareness.on('change', emit)
  } catch {
    provider = null
  }

  emit()

  return {
    add(entry) {
      ylog.push([JSON.stringify(entry)])
    },
    clear() {
      if (ylog.length) ylog.delete(0, ylog.length)
    },
    setAwareness(state) {
      provider?.awareness.setLocalStateField('player', state)
    },
    destroy() {
      try {
        provider?.destroy()
      } catch {
        /* ignore */
      }
      doc.destroy()
    },
  }
}
