'use client'
// app/page.tsx
// Root: redirect to /login (or /dashboard if authenticated)

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function RootPage() {
  const { user } = useAuth()
  const router   = useRouter()

  useEffect(() => {
    if (!user) {
      router.replace('/login')
    } else if (user.role === 'admin') {
      router.replace('/admin/master')
    } else {
      router.replace('/dashboard')
    }
  }, [user, router])

  return null
}
