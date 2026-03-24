'use client'
// components/modals/AddSpecialOrderModal.tsx
// ─────────────────────────────────────────────
// Modal form for creating a new Special Order.

import { useState } from 'react'
import { Modal }    from '@/components/ui/Modal'
import { Button }   from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import {MasterDocument} from '@/types'

type DocWithUrl = MasterDocument & { fileUrl?: string }

interface Props { open: boolean; onClose: () => void, onAdd?: (newSO:DocWithUrl
) => Promise<void> }

export function AddSpecialOrderModal({ open, onClose }: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState({ reference: '', subject: '', date: '', status: 'ACTIVE' })

  const field = (key: string, value: string) => setForm(p => ({ ...p, [key]: value }))

  function submit() {
    if (!form.reference || !form.subject || !form.date) {
      toast.error('Please fill in all required fields.')
      return
    }
    toast.success(`Special Order "${form.reference}" created.`)
    onClose()
    setForm({ reference: '', subject: '', date: '', status: 'ACTIVE' })
  }

  const cls = 'w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition'

  return (
    <Modal open={open} onClose={onClose} title="New Special Order" width="max-w-lg">
      <div className="p-6 space-y-4">

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              SO Reference <span className="text-red-500">*</span>
            </label>
            <input className={cls} placeholder="e.g. SO No. 2024-102"
              value={form.reference} onChange={e => field('reference', e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Date <span className="text-red-500">*</span>
            </label>
            <input type="date" className={cls}
              value={form.date} onChange={e => field('date', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Subject <span className="text-red-500">*</span>
          </label>
          <input className={cls} placeholder="e.g. Designation of Officers – Q2"
            value={form.subject} onChange={e => field('subject', e.target.value)} />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Status</label>
          <select className={cls} value={form.status} onChange={e => field('status', e.target.value)}>
            <option>ACTIVE</option>
            <option>ARCHIVED</option>
          </select>
        </div>

        {/* Attachment drop zone */}
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
          <div className="text-2xl mb-1.5">📎</div>
          <p className="text-sm font-medium text-slate-600 mb-0.5">Attach supporting documents</p>
          <p className="text-xs text-slate-400">PDF, DOCX — max 20 MB each</p>
        </div>

        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>✅ Create SO</Button>
        </div>
      </div>
    </Modal>
  )
}
