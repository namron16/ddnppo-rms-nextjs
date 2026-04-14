import type { AdminRole } from './auth'

export interface StoredProfilePrefs {
  displayName?: string
  avatarUrl?: string
}

function getStorageKey(role: AdminRole): string {
  return `rms_profile_prefs:${role}`
}

export function getStoredProfilePrefs(role: AdminRole): StoredProfilePrefs {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(getStorageKey(role))
    if (!raw) return {}
    return JSON.parse(raw) as StoredProfilePrefs
  } catch {
    return {}
  }
}

export function saveStoredProfilePrefs(role: AdminRole, prefs: StoredProfilePrefs): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(getStorageKey(role), JSON.stringify(prefs))
  } catch {
    // Ignore storage failures.
  }
}

export function clearStoredProfilePrefs(role: AdminRole): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(getStorageKey(role))
  } catch {
    // Ignore storage failures.
  }
}