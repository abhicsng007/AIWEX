'use client'

/**
 * Browser-only leftovers from disposable demo runs (progress snapshots, PR
 * drafts). Real sign-up and every new demo entry must drop these so a prior
 * onboarding demo never paints over a completed-journey showcase.
 */
function isDemoClientStorageKey(key: string) {
  return (
    key.startsWith('aiwex-progress:demo-')
    || key.startsWith('aiwex-pr-records:demo-')
    || key === 'aiwex-pr-records'
    // Pre-rename keys from older builds still sitting in long-lived browsers.
    || key.startsWith('shiftline-progress:demo-')
    || key.startsWith('shiftline-pr-records:demo-')
    || key === 'shiftline-pr-records'
    || key === 'shiftline-alpha-progress'
  )
}

/**
 * Removes browser-only leftovers from disposable demo runs so a real sign-up
 * or a fresh demo session does not inherit demo progress, PR drafts, or
 * cached UI state from a previous disposable cookie.
 */
export function clearDemoClientData() {
  if (typeof window === 'undefined') return
  const keysToRemove: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key) continue
    if (isDemoClientStorageKey(key)) keysToRemove.push(key)
  }
  for (const key of keysToRemove) window.localStorage.removeItem(key)
}

export function clearLocalProgressForRun(runId: string | null | undefined) {
  if (typeof window === 'undefined' || !runId) return
  window.localStorage.removeItem(`aiwex-progress:${runId}`)
  window.localStorage.removeItem(`aiwex-pr-records:${runId}`)
  window.localStorage.removeItem(`shiftline-progress:${runId}`)
  window.localStorage.removeItem(`shiftline-pr-records:${runId}`)
  // Legacy unscoped PR cache from older builds.
  if (!runId.startsWith('demo-')) {
    window.localStorage.removeItem('aiwex-pr-records')
    window.localStorage.removeItem('shiftline-pr-records')
  }
}
