'use client'
// app/dashboard/layout.tsx
// ─────────────────────────────────────────────
// Dashboard shell for officer-role users.
// Redirects admin users to /admin/master.

import { AuthGuard } from '@/components/layout/AuthGuard'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="officer">
      {children}
    </AuthGuard>
  )
}
