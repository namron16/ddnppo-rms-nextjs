'use client'
// components/modals/AddConfidentialDocModal.tsx

import { useState, useRef } from 'react'
import { Modal }    from '@/components/ui/Modal'
import { Button }   from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import type { ConfidentialDoc } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onAdd?: (doc: ConfidentialDoc & { fileUrl?: string; passwordHash?: string }) => void
}

// Simple hash function using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data    = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray  = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export function AddConfidentialDocModal({ open, onClose, onAdd }: Props) {
  const { toast }    = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragging, setDragging]         = useState(false)
  const [uploading, setUploading]       = useState(false)
  const [show, setShow]                 = useState(false)
  const [form, setForm] = useState({
    title:           '',
    classification:  'RESTRICTED',
    access:          'All w/ Password',
    date:            '',
    password:        '',
    confirmPassword: '',
  })

  const field = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  function handleFileChange(file: File | null) {
    if (!file) return
    setSelectedFile(file)
  }

  async function submit() {
    if (!form.title)    { toast.error('Please enter a document title.'); return }
    if (!form.date)     { toast.error('Please select a date.'); return }
    if (!form.password) { toast.error('Please set a document password.'); return }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    setUploading(true)
    try {
      // Hash the password before storing
      const passwordHash = await hashPassword(form.password)

      let fileUrl: string | undefined

      if (selectedFile) {
        const fileName = `confidential-${Date.now()}-${selectedFile.name.replace(/\s+/g, '_')}`
        const { data: storageData, error: storageError } = await supabase.storage
          .from('documents')
          .upload(fileName, selectedFile, { cacheControl: '3600', upsert: false })

        if (storageError) {
          toast.error('File upload failed. Please try again.')
          setUploading(false)
          return
        }

        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(storageData.path)
        fileUrl = urlData.publicUrl
      }

      const newDoc: ConfidentialDoc & { fileUrl?: string; passwordHash: string } = {
        id:             `cd-${Date.now()}`,
        title:          form.title.trim(),
        classification: form.classification as 'RESTRICTED' | 'CONFIDENTIAL',
        date:           form.date,
        access:         form.access,
        fileUrl,
        passwordHash,
      }

      toast.success(`Confidential document "${form.title}" added.`)
      onAdd?.(newDoc)
      resetAndClose()
    } catch (err) {
      console.error(err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function resetAndClose() {
    setForm({ title: '', classification: 'RESTRICTED', access: 'All w/ Password', date: '', password: '', confirmPassword: '' })
    setSelectedFile(null)
    setShow(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  const cls = 'w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition'

  return (
    <Modal open={open} onClose={uploading ? () => {} : resetAndClose} title="Add Confidential Document" width="max-w-lg">
      <div className="p-6 space-y-4">

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
          <span className="flex-shrink-0">⚠️</span>
          Each confidential document requires its own unique password set by the administrator.
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Document Title <span className="text-red-500">*</span>
          </label>
          <input className={cls} placeholder="e.g. Intelligence Report Alpha-8"
            value={form.title} onChange={e => field('title', e.target.value)} disabled={uploading} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Classification</label>
            <select className={cls} value={form.classification}
              onChange={e => field('classification', e.target.value)} disabled={uploading}>
              <option value="RESTRICTED">Restricted</option>
              <option value="CONFIDENTIAL">Confidential</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Date <span className="text-red-500">*</span>
            </label>
            <input type="date" className={cls} value={form.date}
              onChange={e => field('date', e.target.value)} disabled={uploading} />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Access Level</label>
          <select className={cls} value={form.access}
            onChange={e => field('access', e.target.value)} disabled={uploading}>
            <option value="All w/ Password">All w/ Password</option>
            <option value="Admin Only">Admin Only</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Document Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} className={`${cls} pr-10`}
                placeholder="Set document password"
                value={form.password} onChange={e => field('password', e.target.value)}
                disabled={uploading} />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
                {show ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <input type={show ? 'text' : 'password'} className={cls}
              placeholder="Repeat password"
              value={form.confirmPassword} onChange={e => field('confirmPassword', e.target.value)}
              disabled={uploading} />
          </div>
        </div>

        {/* Hidden file input */}
        <input ref={fileInputRef} type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          className="hidden"
          onChange={e => handleFileChange(e.target.files?.[0] ?? null)} />

        {selectedFile ? (
          <div className="flex items-center justify-between px-4 py-3 bg-red-50 border-[1.5px] border-red-200 rounded-xl">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl flex-shrink-0">🔒</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{selectedFile.name}</p>
                <p className="text-xs text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            {!uploading && (
              <button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                className="text-slate-400 hover:text-red-500 font-bold text-sm transition ml-3 flex-shrink-0">✕</button>
            )}
          </div>
        ) : (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFileChange(e.dataTransfer.files?.[0] ?? null) }}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
              dragging ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-red-400 hover:bg-red-50'
            }`}
          >
            <div className="text-2xl mb-1.5">🔒</div>
            <p className="text-sm font-medium text-slate-600 mb-0.5">Attach confidential document</p>
            <p className="text-xs text-slate-400">File will be stored securely</p>
          </div>
        )}

        {uploading && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-700 font-medium">Uploading securely…</p>
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={resetAndClose} disabled={uploading}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={uploading}>
            {uploading ? 'Uploading…' : '🔒 Add & Encrypt'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}