'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { P1InboxItemKind } from '@/lib/p1Inbox'

interface ForwardTargetSummary {
  senderRole: string
  title: string
  fileName: string
  fileSize: string
  fileType: string
  itemKind: P1InboxItemKind
}

interface ForwardToP1InboxModalProps {
  open: boolean
  target: ForwardTargetSummary | null
  onClose: () => void
  onSubmit: (notes: string) => Promise<void>
}

export function ForwardToP1InboxModal({ open, target, onClose, onSubmit }: ForwardToP1InboxModalProps) {
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setNotes('')
    setSubmitting(false)
  }, [open, target])

  if (!target) return null

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await onSubmit(notes.trim())
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = 'w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition'

  return (
    <Modal open={open} onClose={submitting ? () => {} : onClose} title="Forward to P1 Inbox" width="max-w-lg">
      <div className="p-6 space-y-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-700 mb-1">Destination</p>
          <p className="text-sm font-bold text-slate-800">P1 - Super Admin / Records Officer inbox</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Source</p>
            <p className="text-sm font-semibold text-slate-800">{target.senderRole}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Item Type</p>
            <p className="text-sm font-semibold text-slate-800 capitalize">{target.itemKind}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Title</p>
          <p className="text-sm font-bold text-slate-800">{target.title}</p>
          <p className="text-xs text-slate-500 truncate">{target.fileName} · {target.fileSize} · {target.fileType}</p>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Notes</label>
          <textarea
            rows={3}
            className={inputClass + ' resize-none'}
            placeholder="Optional note for P1"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Forwarding…' : 'Forward to Inbox'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ForwardToP1InboxModal