'use client'
// app/login/page.tsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { LoginSchema, zodErrors } from '@/lib/validations'
import { supabase } from '@/lib/supabase'

interface LiveRequestTicker {
  id: string
  fullName: string
  email: string
  submittedAt: string
}

export default function LoginPage() {
  const { login } = useAuth()
  const router    = useRouter()

  const [email, setEmail]       = useState('rdelacruz@ddnppo.gov.ph')
  const [password, setPassword] = useState('password')
  const [errors, setErrors]     = useState<Record<string, string>>({})
  const [authError, setAuthError] = useState('')

  const [newRequestTicker, setNewRequestTicker] = useState<LiveRequestTicker | null>(null)
  const [tickerVisible, setTickerVisible]       = useState(false)
  const [realtimeConnected, setRealtimeConnected] = useState(false)

  const channelRef    = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const tickerTimeout = useRef<ReturnType<typeof setTimeout>>()

  const showTicker = useCallback((req: LiveRequestTicker) => {
    setNewRequestTicker(req)
    setTickerVisible(true)
    clearTimeout(tickerTimeout.current)
    tickerTimeout.current = setTimeout(() => setTickerVisible(false), 6000)
  }, [])

  // Realtime — new access requests ticker (admin-facing only)
  useEffect(() => {
    const channel = supabase
      .channel('login_page_access_requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'access_requests' },
        (payload) => {
          const newReq = payload.new as {
            id: string
            full_name: string
            email: string
            submitted_at: string
          }
          showTicker({
            id:          newReq.id,
            fullName:    newReq.full_name,
            email:       newReq.email,
            submittedAt: newReq.submitted_at,
          })
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      clearTimeout(tickerTimeout.current)
    }
  }, [showTicker])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')

    const result = LoginSchema.safeParse({ email, password })
    if (!result.success) {
      setErrors(zodErrors(result.error))
      return
    }
    setErrors({})

    const success = login(result.data.email, result.data.password)
    if (!success) {
      setAuthError('Invalid credentials. Use the demo credentials below.')
      return
    }
    const isAdmin = result.data.email === 'rdelacruz@ddnppo.gov.ph'
    router.push(isAdmin ? '/admin/master' : '/dashboard')
  }

  const inputCls = (field: string) =>
    `w-full px-4 py-3 border-[1.5px] rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition ${
      errors[field]
        ? 'border-red-400 focus:border-red-400'
        : 'border-slate-200 focus:border-blue-500'
    }`

  return (
    <div className="min-h-screen flex">

      {/* ── Left: Branding ── */}
      <div className="flex-1 login-gradient px-12 pt-10 pb-12 relative overflow-hidden flex flex-col">
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full border-[50px] border-white/[0.05]" />
        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-9 self-start">
            <div className="w-2 h-2 bg-yellow-400 rounded-full" />
            <span className="text-white text-xs font-semibold tracking-wide">Police Regional Office II - Davao Norte Police Provincial Office</span>
          </div>
          <h1 className="font-display text-5xl text-white leading-tight mb-4">
            Records Management<br />System
          </h1>
          <p className="text-white/60 text-[15px] leading-relaxed mb-12 max-w-sm">
            Secure, centralized document management for Davao Norte Provincial Police Office.
          </p>
          <ul className="space-y-3.5">
            {[
              'Hierarchical document repository',
              'Confidential document access control',
              'Complete activity audit log',
              'SMS-authenticated personnel access',
            ].map(f => (
              <li key={f} className="flex items-center gap-3 text-white/80 text-sm">
                <div className="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Realtime connection indicator */}
        <div className={`flex items-center gap-2 self-start mt-8 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
          realtimeConnected
            ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
            : 'bg-white/5 border-white/10 text-white/30'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${realtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
          {realtimeConnected ? 'Live updates active' : 'Connecting…'}
        </div>

        {/* New request ticker (admin-visible) */}
        <div className={`absolute bottom-6 left-6 right-6 transition-all duration-500 ${
          tickerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}>
          <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-amber-300 text-lg flex-shrink-0 mt-0.5">🔔</span>
            <div className="min-w-0">
              <p className="text-white text-xs font-bold leading-snug">New access request</p>
              <p className="text-white/70 text-xs truncate">
                {newRequestTicker?.fullName} — {newRequestTicker?.email}
              </p>
              <p className="text-white/40 text-[10px] mt-0.5">Just now</p>
            </div>
            <button
              onClick={() => setTickerVisible(false)}
              className="text-white/40 hover:text-white/80 ml-auto flex-shrink-0 text-base"
            >×</button>
          </div>
        </div>
      </div>

      {/* ── Right: Form ── */}
      <div className="w-[460px] bg-white px-14 flex flex-col justify-center">
        <h2 className="font-display text-3xl text-slate-800 mb-2">Sign In</h2>
        <p className="text-slate-500 text-sm mb-9">
          Access restricted to authorized DNPPO personnel.
        </p>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })) }}
              placeholder="yourname@ddnppo.gov.ph"
              className={inputCls('email')}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1.5 font-medium">⚠ {errors.email}</p>}
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })) }}
              placeholder="Enter password"
              className={inputCls('password')}
            />
            {errors.password && <p className="text-xs text-red-500 mt-1.5 font-medium">⚠ {errors.password}</p>}
          </div>

          {authError && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {authError}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition text-[15px]"
          >
            Sign In
          </button>
        </form>

        <p className="text-center mt-4 text-sm text-slate-500">
          No account?{' '}
          <Link href="/register" className="text-blue-600 font-medium hover:underline">
            Request access
          </Link>
        </p>

        <div className="mt-7 p-4 bg-blue-50 border border-blue-200 rounded-lg text-[12.5px] text-slate-600 leading-relaxed">
          <span className="block text-[11px] font-bold uppercase text-blue-600 tracking-wide mb-1">
            Demo Credentials
          </span>
          Admin: rdelacruz@ddnppo.gov.ph<br />
          User: asantos@ddnppo.gov.ph<br />
          Password: password
        </div>
      </div>
    </div>
  )
}