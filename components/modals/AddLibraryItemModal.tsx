'use client'
// components/modals/AddLibraryItemModal.tsx
// ─────────────────────────────────────────────
// Modal form for adding a manual, guideline, or
// template to the Document Library.

import { useState } from 'react'
import { Modal }    from '@/components/ui/Modal'
import { Button }   from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

interface Props { open: boolean; onClose: () => void }

export function AddLibraryItemModal({ open, onClose }: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState({ title: '', category: 'MANUAL', description: '' })

  const field = (key: string, value: string) => setForm(p => ({ ...p, [key]: value }))

  function submit() {
    if (!form.title) {
      toast.error('Please enter a title.')
      return
    }
    toast.success(`"${form.title}" added to the Library.`)
    onClose()
    setForm({ title: '', category: 'MANUAL', description: '' })
  }

  const cls = 'w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition'

  return (
    <Modal open={open} onClose={onClose} title="Add to Library" width="max-w-md">
      <div className="p-6 space-y-4">

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Title <span className="text-red-500">*</span>
          </label>
          <input className={cls} placeholder="e.g. PNP Anti-Corruption Manual 2024"
            value={form.title} onChange={e => field('title', e.target.value)} />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Category</label>
          <select className={cls} value={form.category} onChange={e => field('category', e.target.value)}>
            <option>MANUAL</option>
            <option>GUIDELINE</option>
            <option>TEMPLATE</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Description</label>
          <textarea rows={3} className={`${cls} resize-none`}
            placeholder="Brief description of this library item…"
            value={form.description} onChange={e => field('description', e.target.value)} />
        </div>

        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
          <div className="text-2xl mb-1.5">📗</div>
          <p className="text-sm font-medium text-slate-600 mb-0.5">Upload file</p>
          <p className="text-xs text-slate-400">PDF, DOCX, XLSX — max 50 MB</p>
        </div>

        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>📚 Add to Library</Button>
        </div>
      </div>
    </Modal>
  )
}
