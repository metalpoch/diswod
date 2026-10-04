export async function cancelPendingSheetSave(entry, clearTimer) {
  if (!entry) return
  if (entry.timer) clearTimer(entry.timer)
  entry.timer = null
  entry.pending = null
  if (entry.inFlight) await entry.inFlight
}

export async function deleteNpcAfterSaving({ flushPending, cancelPending, remove }) {
  const saved = await flushPending()
  if (!saved) return false
  await cancelPending()
  await remove()
  return true
}
