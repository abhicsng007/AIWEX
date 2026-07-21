'use client'

/**
 * Removes browser-only leftovers from disposable demo runs so a real sign-up
 * does not inherit demo progress, PR drafts, or cached UI state.
 */
export function clearDemoClientData() {
  if (typeof window === 'undefined') return
  const keysToRemove: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key) continue
    if (
      key.startsWith('aiwex-progress:demo-')
      || key === 'aiwex-pr-records'
      || key.startsWith('aiwex-pr-records:demo-')
    ) {
      keysToRemove.push(key)
    }
  }
  for (const key of keysToRemove) window.localStorage.removeItem(key)
}

export function clearLocalProgressForRun(runId: string | null | undefined) {
  if (typeof window === 'undefined' || !runId) return
  window.localStorage.removeItem(`aiwex-progress:${runId}`)
  window.localStorage.removeItem(`aiwex-pr-records:${runId}`)
  // Legacy unscoped PR cache from older builds.
  if (!runId.startsWith('demo-')) window.localStorage.removeItem('aiwex-pr-records')
}
