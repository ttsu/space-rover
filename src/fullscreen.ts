const doc = typeof document !== 'undefined' ? document : null

const requestFullscreenFn =
  doc?.documentElement?.requestFullscreen ??
  (doc?.documentElement as { webkitRequestFullscreen?: () => Promise<void> } | null)?.webkitRequestFullscreen ??
  null

const exitFullscreenFn =
  doc?.exitFullscreen ?? (doc as { webkitExitFullscreen?: () => Promise<void> } | null)?.webkitExitFullscreen ?? null

export function isFullscreenSupported(): boolean {
  return typeof requestFullscreenFn === 'function'
}

export function requestFullscreen(): Promise<void> {
  if (!doc || !requestFullscreenFn) return Promise.resolve()
  return requestFullscreenFn.call(doc.documentElement)
}

export function exitFullscreen(): Promise<void> {
  if (!doc || !exitFullscreenFn) return Promise.resolve()
  return exitFullscreenFn.call(doc)
}

export function isFullscreen(): boolean {
  if (!doc) return false
  const fullscreenElement =
    doc.fullscreenElement ?? (doc as { webkitFullscreenElement?: Element }).webkitFullscreenElement
  return fullscreenElement != null
}
