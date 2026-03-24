'use client'
// components/modals/AddDocumentModal.tsx
// ─────────────────────────────────────────────
// Modal form for uploading / adding a new master document.
// Used on the Master Documents admin page.

import { useState } from 'react'
import { Modal }  from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { MasterDocument } from '@/types'
import { SpecialOrder } from '@/types'

type SOWithUrl = SpecialOrder & { fileUrl?: string }


interface AddDocumentModalProps {
  open: boolean
  onClose: () => void,
  onAdd?:(newSO: SOWithUrl) => Promise<void>,

}

export function AddDocumentModal({ open, onClose, onAdd }: AddDocumentModalProps) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    title: '',
    level: 'REGIONAL',
    type: 'PDF',
    date: '',
    tag: 'COMPLIANCE',
  })

  function handleChange(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleSubmit() {
    if (!form.title || !form.date) {
      toast.error('Please fill in all required fields.')
      return
    }
    // In production: POST to API
    toast.success(`"${form.title}" uploaded successfully.`)
    onClose()
    setForm({ title: '', level: 'REGIONAL', type: 'PDF', date: '', tag: 'COMPLIANCE' })
  }

  const selectClass = 'w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition'
  const inputClass  = selectClass

  return (
    <Modal open={open} onClose={onClose} title="Upload Document" width="max-w-lg">
      <div className="p-6 space-y-4">

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Document Title <span className="text-red-500">*</span>
          </label>
          <input
            className={inputClass}
            value={form.title}
            onChange={e => handleChange('title', e.target.value)}
            placeholder="e.g. RO XI General Circular No. 2024-08"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Level</label>
            <select className={selectClass} value={form.level} onChange={e => handleChange('level', e.target.value)}>
              <option>REGIONAL</option>
              <option>PROVINCIAL</option>
              <option>STATION</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Tag</label>
            <select className={selectClass} value={form.tag} onChange={e => handleChange('tag', e.target.value)}>
              <option>COMPLIANCE</option>
              <option>DIRECTIVE</option>
              <option>CIRCULAR</option>
              <option>MEMORANDUM</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Document Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className={inputClass}
              value={form.date}
              onChange={e => handleChange('date', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">File Type</label>
            <select className={selectClass} value={form.type} onChange={e => handleChange('type', e.target.value)}>
              <option>PDF</option>
              <option>DOCX</option>
              <option>XLSX</option>
              <option>Image</option>
            </select>
          </div>
        </div>

        {/* File drop zone */}
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
          <div className="text-3xl mb-2">📁</div>
          <p className="text-sm font-medium text-slate-600 mb-1">Click to browse or drag & drop</p>
          <p className="text-xs text-slate-400">PDF, DOCX, XLSX, JPG — max 50 MB</p>
        </div>

        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit}>📤 Upload</Button>
        </div>
      </div>
    </Modal>
  )
}
