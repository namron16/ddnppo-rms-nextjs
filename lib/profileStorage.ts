import { supabase } from './supabase'
import type { AdminRole } from './auth'

export interface StoredProfilePrefs {
  displayName?: string
  avatarUrl?: string
  updated_at?: string
}

function getStorageKey(role: AdminRole): string {
  return `rms_profile_prefs:${role}`
}

export function getCachedProfilePrefs(role: AdminRole): StoredProfilePrefs {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(getStorageKey(role))
    if (!raw) return {}
    return JSON.parse(raw) as StoredProfilePrefs
  } catch {
    return {}
  }
}

export function saveCachedProfilePrefs(role: AdminRole, prefs: StoredProfilePrefs): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(getStorageKey(role), JSON.stringify(prefs))
  } catch {
    // Ignore storage failures.
  }
}

export function clearCachedProfilePrefs(role: AdminRole): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(getStorageKey(role))
  } catch {
    // Ignore storage failures.
  }
}

function normalizePrefs(row: any): StoredProfilePrefs {
  return {
    displayName: row?.display_name ?? undefined,
    avatarUrl: row?.avatar_url ?? undefined,
    updated_at: row?.updated_at ?? undefined,
  }
}

export async function getStoredProfilePrefs(role: AdminRole): Promise<StoredProfilePrefs> {
  const { data, error } = await supabase
    .from('admin_profile_prefs')
    .select('*')
    .eq('role', role)
    .maybeSingle()

  if (error || !data) {
    return getCachedProfilePrefs(role)
  }

  const prefs = normalizePrefs(data)
  saveCachedProfilePrefs(role, prefs)
  return prefs
}

export async function saveStoredProfilePrefs(role: AdminRole, prefs: StoredProfilePrefs): Promise<StoredProfilePrefs | null> {
  const payload = {
    role,
    display_name: prefs.displayName ?? null,
    avatar_url: prefs.avatarUrl ?? null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('admin_profile_prefs')
    .upsert(payload, { onConflict: 'role' })
    .select()
    .single()

  if (error || !data) return null

  const normalized = normalizePrefs(data)
  saveCachedProfilePrefs(role, normalized)
  return normalized
}

export function subscribeToProfilePrefs(
  role: AdminRole,
  onChange: (prefs: StoredProfilePrefs) => void
): () => void {
  const channel = supabase
    .channel(`admin_profile_prefs_${role}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'admin_profile_prefs', filter: `role=eq.${role}` },
      payload => {
        const prefs = normalizePrefs(payload.new)
        saveCachedProfilePrefs(role, prefs)
        onChange(prefs)
      }
    )
    .subscribe()

  return () => { void supabase.removeChannel(channel) }
}