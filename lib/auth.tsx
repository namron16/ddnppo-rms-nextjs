'use client'
// lib/auth.tsx
// ─────────────────────────────────────────────
// Auth context: current user state, login, logout.
// Sets a lightweight cookie so middleware can protect routes.
// Wrap the app in <AuthProvider> (done in app/layout.tsx).

import React, {
  createContext, useContext, useState,
  useCallback, useEffect,
} from 'react'
import type { User } from '@/types'
import { USERS } from '@/lib/data'

interface AuthContextValue {
  user: User | null
  login: (email: string, password: string) => boolean
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Cookie helpers ────────────────────────────
function setCookie(name: string, value: string, days = 1) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}
function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
}
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

// ── Provider ──────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]         = useState<User | null>(null)
  const [isLoading, setLoading] = useState(true)

  // Rehydrate from cookie on mount
  useEffect(() => {
    const email = getCookie('rms_session')
    if (email) {
      const found = USERS.find(u => u.email === email)
      if (found) setUser(found)
    }
    setLoading(false)
  }, [])

  const login = useCallback((email: string, password: string): boolean => {
    if (password !== 'password') return false
    const found = USERS.find(u => u.email === email)
    if (!found) return false
    setUser(found)
    setCookie('rms_session', found.email)
    setCookie('rms_role',    found.role)
    return true
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    deleteCookie('rms_session')
    deleteCookie('rms_role')
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
