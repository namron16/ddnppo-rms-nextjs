'use client'
// components/layout/Sidebar.tsx
// Fixed left sidebar for the admin shell.
// Navigation links, section labels, and user footer.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import LogoutConfirmModal from '@/components/modals/LogoutConfirmModal'
import { AdminProfileModal } from '@/components/modals/AdminProfileModal'

interface NavItem {
  label: string
  icon: string
  href: string
}

const DOC_NAV: NavItem[] = [
  { label: 'Master Documents', icon: '📁', href: '/admin/master' },
  { label: 'Admin Orders',   icon: '📋', href: '/admin/admin-orders' },
  { label: '201 Files',   icon: '📔', href: '/admin/personnel' },
  { label: 'Classified Documents',icon: '🔒', href: '/admin/classified-docs' },
  { label: 'Organization',        icon: '🏛️', href: '/admin/organization' },
  { label: 'e-Library',          icon: '📚', href: '/admin/e-library' },
]

const ADMIN_NAV: NavItem[] = [
  { label: 'Log History',      icon: '📊', href: '/admin/log-history' },
  { label: 'User Management',  icon: '👥', href: '/admin/user-management' },
  { label: 'Archive',          icon: '🗄️', href: '/admin/archive' },
  { label: 'Settings',         icon: '⚙️', href: '/admin/settings' },
]

function NavLink({
  item,
  active,
  onNavigate,
}: {
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
  const [showProfile, setShowProfile] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  useEffect(() => {
    const allRoutes = [...DOC_NAV, ...ADMIN_NAV].map((item) => item.href)
    allRoutes.forEach((href) => router.prefetch(href))
  }, [router])

  useEffect(() => {
    setPendingHref(null)
  }, [pathname])

  function handleLogoutClick() {
    setShowLogoutConfirm(true)
  }

  function handleLogoutConfirm() {
    logout()
    setShowLogoutConfirm(false)
    router.push('/login')
  }

  function handleLogoutCancel() {
    setShowLogoutConfirm(false)
  }

  const profileUser = user ? {
    name: user.name ?? 'Admin',
    email: user.email ?? '',
    role: user.role ?? 'admin',
    initials: user.initials ?? 'AD',
    avatarColor: user.avatarColor ?? '#f0b429',
  } : null

  return (
    <>
      <aside className="sidebar-fixed">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-2.5">
          <div className="w-9 h-9 bg-yellow-400 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
            🛡️
          </div>
          <div className="leading-tight">
            <div className="text-white text-[13px] font-bold tracking-tight">DNPPO Records System</div>
            <div className="text-white/40 text-[9.5px] uppercase tracking-widest font-medium">Davao Del Norte PPO</div>
          </div>
        </div>

        {/* Documents nav */}
        <div className="px-3 pt-5 pb-2">
          <div className="px-3 mb-2 text-[10px] font-bold tracking-widest uppercase text-white/30">
            Documents
          </div>
          {DOC_NAV.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={pathname === item.href || pendingHref === item.href}
              onNavigate={setPendingHref}
            />
          ))}
        </div>

        {/* Administration nav */}
        <div className="px-3 pt-3 pb-2">
          <div className="px-3 mb-2 text-[10px] font-bold tracking-widest uppercase text-white/30">
            Administration
          </div>
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={pathname === item.href || pendingHref === item.href}
              onNavigate={setPendingHref}
            />
          ))}
        </div>

        {/* User footer — clickable profile */}
        <div className="mt-auto px-3 py-4 border-t border-white/10">
          {/* Clickable profile area */}
          <button
            onClick={() => setShowProfile(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.99] group text-left"
            title="View profile & settings"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0 ring-2 ring-transparent group-hover:ring-white/20 transition-[box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ background: user?.avatarColor ?? '#f0b429', color: '#0f1c35' }}
            >
              {user?.initials ?? 'RD'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-[13px] font-semibold truncate">
                {user?.name?.split(' ').slice(-1)[0] ?? 'Dela Cruz'}
              </div>
              <div className="text-white/45 text-[11px] capitalize">{user?.role ?? 'Administrator'}</div>
            </div>
            {/* Chevron indicator */}
            <svg
              className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60 transition-[color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-[1px] flex-shrink-0"
              fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Logout button */}
          <button
            onClick={handleLogoutClick}
            title="Logout"
            className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-[background-color,color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.99] text-[12px] font-medium"
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

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        open={showLogoutConfirm}
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
      />

      {/* Admin Profile Modal */}
      <AdminProfileModal
        open={showProfile}
        onClose={() => setShowProfile(false)}
        user={profileUser}
      />
    </>
  )
}