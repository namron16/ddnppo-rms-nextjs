'use client'
// app/login/page.tsx
// Login screen: left branding panel + right sign-in form.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function LoginPage() {
  const { login } = useAuth()
  const router    = useRouter()
  const [email, setEmail]       = useState('rdelacruz@ddnppo.gov.ph')
  const [password, setPassword] = useState('password')
  const [error, setError]       = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const success = login(email, password)
    if (!success) {
      setError('Invalid credentials. Use the demo credentials below.')
      return
    }
    // Redirect based on role
    const isAdmin = email === 'rdelacruz@ddnppo.gov.ph'
    router.push(isAdmin ? '/admin/master' : '/dashboard')
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left: Branding ── */}
      <div className="flex-1 login-gradient p-16 flex flex-col justify-center relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border-[80px] border-white/[0.04]" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full border-[60px] border-white/[0.04]" />

        <div className="relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-9">
            <div className="w-2 h-2 bg-yellow-400 rounded-full" />
            <span className="text-white text-xs font-semibold tracking-wide">Police Regional Office II - Davao Norte Police PRovincial Office</span>
          </div>

          <h1 className="font-display text-5xl text-white leading-tight mb-4">
            Records Management<br />System
          </h1>
          <p className="text-white/60 text-[15px] leading-relaxed mb-12 max-w-sm">
            Secure, centralized document management for Davao Del Norte
            Provincial Police Office.
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
      </div>

      {/* ── Right: Form ── */}
      <div className="w-[460px] bg-white px-14 flex flex-col justify-center">
        <h2 className="font-display text-3xl text-slate-800 mb-2">Sign In</h2>
        <p className="text-slate-500 text-sm mb-9">
          Access restricted to authorized DDNPPO personnel.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="yourname@ddnppo.gov.ph"
              className="w-full px-4 py-3 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-3 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white transition"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
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
          <a href="#" className="text-blue-600 font-medium hover:underline">
            Request access
          </a>
        </p>

        {/* Demo box */}
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
