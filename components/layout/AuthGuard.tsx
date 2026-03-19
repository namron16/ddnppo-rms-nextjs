'use client'
// components/layout/AuthGuard.tsx
// ─────────────────────────────────────────────
// Client-side route guard. Redirects to /login
// if no authenticated user is found after load.
// Shows a spinner while auth state rehydrates.
//
// Used in admin/layout.tsx and dashboard/layout.tsx

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth }   from '@/lib/auth'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface AuthGuardProps {
  requiredRole?: 'admin' | 'officer' | 'any'
  children: React.ReactNode
}

export function AuthGuard({ requiredRole = 'any', children }: AuthGuardProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.replace('/login')
      return
    }

    if (requiredRole === 'admin' && user.role !== 'admin') {
      router.replace('/dashboard')
      return
    }

    if (requiredRole === 'officer' && user.role !== 'officer') {
      router.replace('/admin/master')
    }
  }, [user, isLoading, requiredRole, router])

  if (isLoading || !user) {
    return <LoadingSpinner fullPage />
  }

  if (requiredRole === 'admin' && user.role !== 'admin') {
    return <LoadingSpinner fullPage />
  }

  return <>{children}</>
}
