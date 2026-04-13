'use client'
// components/layout/Sidebar.tsx — Updated with ViewRequestBell for P1

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import LogoutConfirmModal from '@/components/modals/LogoutConfirmModal'

interface NavItem {
  label: string
  icon: string
  href: string
}

const DOC_NAV: NavItem[] = [
  { label: 'Master Documents',      icon: '📁', href: '/admin/master' },
  { label: 'Admin Orders',          icon: '📋', href: '/admin/admin-orders' },
  { label: '201 Files',             icon: '📔', href: '/admin/personnel' },
  { label: 'Daily Journal',         icon: '📒', href: '/admin/daily-journals' },  // renamed from classified-docs
  { label: 'Organization',          icon: '🏛️', href: '/admin/organization' },
  { label: 'e-Library',             icon: '📚', href: '/admin/e-library' },
]
const P2_NAV: NavItem[] = [
  { label: 'Master Documents',      icon: '📁', href: '/admin/master' },
  { label: 'Admin Orders',          icon: '📋', href: '/admin/admin-orders' },
  { label: 'Classified Documents',  icon: '🛡️', href: '/admin/classified-documents' },  // renamed from classified-docs
  { label: 'Organization',          icon: '🏛️', href: '/admin/organization' },
  { label: 'e-Library',             icon: '📚', href: '/admin/e-library' },
]

const ADMIN_NAV: NavItem[] = [
  { label: 'Log History',     icon: '📊', href: '/admin/log-history' },
  { label: 'User Management', icon: '👥', href: '/admin/user-management' },
  { label: 'Archive',         icon: '🗄️', href: '/admin/archive' },
]

function NavLink({ item, active, onNavigate }: {
  item: NavItem
  active: boolean
  onNavigate: (href: string) => void
}) {
  return (
    <Link
      href={item.href}
      onClick={() => onNavigate(item.href)}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-[background-color,color] duration-120 ease-[cubic-bezier(0.22,1,0.36,1)] mb-0.5',
        active
          ? 'bg-blue-600 text-white'
          : 'text-white/60 hover:bg-white/10 hover:text-white'
      )}
    >
      <span className="w-5 text-center text-base">{item.icon}</span>
      {item.label}
    </Link>
  )
}

export function Sidebar() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  useEffect(() => {
    const allRoutes = [...DOC_NAV, ...ADMIN_NAV].map(item => item.href)
    allRoutes.forEach(href => router.prefetch(href))
  }, [router])

  useEffect(() => { setPendingHref(null) }, [pathname])

  function handleLogoutConfirm() {
    logout()
    setShowLogoutConfirm(false)
    setTimeout(() => { router.push('/login') }, 100)
  }

  // Show management nav only for PD and P1
  const canSeeAdmin = user && ['PD', 'P1'].includes(user.role)
  const canSeeP2 = user?.role === 'P2';
  const isP1 = user?.role === 'P1'

  return (
    <>
      <aside className="sidebar-fixed">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-2.5">
          <div className="w-9 h-9 bg-yellow-400 rounded-lg flex items-center justify-center text-lg flex-shrink-0">🛡️</div>
          <div className="leading-tight">
            <div className="text-white text-[13px] font-bold tracking-tight">DNPPO Records System</div>
            <div className="text-white/40 text-[9.5px] uppercase tracking-widest font-medium">Davao Del Norte PPO</div>
          </div>
        </div>

        {/* Role badge */}
        {user && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-lg border border-white/10 bg-white/5">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                style={{ background: user.avatarColor }}
              >
                {user.initials}
              </div>
              <div className="min-w-0">
                <p className="text-white text-[11px] font-semibold truncate">{user.role}</p>
                <p className="text-white/40 text-[10px] truncate">{user.title}</p>
              </div>
              {/* P1-only indicator */}
              {isP1 && (
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 bg-violet-500/30 text-violet-300 rounded-full border border-violet-500/30 flex-shrink-0">
                  SUPER
                </span>
              )}
            </div>
          </div>
        )}

        {/* Documents nav */}
        <div className="px-3 pt-5 pb-2">
          <div className="px-3 mb-2 text-[10px] font-bold tracking-widest uppercase text-white/30">Documents</div>
          {canSeeP2 ? P2_NAV.map(item => (
            <NavLink key={item.href} item={item}
              active={pathname === item.href || pendingHref === item.href}
              onNavigate={setPendingHref} />
          )) : DOC_NAV.map(item => (
            <NavLink key={item.href} item={item}
              active={pathname === item.href || pendingHref === item.href}
              onNavigate={setPendingHref} />
          ))}
        </div>

        {/* Administration nav — restricted to PD, P1 */}
        {canSeeAdmin && (
          <div className="px-3 pt-3 pb-2">
            <div className="px-3 mb-2 text-[10px] font-bold tracking-widests uppercase text-white/30">Administration</div>
            {ADMIN_NAV.map(item => (
              <NavLink key={item.href} item={item}
                active={pathname === item.href || pendingHref === item.href}
                onNavigate={setPendingHref} />
            ))}
          </div>
        )}

        {/* User footer */}
        <div className="mt-auto px-3 py-4 border-t border-white/10">
          {/* Logout */}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition text-[12px] font-medium"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      <LogoutConfirmModal
        open={showLogoutConfirm}
        onConfirm={handleLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  )
}