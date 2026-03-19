'use client'
// components/modals/AddUserModal.tsx
// ─────────────────────────────────────────────
// Modal form for creating a new system user
// (Admin or Officer role).

import { useState } from 'react'
import { Modal }    from '@/components/ui/Modal'
import { Button }   from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

interface Props { open: boolean; onClose: () => void }

export function AddUserModal({ open, onClose }: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', role: 'officer', rank: '',
  })

  const field = (key: string, value: string) => setForm(p => ({ ...p, [key]: value }))

  function submit() {
    if (!form.firstName || !form.lastName || !form.email) {
      toast.error('Please fill in all required fields.')
      return
    }
    if (!form.email.endsWith('@ddnppo.gov.ph')) {
      toast.error('Email must use the @ddnppo.gov.ph domain.')
      return
    }
    toast.success(`User "${form.firstName} ${form.lastName}" created. A temporary password has been sent.`)
    onClose()
    setForm({ firstName: '', lastName: '', email: '', role: 'officer', rank: '' })
  }

  const cls = 'w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition'

  return (
    <Modal open={open} onClose={onClose} title="Add New User" width="max-w-md">
      <div className="p-6 space-y-4">

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              First Name <span className="text-red-500">*</span>
            </label>
            <input className={cls} placeholder="Ana"
              value={form.firstName} onChange={e => field('firstName', e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input className={cls} placeholder="Santos"
              value={form.lastName} onChange={e => field('lastName', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Email <span className="text-red-500">*</span>
          </label>
          <input type="email" className={cls} placeholder="yourname@ddnppo.gov.ph"
            value={form.email} onChange={e => field('email', e.target.value)} />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Rank / Position</label>
          <input className={cls} placeholder="e.g. P/Maj., P/Insp., P/Col."
            value={form.rank} onChange={e => field('rank', e.target.value)} />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">System Role</label>
          <select className={cls} value={form.role} onChange={e => field('role', e.target.value)}>
            <option value="officer">Officer (read + forward)</option>
            <option value="admin">Administrator (full access)</option>
          </select>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          A temporary password will be sent to the user's email. They will be prompted to change it on first login.
        </p>

        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>👤 Create User</Button>
        </div>
      </div>
    </Modal>
  )
}
