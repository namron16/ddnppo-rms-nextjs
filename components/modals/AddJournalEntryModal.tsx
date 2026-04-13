'use client'
// components/modals/AddJournalEntryModal.tsx

import { useEffect, useState } from 'react'
import { Modal }    from '@/components/ui/Modal'
import { Button }   from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { AddJournalEntrySchema, zodErrors, type AddJournalEntryInput } from '@/lib/validations'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  submitLabel?: string
  initialValue?: Partial<AddJournalEntryInput> & { content?: string }
  onSubmit?: (entry: AddJournalEntryInput) => void | Promise<void>
}

const EMPTY_FORM = { title: '', type: 'MEMO' as const, author: '', date: '', content: '' }

export function AddJournalEntryModal({
  open,
  onClose,
  title = 'New Journal Entry',
  submitLabel = '✅ Create Entry',
  initialValue,
  onSubmit,
}: Props) {
  const { toast } = useToast()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm({
      title: initialValue?.title ?? '',
      type: initialValue?.type ?? 'MEMO',
      author: initialValue?.author ?? '',
      date: initialValue?.date ?? '',
      content: initialValue?.content ?? '',
    })
  }, [initialValue, open])

  const field = (key: string, value: string) => {
    setForm(p => ({ ...p, [key]: value }))
    setErrors(p => ({ ...p, [key]: '' }))
  }

  async function submit() {
    const result = AddJournalEntrySchema.safeParse(form)
    if (!result.success) {
      setErrors(zodErrors(result.error))
      return
    }
    setErrors({})
    await onSubmit?.(result.data)
    toast.success(`Journal entry "${result.data.title}" saved.`)
    onClose()
    setForm(EMPTY_FORM)
  }

  const cls = (f: string) =>
    `w-full px-3 py-2.5 border-[1.5px] rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition ${
      errors[f] ? 'border-red-400 focus:border-red-400' : 'border-slate-200'
    }`

  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-lg">
      <div className="p-6 space-y-4">

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Title <span className="text-red-500">*</span>
          </label>
          <input className={cls('title')} placeholder="e.g. Daily Operations Update – 16 Mar"
            value={form.title} onChange={e => field('title', e.target.value)} />
          {errors.title && <p className="text-xs text-red-500 mt-1 font-medium">⚠ {errors.title}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Type</label>
            <select className={cls('type')} value={form.type} onChange={e => field('type', e.target.value)}>
              <option>MEMO</option><option>REPORT</option><option>LOG</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Date <span className="text-red-500">*</span>
            </label>
            <input type="date" className={cls('date')} value={form.date} onChange={e => field('date', e.target.value)} />
            {errors.date && <p className="text-xs text-red-500 mt-1 font-medium">⚠ {errors.date}</p>}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Author <span className="text-red-500">*</span>
          </label>
          <input className={cls('author')} placeholder="e.g. P/Col. Dela Cruz"
            value={form.author} onChange={e => field('author', e.target.value)} />
          {errors.author && <p className="text-xs text-red-500 mt-1 font-medium">⚠ {errors.author}</p>}
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Content</label>
          <textarea rows={4} className={`${cls('content')} resize-none`}
            placeholder="Enter the full content of this journal entry…"
            value={form.content} onChange={e => field('content', e.target.value)} />
          {errors.content && <p className="text-xs text-red-500 mt-1 font-medium">⚠ {errors.content}</p>}
        </div>

        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>{submitLabel}</Button>
        </div>
      </div>
    </Modal>
  )
}