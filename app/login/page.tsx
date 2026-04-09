'use client'
// app/login/page.tsx — Admin-Only Login (No public registration)

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, ADMIN_ACCOUNTS } from '@/lib/auth'

const ROLE_OPTIONS = ADMIN_ACCOUNTS.map(a => ({
  id: a.id,
  label: `${a.id} — ${a.title}`,
}))

export default function LoginPage() {
  const { login } = useAuth()
  const router    = useRouter()

  const [roleId, setRoleId]     = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!roleId) { setError('Please select your role.'); return }
    if (!password) { setError('Please enter your password.'); return }

    setLoading(true)
    const success = login(roleId, password)
    setLoading(false)

    if (!success) {
      setError('Invalid credentials. Please check your role and password.')
      return
    }

    router.push('/admin/master')
  }

  const cls = `w-full px-4 py-3 border-[1.5px] rounded-xl text-sm bg-slate-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 transition ${
    error ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-blue-500'
  }`

  return (
    <div className="min-h-screen flex">

      {/* ── Left: Branding ── */}
      <div className="flex-1 login-gradient px-12 pt-10 pb-12 relative overflow-hidden flex flex-col">
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full border-[50px] border-white/[0.05]" />
        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-9 self-start">
            <div className="w-2 h-2 bg-yellow-400 rounded-full" />
            <span className="text-white text-xs font-semibold tracking-wide">Police Regional Office II — Davao Norte PPO</span>
          </div>
          <h1 className="font-display text-5xl text-white leading-tight mb-4">
            Records Management<br />System
          </h1>
          <p className="text-white/60 text-[15px] leading-relaxed mb-12 max-w-sm">
            Secure, centralized document management for DDNPPO authorized administrators only.
          </p>

          {/* Role hierarchy display */}
          <div className="space-y-2 max-w-xs">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3">Admin Roles</p>
            {[
              { role: 'PD', desc: 'Provincial Director — Final Approver', color: '#dc2626' },
              { role: 'DPDA/DPDO', desc: 'Deputy Directors — Reviewers', color: '#d97706' },
              { role: 'P1', desc: 'Records Officer — Uploader', color: '#7c3aed' },
              { role: 'P2–P10', desc: 'Admin Officers — Viewers', color: '#0891b2' },
            ].map(r => (
              <div key={r.role} className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                <span className="text-white/50 text-xs">
                  <span className="text-white/80 font-semibold">{r.role}</span> — {r.desc}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Shield icon bottom */}
        <div className="flex items-center gap-2 mt-8 self-start">
          <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center">🛡️</div>
          <span className="text-white/40 text-xs">Authorized Personnel Only</span>
        </div>
      </div>

      {/* ── Right: Login Form ── */}
      <div className="w-[460px] bg-white px-14 flex flex-col justify-center">
        <div className="mb-8">
          <h2 className="font-display text-3xl text-slate-800 mb-1">Admin Sign In</h2>
          <p className="text-slate-500 text-sm">Access restricted to authorized DDNPPO administrators.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">

          {/* Role selector */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
              Your Role <span className="text-red-500">*</span>
            </label>
            <select
              value={roleId}
              onChange={e => { setRoleId(e.target.value); setError('') }}
              className={cls}
              disabled={loading}
            >
              <option value="">Select your admin role…</option>
              {ROLE_OPTIONS.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Password */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="Enter your password"
                className={`${cls} pr-10`}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPw(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition text-[15px] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Signing in…</>
            ) : '🔐 Sign In'}
          </button>
        </form>

        <p className="text-center mt-6 text-xs text-slate-400 leading-relaxed">
          Access credentials are issued by your system administrator.<br />
          No public registration available.
        </p>

        {/* Dev helper — remove in production */}
        <details className="mt-6">
          <summary className="text-[11px] text-slate-300 cursor-pointer hover:text-slate-400">
            Dev credentials (remove in production)
          </summary>
          <div className="mt-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-[11px] text-slate-500 space-y-1">
            <p><strong>PD</strong>: pd@ddnppo2024</p>
            <p><strong>DPDA</strong>: dpda@ddnppo2024</p>
            <p><strong>DPDO</strong>: dpdo@ddnppo2024</p>
            <p><strong>P1</strong>: p1@ddnppo2024</p>
            <p><strong>P2–P10</strong>: p2@ddnppo2024 … p10@ddnppo2024</p>
          </div>
        </details>
      </div>
    </div>
  )
}