'use client'
// app/register/page.tsx
// Enhanced with Supabase Realtime — shows live submission status updates
// and notifies the applicant when their request is reviewed (approved/rejected).

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AccessRequestSchema, zodErrors } from '@/lib/validations'

type FormState = 'idle' | 'submitting' | 'success' | 'error'

type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

interface LiveUpdate {
  type: 'connected' | 'reviewed'
  status?: ReviewStatus
  rejectionReason?: string
  reviewedAt?: string
}

export default function RegisterPage() {
  const [formState, setFormState] = useState<FormState>('idle')
  const [errors, setErrors]       = useState<Record<string, string>>({})
  const [form, setForm] = useState({ fullName: '', email: '', contactNo: '' })
  const [submittedId, setSubmittedId]     = useState<string | null>(null)
  const [liveUpdate, setLiveUpdate]       = useState<LiveUpdate | null>(null)
  const [realtimeActive, setRealtimeActive] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Subscribe to realtime updates after successful submission ──
  useEffect(() => {
    if (!submittedId) return

    const channel = supabase
      .channel(`access_request_${submittedId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'access_requests',
          filter: `id=eq.${submittedId}`,
        },
        (payload) => {
          const updated = payload.new as {
            status: ReviewStatus
            rejection_reason?: string
            reviewed_at?: string
          }

          if (updated.status === 'APPROVED' || updated.status === 'REJECTED') {
            setLiveUpdate({
              type: 'reviewed',
              status: updated.status,
              rejectionReason: updated.rejection_reason ?? undefined,
              reviewedAt: updated.reviewed_at ?? undefined,
            })
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeActive(true)
          setLiveUpdate({ type: 'connected' })
        }
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeActive(false)
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
      setRealtimeActive(false)
    }
  }, [submittedId])

  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [k]: e.target.value }))
    setErrors(p => ({ ...p, [k]: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const result = AccessRequestSchema.safeParse(form)
    if (!result.success) {
      setErrors(zodErrors(result.error))
      return
    }
    setErrors({})
    setFormState('submitting')

    try {
      const newId = `req-${Date.now()}`
      const { error } = await supabase.from('access_requests').insert({
        id:           newId,
        full_name:    result.data.fullName.trim(),
        email:        result.data.email.trim().toLowerCase(),
        contact_no:   result.data.contactNo.trim(),
        status:       'PENDING',
        submitted_at: new Date().toISOString(),
      })
      if (error) throw error
      setSubmittedId(newId)
      setFormState('success')
    } catch {
      setFormState('error')
    }
  }

  const cls = (f: string) =>
    `w-full px-4 py-3 border-[1.5px] rounded-xl text-sm bg-slate-50 focus:outline-none focus:bg-white transition ${
      errors[f] ? 'border-red-400 focus:border-red-400' : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
    }`

  // ── Reviewed State ────────────────────────────────────────────────────────
  if (formState === 'success' && liveUpdate?.type === 'reviewed') {
    const approved = liveUpdate.status === 'APPROVED'
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 ${
              approved ? 'bg-emerald-100' : 'bg-red-100'
            }`}>
              {approved ? '🎉' : '🚫'}
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              {approved ? 'Access Approved!' : 'Request Rejected'}
            </h1>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              {approved
                ? 'Your access request has been approved by an administrator. You can now sign in to the system.'
                : 'Your access request was not approved at this time.'}
            </p>

            {!approved && liveUpdate.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-left">
                <p className="text-xs font-bold text-red-700 uppercase tracking-widest mb-1">Reason</p>
                <p className="text-sm text-red-700">{liveUpdate.rejectionReason}</p>
              </div>
            )}

            {liveUpdate.reviewedAt && (
              <p className="text-xs text-slate-400 mb-5">
                Reviewed on {new Date(liveUpdate.reviewedAt).toLocaleString('en-PH', {
                  year: 'numeric', month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}

            <div className="flex gap-3 justify-center">
              {approved ? (
                <Link href="/login"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-blue-700 transition">
                  → Sign In Now
                </Link>
              ) : (
                <button
                  onClick={() => {
                    setFormState('idle')
                    setLiveUpdate(null)
                    setSubmittedId(null)
                    setForm({ fullName: '', email: '', contactNo: '' })
                  }}
                  className="inline-flex items-center gap-2 bg-slate-600 text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-slate-700 transition"
                >
                  ← Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Pending / Success State ───────────────────────────────────────────────
  if (formState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">✅</div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Request Submitted!</h1>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              Your access request is now <strong className="text-amber-600">pending review</strong> by an administrator.
            </p>

            {/* ── Realtime status badge ── */}
            <div className={`flex items-center justify-center gap-2 mb-5 px-4 py-2.5 rounded-full text-xs font-semibold border transition-all ${
              realtimeActive
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              {realtimeActive ? (
                <>
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  Live — this page will update instantly when reviewed
                </>
              ) : (
                <>
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-spin border border-slate-400 border-t-transparent" />
                  Connecting to live updates…
                </>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 text-left">
              <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-300">
                ⏳ Pending Approval
              </span>
              <p className="text-xs text-amber-700 mt-2">Typical review time is 1–2 business days. You'll see the result here instantly once reviewed.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-6 text-left space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">What you submitted</p>
              <p className="text-sm text-slate-700"><span className="font-semibold">Name:</span> {form.fullName}</p>
              <p className="text-sm text-slate-700"><span className="font-semibold">Email:</span> {form.email}</p>
              <p className="text-sm text-slate-700"><span className="font-semibold">Contact:</span> {form.contactNo}</p>
            </div>

            <Link href="/login" className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-blue-700 transition">
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex">
      {/* Branding panel */}
      <div className="flex-1 login-gradient p-16 flex-col justify-center relative overflow-hidden hidden lg:flex">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border-[80px] border-white/[0.04]" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full border-[60px] border-white/[0.04]" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-9">
            <div className="w-2 h-2 bg-yellow-400 rounded-full" />
            <span className="text-white text-xs font-semibold tracking-wide">DDNPPO Records Management System</span>
          </div>
          <h1 className="font-display text-4xl text-white leading-tight mb-4">Request Access</h1>
          <p className="text-white/60 text-[15px] leading-relaxed mb-8 max-w-sm">
            Submit your information to request access. An administrator will review your request.
          </p>
          <ul className="space-y-3">
            {['Secure document management', 'Role-based access control', 'Full audit trail', 'Confidential document access'].map(f => (
              <li key={f} className="flex items-center gap-3 text-white/80 text-sm">
                <div className="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0" />{f}
              </li>
            ))}
          </ul>

          {/* Realtime feature callout */}
          <div className="mt-10 flex items-start gap-3 bg-white/10 border border-white/20 rounded-xl px-4 py-3">
            <span className="text-emerald-400 text-lg flex-shrink-0">⚡</span>
            <div>
              <p className="text-white text-xs font-semibold mb-0.5">Live Status Updates</p>
              <p className="text-white/60 text-xs leading-relaxed">
                After submitting, stay on the confirmation page — it will automatically update the moment an admin reviews your request.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="w-full lg:w-[480px] bg-white px-8 lg:px-14 py-12 flex flex-col justify-center">
        <div className="max-w-sm mx-auto w-full">
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-yellow-400 rounded-lg flex items-center justify-center">🛡️</div>
            <span className="text-sm font-bold text-slate-800">DDNPPO Records System</span>
          </div>
          <h2 className="font-display text-3xl text-slate-800 mb-1">Create Request</h2>
          <p className="text-slate-500 text-sm mb-8">Fill in your details to request system access.</p>

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
              <input type="text" className={cls('fullName')} placeholder="e.g. Ana Marie Santos"
                value={form.fullName} onChange={field('fullName')} disabled={formState === 'submitting'} />
              {errors.fullName && <p className="text-xs text-red-500 mt-1.5 font-medium">⚠ {errors.fullName}</p>}
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input type="email" className={cls('email')} placeholder="yourname@ddnppo.gov.ph"
                value={form.email} onChange={field('email')} disabled={formState === 'submitting'} />
              {errors.email && <p className="text-xs text-red-500 mt-1.5 font-medium">⚠ {errors.email}</p>}
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                Contact Number <span className="text-red-500">*</span>
              </label>
              <input type="tel" className={cls('contactNo')} placeholder="e.g. 09171234567"
                value={form.contactNo} onChange={field('contactNo')} disabled={formState === 'submitting'} />
              {errors.contactNo && <p className="text-xs text-red-500 mt-1.5 font-medium">⚠ {errors.contactNo}</p>}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800 flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5">ℹ️</span>
              <span>Your request will be reviewed by an administrator. You will not gain access until approved.</span>
            </div>

            <button type="submit" disabled={formState === 'submitting'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition text-[15px] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {formState === 'submitting'
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting…</>
                : '📨 Submit Request'}
            </button>
          </form>

          <p className="text-center mt-5 text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}