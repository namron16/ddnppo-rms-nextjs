'use client'
// components/modals/AddConfidentialDocModal.tsx
// ─────────────────────────────────────────────
// Modal form for adding a new confidential document
// with password protection settings.

import { useState } from 'react'
import { Modal }    from '@/components/ui/Modal'
import { Button }   from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

interface Props { open: boolean; onClose: () => void }

export function AddConfidentialDocModal({ open, onClose }: Props) {
  const { toast } = useToast()
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({
    title: '', classification: 'RESTRICTED', access: 'All w/ Password',
    date: '', password: '', confirmPassword: '',
  })

  const field = (key: string, value: string) => setForm(p => ({ ...p, [key]: value }))

  function submit() {
    if (!form.title || !form.date || !form.password) {
      toast.error('Please fill in all required fields.')
      return
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }
    toast.success(`Confidential document "${form.title}" added.`)
    onClose()
    setForm({ title: '', classification: 'RESTRICTED', access: 'All w/ Password', date: '', password: '', confirmPassword: '' })
  }

  const cls = 'w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition'

  return (
    <Modal open={open} onClose={onClose} title="Add Confidential Document" width="max-w-lg">
      <div className="p-6 space-y-4">

        {/* Warning */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
          <span className="flex-shrink-0">⚠️</span>
          Each confidential document requires its own unique password set by the administrator.
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Document Title <span className="text-red-500">*</span>
          </label>
          <input className={cls} placeholder="e.g. Intelligence Report Alpha-8"
            value={form.title} onChange={e => field('title', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Classification</label>
            <select className={cls} value={form.classification} onChange={e => field('classification', e.target.value)}>
              <option>RESTRICTED</option>
              <option>CONFIDENTIAL</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Date <span className="text-red-500">*</span></label>
            <input type="date" className={cls}
              value={form.date} onChange={e => field('date', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Access Level</label>
          <select className={cls} value={form.access} onChange={e => field('access', e.target.value)}>
            <option>All w/ Password</option>
            <option>Admin Only</option>
          </select>
        </div>

        {/* Password fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Document Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} className={`${cls} pr-10`}
                placeholder="Set document password"
                value={form.password} onChange={e => field('password', e.target.value)} />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
                {show ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Confirm Password <span className="text-red-500">*</span></label>
            <input type={show ? 'text' : 'password'} className={cls}
              placeholder="Repeat password"
              value={form.confirmPassword} onChange={e => field('confirmPassword', e.target.value)} />
          </div>
        </div>

        {/* File */}
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-red-400 hover:bg-red-50 transition">
          <div className="text-2xl mb-1.5">🔒</div>
          <p className="text-sm font-medium text-slate-600 mb-0.5">Attach confidential document</p>
          <p className="text-xs text-slate-400">File will be encrypted at rest</p>
        </div>

        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>🔒 Add & Encrypt</Button>
        </div>
      </div>
    </Modal>
  )
}
