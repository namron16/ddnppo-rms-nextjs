'use client'
// components/layout/Sidebar.tsx
// Fixed left sidebar for the admin shell.
// Navigation links, section labels, and user footer.

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

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

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname()
  const active   = pathname === item.href

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition mb-0.5',
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

  function handleLogout() {
    logout()
    router.push('/login')
  }

  return (
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
        {DOC_NAV.map(item => <NavLink key={item.href} item={item} />)}
      </div>

      {/* Administration nav */}
      <div className="px-3 pt-3 pb-2">
        <div className="px-3 mb-2 text-[10px] font-bold tracking-widest uppercase text-white/30">
          Administration
        </div>
        {ADMIN_NAV.map(item => <NavLink key={item.href} item={item} />)}
      </div>

      {/* User footer */}
      <div className="mt-auto px-3 py-4 border-t border-white/10 flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0"
          style={{ background: '#f0b429', color: '#0f1c35' }}
        >
          {user?.initials ?? 'RD'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-[13px] font-semibold truncate">
            {user?.name?.split(' ').slice(-1)[0] ?? 'Dela Cruz'}
          </div>
          <div className="text-white/45 text-[11px] capitalize">{user?.role ?? 'Administrator'}</div>
        </div>
        <button
          onClick={handleLogout}
          title="Logout"
          className="text-white/40 hover:text-white/80 transition text-base p-1"
        >
          ⏻
        </button>
      </div>
    </aside>
  )
}
