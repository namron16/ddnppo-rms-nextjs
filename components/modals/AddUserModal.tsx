'use client'
// components/modals/AddUserModal.tsx

import { useState } from 'react'
import { Modal }    from '@/components/ui/Modal'
import { Button }   from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { AddUserSchema, zodErrors } from '@/lib/validations'

interface Props { open: boolean; onClose: () => void }

export function AddUserModal({ open, onClose }: Props) {
  const { toast } = useToast()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', role: 'officer', rank: '', department: '',
  })

  const field = (key: string, value: string) => {
    setForm(p => ({ ...p, [key]: value }))
    setErrors(p => ({ ...p, [key]: '' }))
  }

  function submit() {
    const result = AddUserSchema.safeParse(form)
    if (!result.success) {
      setErrors(zodErrors(result.error))
      return
    }
    setErrors({})
    toast.success(`User "${result.data.firstName} ${result.data.lastName}" created. A temporary password has been sent.`)
    onClose()
    setForm({ firstName: '', lastName: '', email: '', role: 'officer', rank: '', department: '' })
  }

  const cls = (f: string) =>
    `w-full px-3 py-2.5 border-[1.5px] rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition ${
      errors[f] ? 'border-red-400 focus:border-red-400' : 'border-slate-200'
    }`

  return (
    <Modal open={open} onClose={onClose} title="Add New User" width="max-w-md">
      <div className="p-6 space-y-4">

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              First Name <span className="text-red-500">*</span>
            </label>
            <input className={cls('firstName')} placeholder="Ana"
              value={form.firstName} onChange={e => field('firstName', e.target.value)} />
            {errors.firstName && <p className="text-xs text-red-500 mt-1 font-medium">⚠ {errors.firstName}</p>}
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input className={cls('lastName')} placeholder="Santos"
              value={form.lastName} onChange={e => field('lastName', e.target.value)} />
            {errors.lastName && <p className="text-xs text-red-500 mt-1 font-medium">⚠ {errors.lastName}</p>}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Email <span className="text-red-500">*</span>
          </label>
          <input type="email" className={cls('email')} placeholder="yourname@ddnppo.gov.ph"
            value={form.email} onChange={e => field('email', e.target.value)} />
          {errors.email && <p className="text-xs text-red-500 mt-1 font-medium">⚠ {errors.email}</p>}
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Rank / Position</label>
          <input className={cls('rank')} placeholder="e.g. P/Maj., P/Insp., P/Col."
            value={form.rank} onChange={e => field('rank', e.target.value)} />
          {errors.rank && <p className="text-xs text-red-500 mt-1 font-medium">⚠ {errors.rank}</p>}
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">🏢 Department / Unit</label>
          <input className={cls('department')} placeholder="e.g. Operations, Intelligence, Administration"
            value={form.department} onChange={e => field('department', e.target.value)} />
          {errors.department && <p className="text-xs text-red-500 mt-1 font-medium">⚠ {errors.department}</p>}
          {form.department && (
            <div className="mt-2 inline-block px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-[11px] font-medium text-blue-700">
              📌 {form.department}
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">System Role</label>
          <select className={cls('role')} value={form.role} onChange={e => field('role', e.target.value)}>
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