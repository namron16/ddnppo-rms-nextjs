'use client'
// app/register/page.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type FormState = 'idle' | 'submitting' | 'success' | 'error'

export default function RegisterPage() {
  const router = useRouter()
  const [formState, setFormState] = useState<FormState>('idle')
  const [errors, setErrors]       = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    fullName:    '',
    email:       '',
    contactNo:   '',
  })

  function validate() {
    const e: Record<string, string> = {}
    if (!form.fullName.trim())   e.fullName  = 'Full name is required.'
    if (!form.email.trim())      e.email     = 'Email address is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                 e.email     = 'Please enter a valid email address.'
    if (!form.contactNo.trim())  e.contactNo = 'Contact number is required.'
    else if (!/^[\d\s\+\-\(\)]{7,20}$/.test(form.contactNo.trim()))
                                 e.contactNo = 'Please enter a valid contact number.'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setFormState('submitting')

    try {
      const { error } = await supabase.from('access_requests').insert({
        id:           `req-${Date.now()}`,
        full_name:    form.fullName.trim(),
        email:        form.email.trim().toLowerCase(),
        contact_no:   form.contactNo.trim(),
        status:       'PENDING',
        submitted_at: new Date().toISOString(),
      })
      if (error) throw error
      setFormState('success')
    } catch {
      setFormState('error')
    }
  }

  const cls = (field: string) =>
    `w-full px-4 py-3 border-[1.5px] rounded-xl text-sm bg-slate-50 focus:outline-none focus:bg-white transition ${
      errors[field]
        ? 'border-red-400 focus:border-red-400'
        : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
    }`

  if (formState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
              ✅
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Request Submitted!</h1>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              Your access request has been received and is now <strong className="text-amber-600">pending review</strong> by an administrator.
              You will be notified once your request is approved.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 text-left">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-amber-700">Status</span>
              </div>
              <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-300">
                ⏳ Pending Approval
              </span>
              <p className="text-xs text-amber-700 mt-2 leading-relaxed">
                Typical review time is 1–2 business days. Please check your email for updates.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-6 text-left space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">What you submitted</p>
              <p className="text-sm text-slate-700"><span className="font-semibold">Name:</span> {form.fullName}</p>
              <p className="text-sm text-slate-700"><span className="font-semibold">Email:</span> {form.email}</p>
              <p className="text-sm text-slate-700"><span className="font-semibold">Contact:</span> {form.contactNo}</p>
            </div>

            <Link href="/login"
              className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-blue-700 transition">
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="flex-1 login-gradient p-16 flex flex-col justify-center relative overflow-hidden hidden lg:flex">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border-[80px] border-white/[0.04]" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full border-[60px] border-white/[0.04]" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-9">
            <div className="w-2 h-2 bg-yellow-400 rounded-full" />
            <span className="text-white text-xs font-semibold tracking-wide">DDNPPO Records Management System</span>
          </div>
          <h1 className="font-display text-4xl text-white leading-tight mb-4">
            Request Access
          </h1>
          <p className="text-white/60 text-[15px] leading-relaxed mb-8 max-w-sm">
            Submit your information below to request access to the DDNPPO Records Management System. An administrator will review your request.
          </p>
          <ul className="space-y-3">
            {[
              'Secure document management',
              'Role-based access control',
              'Full audit trail',
              'Confidential document access',
            ].map(f => (
              <li key={f} className="flex items-center gap-3 text-white/80 text-sm">
                <div className="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full lg:w-[480px] bg-white px-8 lg:px-14 py-12 flex flex-col justify-center">
        <div className="max-w-sm mx-auto w-full">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-yellow-400 rounded-lg flex items-center justify-center">🛡️</div>
            <span className="text-sm font-bold text-slate-800">DDNPPO Records System</span>
          </div>

          <h2 className="font-display text-3xl text-slate-800 mb-1">Create Request</h2>
          <p className="text-slate-500 text-sm mb-8">
            Fill in your details to request system access.
          </p>

          {formState === 'error' && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5">❌</span>
              <span>Something went wrong. Please try again or contact your administrator.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={cls('fullName')}
                placeholder="e.g. Ana Marie Santos"
                value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                disabled={formState === 'submitting'}
              />
              {errors.fullName && <p className="text-xs text-red-500 mt-1.5 font-medium">⚠ {errors.fullName}</p>}
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                className={cls('email')}
                placeholder="yourname@ddnppo.gov.ph"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                disabled={formState === 'submitting'}
              />
              {errors.email && <p className="text-xs text-red-500 mt-1.5 font-medium">⚠ {errors.email}</p>}
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                Contact Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                className={cls('contactNo')}
                placeholder="e.g. 09171234567"
                value={form.contactNo}
                onChange={e => setForm(f => ({ ...f, contactNo: e.target.value }))}
                disabled={formState === 'submitting'}
              />
              {errors.contactNo && <p className="text-xs text-red-500 mt-1.5 font-medium">⚠ {errors.contactNo}</p>}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800 flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5">ℹ️</span>
              <span>Your request will be reviewed by an administrator. You will not gain access until approved.</span>
            </div>

            <button
              type="submit"
              disabled={formState === 'submitting'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition text-[15px] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {formState === 'submitting' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting…
                </>
              ) : (
                '📨 Submit Request'
              )}
            </button>
          </form>

          <p className="text-center mt-5 text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}