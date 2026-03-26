'use client'
// app/admin/personnel/page.tsx

import { useState, useMemo, useEffect, useRef } from 'react'
import { PageHeader }   from '@/components/ui/PageHeader'
import { Badge }        from '@/components/ui/Badge'
import { Button }       from '@/components/ui/Button'
import { Avatar }       from '@/components/ui/Avatar'
import { SearchInput }  from '@/components/ui/SearchInput'
import { EmptyState }   from '@/components/ui/EmptyState'
import { Modal }        from '@/components/ui/Modal'
import { useToast }     from '@/components/ui/Toast'
import { useSearch, useModal, useDisclosure } from '@/hooks'
import {
  createPersonnel201,
  updateDoc201Status,
  uploadDoc201File,
  CATEGORY_LABELS,
} from '@/lib/data201'
import { status201BadgeClass, status201Icon, formatDate } from '@/lib/utils'
import type { Personnel201, Doc201Item, Doc201Status } from '@/types'
import { supabase } from '@/lib/supabase'

// ── Extended type with photoUrl ───────────────
type Personnel201Extended = Personnel201 & { photoUrl?: string }

// ── Helpers ───────────────────────────────────
function completionPercent(docs: Doc201Item[]) {
  if (docs.length === 0) return 0
  return Math.round((docs.filter(d => d.status === 'COMPLETE').length / docs.length) * 100)
}
function completionColor(pct: number) {
  if (pct >= 90) return 'bg-emerald-500'
  if (pct >= 60) return 'bg-amber-400'
  return 'bg-red-500'
}

const STATUS_FILTERS: Array<{ label: string; value: Doc201Status | 'ALL' }> = [
  { label: 'All',           value: 'ALL' },
  { label: '✅ Complete',   value: 'COMPLETE' },
  { label: '🔄 For Update', value: 'FOR_UPDATE' },
  { label: '⚠️ Expired',   value: 'EXPIRED' },
  { label: '❌ Missing',    value: 'MISSING' },
]

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// ── Inline Document Viewer Modal ──────────────
function DocViewerModal({ url, title, open, onClose }: {
  url: string | null
  title: string
  open: boolean
  onClose: () => void
}) {
  if (!url) return null
  const isPDF   = !!url.match(/\.pdf(\?|$)/i) || url.includes('pdf')
  const isImage = !!url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)
  const isDocx  = !!url.match(/\.docx?(\?|$)/i)
  const isXlsx  = !!url.match(/\.xlsx?(\?|$)/i)

  return (
    <Modal open={open} onClose={onClose} title={`📄 ${title}`} width="max-w-5xl">
      <div className="flex flex-col" style={{ height: '80vh' }}>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          <span className="text-xs text-slate-500 flex-1 truncate">{url}</span>
          <a href={url} download target="_blank" rel="noopener noreferrer"
            className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-medium transition">
            ⬇ Download
          </a>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-medium transition">
            🔗 Open in tab
          </a>
          <Button variant="outline" size="sm" onClick={onClose}>✕ Close</Button>
        </div>
        <div className="flex-1 overflow-hidden bg-slate-100">
          {isPDF ? (
            <iframe src={url} className="w-full h-full border-0" title={title} />
          ) : isImage ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img src={url} alt={title} className="max-w-full max-h-full object-contain rounded-lg shadow" />
            </div>
          ) : (isDocx || isXlsx) ? (
            <iframe
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
              className="w-full h-full border-0" title={title}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
              <span className="text-6xl mb-4">📄</span>
              <p className="text-slate-600 font-semibold mb-2">Preview not available for this file type</p>
              <p className="text-slate-400 text-sm mb-6">Download the file to view its contents</p>
              <a href={url} download
                className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-700 transition">
                ⬇ Download to view
              </a>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ── Upload Doc Modal ──────────────────────────
function UploadDocModal({ item, personName, open, onClose, onDone }: {
  item: (Doc201Item & { fileUrl?: string }) | null
  personName: string
  open: boolean
  onClose: () => void
  onDone: (docId: string, fileUrl: string, fileSize: string) => void
}) {
  const { toast }    = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile]           = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  function handleClose() {
    if (uploading) return
    setFile(null)
    onClose()
  }

  async function submit() {
    if (!file || !item) { toast.error('Please select a file.'); return }
    setUploading(true)
    const url = await uploadDoc201File(item.id, file, 'Admin')
    if (url) {
      const size = (file.size / 1024 / 1024).toFixed(1) + ' MB'
      toast.success(`"${item.label}" uploaded — status set to Complete.`)
      onDone(item.id, url, size)
      setFile(null)
      onClose()
    } else {
      toast.error('Upload failed. Please try again.')
    }
    setUploading(false)
  }

  const isReupload = item?.status === 'EXPIRED' || item?.status === 'FOR_UPDATE'

  return (
    <Modal open={open} onClose={handleClose} title="Upload Document" width="max-w-md">
      <div className="p-6 space-y-4">
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Document</p>
          <p className="text-sm font-semibold text-slate-800">{item?.label}</p>
          {item?.sublabel && <p className="text-xs text-slate-400 mt-0.5">{item.sublabel}</p>}
          <p className="text-xs text-slate-400 mt-1">For: {personName}</p>
        </div>

        {isReupload && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <span className="text-amber-500 text-sm">⚠️</span>
            <p className="text-xs text-amber-800 font-medium">
              {item?.status === 'EXPIRED'
                ? 'This document is expired. Upload a new version to mark it as complete.'
                : 'This document needs an update. Upload a new version to mark it as complete.'}
            </p>
          </div>
        )}

        <input ref={fileInputRef} type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          className="hidden"
          onChange={e => setFile(e.target.files?.[0] ?? null)} />

        {file ? (
          <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-[1.5px] border-blue-200 rounded-xl">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl flex-shrink-0">
                {file.name.endsWith('.pdf') ? '📕' : file.name.match(/\.docx?$/) ? '📘' : file.name.match(/\.xlsx?$/) ? '📗' : '🖼️'}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            {!uploading && (
              <button onClick={() => setFile(null)}
                className="text-slate-400 hover:text-red-500 font-bold text-sm ml-3 flex-shrink-0">✕</button>
            )}
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files?.[0] ?? null) }}
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
            <div className="text-3xl mb-2">📎</div>
            <p className="text-sm font-medium text-slate-600 mb-1">Click to browse or drag & drop</p>
            <p className="text-xs text-slate-400">PDF, DOCX, JPG — max 50 MB</p>
          </div>
        )}

        {uploading && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-700 font-medium">Uploading to cloud storage…</p>
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={handleClose} disabled={uploading}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={uploading || !file}>
            {uploading ? 'Uploading…' : '📤 Upload'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Edit Profile Modal ────────────────────────
function EditProfileModal({ person, open, onClose, onSave }: {
  person: Personnel201Extended | null
  open: boolean
  onClose: () => void
  onSave: (updates: Partial<Personnel201Extended>) => void
}) {
  const { toast }  = useToast()
  const photoRef   = useRef<HTMLInputElement>(null)
  const [saving, setSaving]             = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [photoFile, setPhotoFile]       = useState<File | null>(null)
  const [form, setForm] = useState({
    name: '', rank: '', unit: '', address: '', contactNo: '', status: '',
    firearmSerialNo: '', pagIbigNo: '', philHealthNo: '', tin: '',
  })

  useEffect(() => {
    if (person && open) {
      setForm({
        name:            person.name            ?? '',
        rank:            person.rank            ?? '',
        unit:            person.unit            ?? '',
        address:         person.address         ?? '',
        contactNo:       person.contactNo       ?? '',
        status:          person.status          ?? 'Active',
        firearmSerialNo: person.firearmSerialNo ?? '',
        pagIbigNo:       person.pagIbigNo       ?? '',
        philHealthNo:    person.philHealthNo    ?? '',
        tin:             person.tin             ?? '',
      })
      setPhotoPreview(person.photoUrl ?? '')
      setPhotoFile(null)
    }
  }, [person, open])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function uploadPhoto(file: File): Promise<string | null> {
    try {
      const fileName = `profile-photos/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
      const { data, error } = await supabase.storage
        .from('documents').upload(fileName, file, { cacheControl: '3600', upsert: false })
      if (error) return null
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(data.path)
      return urlData.publicUrl
    } catch { return null }
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required.'); return }
    setSaving(true)

    let photoUrl: string | undefined = person?.photoUrl
    if (photoFile) {
      const url = await uploadPhoto(photoFile)
      if (url) photoUrl = url
    } else if (!photoPreview) {
      photoUrl = undefined
    }

    try {
      await supabase.from('personnel_201').update({
        name: form.name.trim(), rank: form.rank.trim(), unit: form.unit.trim(),
        address: form.address.trim() || null, contact_no: form.contactNo.trim() || null,
        status: form.status || 'Active', firearm_serial_no: form.firearmSerialNo.trim() || null,
        pag_ibig_no: form.pagIbigNo.trim() || null, phil_health_no: form.philHealthNo.trim() || null,
        tin: form.tin.trim() || null, photo_url: photoUrl ?? null,
        last_updated: new Date().toISOString().split('T')[0],
      }).eq('id', person?.id ?? '')
    } catch {}

    onSave({
      name: form.name.trim(), rank: form.rank.trim(), unit: form.unit.trim(),
      address: form.address.trim() || undefined, contactNo: form.contactNo.trim() || undefined,
      status: form.status || 'Active',
      firearmSerialNo: form.firearmSerialNo.trim() || undefined,
      pagIbigNo: form.pagIbigNo.trim() || undefined,
      philHealthNo: form.philHealthNo.trim() || undefined,
      tin: form.tin.trim() || undefined, photoUrl,
      initials: form.name.trim().split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
    })

    toast.success('Profile updated successfully.')
    setSaving(false)
    onClose()
  }

  const cls = 'w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition'
  if (!person) return null

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose} title="Edit Personnel Profile" width="max-w-2xl">
      <div className="p-6 space-y-5">

        {/* Photo */}
        <div className="flex items-center gap-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div
            onClick={() => !saving && photoRef.current?.click()}
            className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 cursor-pointer overflow-hidden flex items-center justify-center transition relative group flex-shrink-0"
            style={{ background: !photoPreview ? (person.avatarColor + '22') : undefined }}
          >
            {photoPreview ? (
              <>
                <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition rounded-xl">
                  <span className="text-white text-[10px] font-semibold">Change</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl">📷</span>
                <span className="text-[9px] text-slate-400 font-medium">Upload</span>
              </div>
            )}
          </div>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={saving} />
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-0.5">Profile Photo</p>
            <p className="text-xs text-slate-400 mb-3">Upload a 2×2 ID photo in GOA Type A Uniform</p>
            <div className="flex gap-2">
              <button onClick={() => !saving && photoRef.current?.click()}
                className="text-xs text-blue-600 hover:underline font-medium" disabled={saving}>
                {photoPreview ? '📷 Change photo' : '📷 Upload photo'}
              </button>
              {photoPreview && (
                <button onClick={() => { setPhotoPreview(''); setPhotoFile(null) }}
                  className="text-xs text-red-500 hover:underline" disabled={saving}>Remove</button>
              )}
            </div>
          </div>
        </div>

        {/* Personal Info */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Personal Information</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input className={cls} placeholder="e.g. Juan Dela Cruz"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} disabled={saving} />
              <p className="text-[10px] text-slate-400 mt-1">Include updated name if recently married</p>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Rank</label>
              <select className={cls} value={form.rank} onChange={e => setForm(f => ({ ...f, rank: e.target.value }))} disabled={saving}>
                <option value="">Select…</option>
                {['P/Col.','P/Lt. Col.','P/Maj.','P/Capt.','P/Lt.','P/Insp.','PSMS','PMMS','PEMS','PNCOP'].map(r => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Unit / Assignment</label>
            <input className={cls} placeholder="e.g. DDNPPO HQ"
              value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} disabled={saving} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Status</label>
            <select className={cls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} disabled={saving}>
              {['Active','On Leave','Transferred','Retired','AWOL'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Contact No.</label>
            <input className={cls} placeholder="e.g. 09171234567"
              value={form.contactNo} onChange={e => setForm(f => ({ ...f, contactNo: e.target.value }))} disabled={saving} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Address</label>
            <input className={cls} placeholder="City, Province"
              value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} disabled={saving} />
          </div>
        </div>

        {/* Government IDs */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Government IDs</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Firearm Serial No.', key: 'firearmSerialNo', placeholder: 'GL-2024-00412' },
              { label: 'Pag-IBIG No.',       key: 'pagIbigNo',       placeholder: '1234-5678-9012' },
              { label: 'PhilHealth No.',     key: 'philHealthNo',    placeholder: '09-123456789-0' },
              { label: 'TIN',               key: 'tin',             placeholder: '123-456-789-000' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">{field.label}</label>
                <input className={cls} placeholder={field.placeholder}
                  value={(form as any)[field.key]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  disabled={saving} />
              </div>
            ))}
          </div>
        </div>

        {saving && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-700 font-medium">Saving changes…</p>
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-1 border-t border-slate-100">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : '💾 Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Checklist Row ─────────────────────────────
// Actions: Upload (always) + View (when file exists)
function ChecklistRow({ item, index, onUpload, onView }: {
  item: Doc201Item & { fileUrl?: string }
  index: number
  onUpload: (item: Doc201Item & { fileUrl?: string }) => void
  onView:   (item: Doc201Item & { fileUrl?: string }) => void
}) {
  const hasFile = !!(item as any).fileUrl

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/80 transition">
      <td className="px-3 py-2.5 text-center">
        <span className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 text-slate-500 text-[11px] font-bold rounded-full">
          {LETTERS[index]}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="font-semibold text-[12.5px] text-slate-800 leading-snug">{item.label}</div>
        {item.sublabel && <div className="text-[11px] text-slate-400 mt-0.5">{item.sublabel}</div>}
        {item.remarks  && <div className="text-[11px] text-amber-600 mt-1 font-medium">⚠ {item.remarks}</div>}
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-500">{CATEGORY_LABELS[item.category]}</td>
      <td className="px-3 py-2.5">
        <Badge className={status201BadgeClass(item.status)}>
          {status201Icon(item.status)} {item.status.replace('_', ' ')}
        </Badge>
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
        {item.dateUpdated ? formatDate(item.dateUpdated) : <span className="text-red-400">Not filed</span>}
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-400">{item.filedBy ?? '—'}</td>
      <td className="px-3 py-2.5 text-xs text-slate-400">{item.fileSize ?? '—'}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {/* Upload — always visible */}
          <button
            onClick={() => onUpload(item)}
            className="text-[10px] font-semibold px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition whitespace-nowrap"
          >
            📎 {hasFile ? 'Re-upload' : 'Upload'}
          </button>
          {/* View — only when file exists */}
          {hasFile && (
            <button
              onClick={() => onView(item)}
              className="text-[10px] font-semibold px-2 py-1 bg-violet-50 text-violet-700 border border-violet-200 rounded-md hover:bg-violet-100 transition"
            >
              👁 View
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Personnel Card ────────────────────────────
function PersonnelCard({ person, onClick }: { person: Personnel201Extended; onClick: () => void }) {
  const pct       = completionPercent(person.documents)
  const complete  = person.documents.filter(d => d.status === 'COMPLETE').length
  const missing   = person.documents.filter(d => d.status === 'MISSING').length
  const forUpdate = person.documents.filter(d => d.status === 'FOR_UPDATE').length
  const expired   = person.documents.filter(d => d.status === 'EXPIRED').length

  return (
    <button onClick={onClick}
      className="w-full text-left bg-white border-[1.5px] border-slate-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition-all duration-200">
      <div className="flex items-start gap-3 mb-4">
        {person.photoUrl ? (
          <img src={person.photoUrl} alt={person.name}
            className="w-11 h-11 rounded-full object-cover border-2 border-white shadow flex-shrink-0" />
        ) : (
          <Avatar initials={person.initials} color={person.avatarColor} size="lg" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-800 text-[15px] leading-tight truncate">
            {person.rank} {person.name}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{person.serialNo} · {person.unit}</div>
          <div className="text-xs text-slate-400 mt-0.5">Updated: {formatDate(person.lastUpdated)}</div>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${
          pct === 100 ? 'bg-emerald-100 text-emerald-700'
          : pct >= 60 ? 'bg-amber-100 text-amber-700'
          : 'bg-red-100 text-red-700'
        }`}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div className={`h-full rounded-full transition-all ${completionColor(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">✅ {complete}</span>
        {missing   > 0 && <span className="text-[11px] font-medium text-red-700    bg-red-50    px-2 py-0.5 rounded-full">❌ {missing}</span>}
        {forUpdate > 0 && <span className="text-[11px] font-medium text-amber-700  bg-amber-50  px-2 py-0.5 rounded-full">🔄 {forUpdate}</span>}
        {expired   > 0 && <span className="text-[11px] font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">⚠️ {expired}</span>}
        <span className="text-[11px] text-slate-400 ml-auto">{person.documents.length} items</span>
      </div>
    </button>
  )
}

// ── 201 Checklist Modal ───────────────────────
function Checklist201Modal({ person, onClose, onUpdate, onProfileUpdate }: {
  person: Personnel201Extended | null
  onClose: () => void
  onUpdate: (personId: string, docId: string, status: Doc201Status, fileUrl?: string, fileSize?: string) => void
  onProfileUpdate: (personId: string, updates: Partial<Personnel201Extended>) => void
}) {
  const { toast }   = useToast()
  const [statusFilter, setStatusFilter] = useState<Doc201Status | 'ALL'>('ALL')
  const [catFilter,    setCatFilter]    = useState('ALL')
  const [docQuery,     setDocQuery]     = useState('')
  const [showEditProfile, setShowEditProfile] = useState(false)

  const [viewerUrl,   setViewerUrl]   = useState<string | null>(null)
  const [viewerTitle, setViewerTitle] = useState('')
  const [viewerOpen,  setViewerOpen]  = useState(false)

  const uploadDisc = useDisclosure<Doc201Item & { fileUrl?: string }>()

  const docs = useMemo(() => {
    if (!person) return []
    return person.documents.filter(d => {
      const okStatus = statusFilter === 'ALL' || d.status === statusFilter
      const okCat    = catFilter    === 'ALL' || d.category === catFilter
      const okSearch = !docQuery || d.label.toLowerCase().includes(docQuery.toLowerCase())
      return okStatus && okCat && okSearch
    })
  }, [person, statusFilter, catFilter, docQuery])

  if (!person) return null

  const pct       = completionPercent(person.documents)
  const complete  = person.documents.filter(d => d.status === 'COMPLETE').length
  const missing   = person.documents.filter(d => d.status === 'MISSING').length
  const forUpdate = person.documents.filter(d => d.status === 'FOR_UPDATE').length
  const expired   = person.documents.filter(d => d.status === 'EXPIRED').length

  function handleViewDoc(item: Doc201Item & { fileUrl?: string }) {
    const url = (item as any).fileUrl
    if (url) { setViewerUrl(url); setViewerTitle(item.label); setViewerOpen(true) }
  }

  return (
    <>
      <Modal open={!!person} onClose={onClose} title="Police Personal File" width="max-w-5xl">

        {/* ── Profile Header ── */}
        <div className="border-b border-slate-200">
          <div className="bg-[#0f1c35] px-6 py-5 flex items-stretch gap-5 relative">

            {/* Edit Profile button — top right */}
            <button
              onClick={() => setShowEditProfile(true)}
              className="absolute top-3 right-4 flex items-center gap-1.5 text-[11px] font-semibold text-white/60 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 px-2.5 py-1.5 rounded-lg transition z-10"
            >
              ✏️ Edit Profile
            </button>

            {/* Photo — clickable to edit */}
            <div className="flex-shrink-0">
              <div
                className="w-40 h-40 rounded-xl border-2 border-white/20 overflow-hidden flex items-center justify-center cursor-pointer group relative"
                style={{ background: person.avatarColor + '33' }}
                onClick={() => setShowEditProfile(true)}
                title="Click to edit profile"
              >
                {person.photoUrl ? (
                  <>
                    <img src={person.photoUrl} alt={person.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition rounded-xl gap-1">
                      <span className="text-white text-xl">✏️</span>
                      <span className="text-white text-[10px] font-semibold">Edit Photo</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center w-full h-full">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white mb-2"
                      style={{ background: person.avatarColor }}>{person.initials}</div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition rounded-xl gap-1">
                      <span className="text-white text-xl">📷</span>
                      <span className="text-white text-[10px] font-semibold">Add Photo</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="w-px bg-white/10 self-stretch" />

            {/* Left column */}
            <div className="flex-1 flex flex-col gap-2 justify-center min-w-0">
              {[
                { label: 'Name',    value: `${person.rank} ${person.name}` },
                { label: 'Unit',    value: person.unit },
                { label: 'Status',  value: person.status ?? 'Active' },
                { label: 'Contact', value: person.contactNo ?? '—' },
                { label: 'Address', value: person.address ?? '—' },
              ].map(r => (
                <div key={r.label} className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[9.5px] text-white/45 font-semibold uppercase tracking-wide whitespace-nowrap w-20 flex-shrink-0">{r.label}:</span>
                  <span className="text-[12px] text-white font-medium truncate">{r.value}</span>
                </div>
              ))}
            </div>

            <div className="w-px bg-white/10 self-stretch" />

            {/* Right column */}
            <div className="flex-1 flex flex-col gap-2 justify-center min-w-0">
              {[
                { label: 'Serial No.',  value: person.serialNo },
                { label: 'Firearm No.', value: person.firearmSerialNo ?? '—' },
                { label: 'Pag-IBIG',    value: person.pagIbigNo ?? '—' },
                { label: 'PhilHealth',  value: person.philHealthNo ?? '—' },
                { label: 'TIN',         value: person.tin ?? '—' },
              ].map(r => (
                <div key={r.label} className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[9.5px] text-white/45 font-semibold uppercase tracking-wide whitespace-nowrap w-24 flex-shrink-0">{r.label}:</span>
                  <span className="text-[12px] text-white font-medium truncate">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div className="bg-slate-50 px-6 border-t border-slate-200">
            <div className="flex items-center gap-3 py-2.5 border-b border-slate-100">
              <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${completionColor(pct)}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-sm font-bold text-slate-700 whitespace-nowrap">{pct}% Complete</span>
            </div>
            <div className="flex items-center gap-2 py-2">
              <div className="flex gap-1.5 flex-wrap text-xs font-semibold">
                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">✅ {complete}</span>
                <span className="bg-red-100    text-red-700    px-2 py-0.5 rounded-full">❌ {missing}</span>
                <span className="bg-amber-100  text-amber-700  px-2 py-0.5 rounded-full">🔄 {forUpdate}</span>
                <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">⚠️ {expired}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 px-7 py-3 bg-slate-50 border-b border-slate-100 flex-wrap">
          <input
            type="text" value={docQuery} onChange={e => setDocQuery(e.target.value)}
            placeholder="Search documents…"
            className="w-48 px-3 py-2 border-[1.5px] border-slate-200 rounded-lg text-[13.5px] bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
          />
          <div className="flex gap-1 ml-2 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button key={f.value} onClick={() => setStatusFilter(f.value)}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition whitespace-nowrap ${
                  statusFilter === f.value ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-400'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="ml-auto px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none">
            <option value="ALL">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        {docs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No documents match your filters.</div>
        ) : (
          <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
            <table className="w-full border-collapse table-fixed">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-center w-9">#</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-left w-[26%]">Document</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-left w-[16%]">Category</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-left w-[13%]">Status</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-left w-[12%]">Date Updated</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-left w-[9%]">Filed By</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-left w-[7%]">Size</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-left w-[16%]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((item, idx) => (
                  <ChecklistRow
                    key={item.id}
                    item={item}
                    index={idx}
                    onUpload={d => uploadDisc.open(d)}
                    onView={handleViewDoc}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-7 py-4 border-t border-slate-100 bg-slate-50">
          <span className="text-xs text-slate-400">
            Showing {docs.length} of {person.documents.length} documents
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            <Button variant="primary" size="sm"
              onClick={() => toast.success('201 file submitted for DPRM review.')}>
              📨 Submit to DPRM
            </Button>
          </div>
        </div>
      </Modal>

      {/* Upload modal */}
      <UploadDocModal
        item={uploadDisc.payload ?? null}
        personName={`${person.rank} ${person.name}`}
        open={uploadDisc.isOpen}
        onClose={uploadDisc.close}
        onDone={(docId, fileUrl, fileSize) => {
          onUpdate(person.id, docId, 'COMPLETE', fileUrl, fileSize)
          uploadDisc.close()
        }}
      />

      {/* Inline doc viewer */}
      <DocViewerModal
        url={viewerUrl} title={viewerTitle} open={viewerOpen}
        onClose={() => { setViewerOpen(false); setViewerUrl(null) }}
      />

      {/* Edit Profile modal */}
      <EditProfileModal
        person={person}
        open={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        onSave={updates => {
          onProfileUpdate(person.id, updates)
          setShowEditProfile(false)
        }}
      />
    </>
  )
}

// ── Add Personnel Modal ───────────────────────
function AddPersonnelModal({ open, onClose, onAdd }: {
  open: boolean
  onClose: () => void
  onAdd: (p: Personnel201Extended) => void
}) {
  const { toast }  = useToast()
  const photoRef   = useRef<HTMLInputElement>(null)
  const [loading, setLoading]           = useState(false)
  const [uploading, setUploading]       = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [photoFile, setPhotoFile]       = useState<File | null>(null)
  const [form, setForm] = useState({ lastName: '', firstName: '', rank: '', serialNo: '', unit: '' })
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function uploadPhoto(file: File): Promise<string | null> {
    try {
      const fileName = `profile-photos/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
      const { data, error } = await supabase.storage
        .from('documents').upload(fileName, file, { cacheControl: '3600', upsert: false })
      if (error) return null
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(data.path)
      return urlData.publicUrl
    } catch { return null }
  }

  async function submit() {
    if (!form.lastName || !form.firstName || !form.rank) {
      toast.error('Fill in all required fields.')
      return
    }
    setLoading(true)

    let photoUrl: string | undefined
    if (photoFile) {
      setUploading(true)
      const url = await uploadPhoto(photoFile)
      setUploading(false)
      if (url) photoUrl = url
    }

    const fullName = `${form.firstName} ${form.lastName}`
    const initials = `${form.firstName[0]}${form.lastName[0]}`.toUpperCase()
    const colors   = ['#3b63b8','#f0b429','#8b5cf6','#10b981','#ef4444','#0891b2']
    const color    = colors[Math.floor(Math.random() * colors.length)]

    const result = await createPersonnel201({
      name: fullName, rank: form.rank, serialNo: form.serialNo,
      unit: form.unit, initials, avatarColor: color,
    })

    if (result) {
      toast.success(`201 file for ${form.rank} ${fullName} created.`)
      onAdd({ ...result, photoUrl })
      setForm({ lastName: '', firstName: '', rank: '', serialNo: '', unit: '' })
      setPhotoPreview(''); setPhotoFile(null)
      onClose()
    } else {
      toast.error('Failed to create 201 file. Please try again.')
    }
    setLoading(false)
  }

  const cls = 'w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition'

  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} title="Create New 201 File" width="max-w-lg">
      <div className="p-6 space-y-4">

        {/* Photo */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Profile Photo</label>
          <div className="flex items-center gap-4">
            <div onClick={() => !loading && photoRef.current?.click()}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 cursor-pointer flex items-center justify-center overflow-hidden transition relative group flex-shrink-0">
              {photoPreview ? (
                <>
                  <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition rounded-xl">
                    <span className="text-white text-[10px] font-semibold">Change</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl">📷</span>
                  <span className="text-[9px] text-slate-400 font-medium">Upload</span>
                </div>
              )}
            </div>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={loading} />
            <div className="flex-1">
              <p className="text-xs text-slate-600 font-medium mb-1">Upload a 2×2 ID photo</p>
              <p className="text-xs text-slate-400 mb-2">JPG, PNG — GOA Type A Uniform</p>
              <div className="flex gap-2">
                <button onClick={() => !loading && photoRef.current?.click()}
                  className="text-xs text-blue-600 hover:underline font-medium" disabled={loading}>
                  {photoPreview ? '📷 Change photo' : '📷 Choose photo'}
                </button>
                {photoPreview && (
                  <button onClick={() => { setPhotoPreview(''); setPhotoFile(null) }}
                    className="text-xs text-red-500 hover:underline" disabled={loading}>Remove</button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input className={cls} placeholder="Santos" value={form.lastName}
                onChange={e => f('lastName', e.target.value)} disabled={loading} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                First Name <span className="text-red-500">*</span>
              </label>
              <input className={cls} placeholder="Ana" value={form.firstName}
                onChange={e => f('firstName', e.target.value)} disabled={loading} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                Rank <span className="text-red-500">*</span>
              </label>
              <select className={cls} value={form.rank} onChange={e => f('rank', e.target.value)} disabled={loading}>
                <option value="">Select rank…</option>
                {['P/Col.','P/Lt. Col.','P/Maj.','P/Capt.','P/Lt.','P/Insp.','PSMS','PMMS','PEMS','PNCOP'].map(r => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Serial No.</label>
              <input className={cls} placeholder="PN-2024-0001" value={form.serialNo}
                onChange={e => f('serialNo', e.target.value)} disabled={loading} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Unit / Assignment</label>
            <input className={cls} placeholder="e.g. DDNPPO HQ, PCADU" value={form.unit}
              onChange={e => f('unit', e.target.value)} disabled={loading} />
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          A blank 201 checklist (24 items, A–X) based on the PNP DPRM standard form will be created.
        </p>

        {(loading || uploading) && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-700 font-medium">{uploading ? 'Uploading photo…' : 'Creating 201 file…'}</p>
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={loading}>
            {loading ? 'Creating…' : '📁 Create 201 File'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────
export default function PersonnelFilesPage() {
  const [personnel, setPersonnel] = useState<Personnel201Extended[]>([])
  const [loading, setLoading]     = useState(true)

  const viewDisc = useDisclosure<Personnel201Extended>()
  const addModal = useModal()

  const { query, setQuery, filtered } = useSearch(
    personnel,
    ['name', 'rank', 'serialNo', 'unit'] as Array<keyof Personnel201>
  )

  useEffect(() => {
    async function loadPersonnel() {
      try {
        const { data, error } = await supabase
          .from('personnel_201').select('*').order('created_at', { ascending: false })

        if (error || !data || data.length === 0) {
          setPersonnel([])
          setLoading(false)
          return
        }

        const mapped = await Promise.all(
          data.map(async (row: any) => {
            const { data: docs } = await supabase
              .from('personnel_201_docs').select('*')
              .eq('person_id', row.id).order('created_at', { ascending: true })

            const documents: (Doc201Item & { fileUrl?: string })[] = (docs ?? []).map((d: any) => ({
              id:          d.id,
              category:    d.category,
              label:       d.label,
              sublabel:    d.sublabel ?? undefined,
              status:      d.status as Doc201Status,
              dateUpdated: d.date_updated ?? '',
              filedBy:     d.filed_by ?? undefined,
              fileSize:    d.file_size ?? undefined,
              fileUrl:     d.file_url ?? undefined,
              remarks:     d.remarks ?? undefined,
            }))

            return {
              id: row.id, name: row.name, rank: row.rank,
              serialNo: row.serial_no ?? '', unit: row.unit ?? '',
              initials: row.initials ?? '', avatarColor: row.avatar_color ?? '#3b63b8',
              dateCreated: row.date_created ?? '', lastUpdated: row.last_updated ?? '',
              photoUrl: row.photo_url ?? undefined, address: row.address ?? undefined,
              contactNo: row.contact_no ?? undefined,
              dateOfRetirement: row.date_of_retirement ?? undefined,
              status: row.status ?? 'Active',
              firearmSerialNo: row.firearm_serial_no ?? undefined,
              pagIbigNo: row.pag_ibig_no ?? undefined,
              philHealthNo: row.phil_health_no ?? undefined,
              tin: row.tin ?? undefined,
              payslipAccountNo: row.payslip_account_no ?? undefined,
              documents,
            } as Personnel201Extended
          })
        )
        setPersonnel(mapped)
      } catch {
        setPersonnel([])
      } finally {
        setLoading(false)
      }
    }
    loadPersonnel()
  }, [])

  function handleAdd(p: Personnel201Extended) {
    setPersonnel(prev => [...prev, p])
  }

  function handleDocUpdate(personId: string, docId: string, status: Doc201Status, fileUrl?: string, fileSize?: string) {
    const today = new Date().toISOString().split('T')[0]
    const updateDocs = (docs: Doc201Item[]) => docs.map(d => {
      if (d.id !== docId) return d
      return { ...d, status, dateUpdated: today, filedBy: 'Admin',
        ...(fileUrl ? { fileUrl } : {}), ...(fileSize ? { fileSize } : {}) }
    })
    setPersonnel(prev => prev.map(p =>
      p.id !== personId ? p : { ...p, lastUpdated: today, documents: updateDocs(p.documents) }
    ))
    if (viewDisc.payload?.id === personId) {
      viewDisc.open({ ...viewDisc.payload, lastUpdated: today, documents: updateDocs(viewDisc.payload.documents) })
    }
  }

  function handleProfileUpdate(personId: string, updates: Partial<Personnel201Extended>) {
    const today = new Date().toISOString().split('T')[0]
    setPersonnel(prev => prev.map(p => p.id !== personId ? p : { ...p, ...updates, lastUpdated: today }))
    if (viewDisc.payload?.id === personId) {
      viewDisc.open({ ...viewDisc.payload, ...updates, lastUpdated: today })
    }
  }

  const allDocs = personnel.flatMap(p => p.documents)
  const statCards = [
    { icon: '👥', value: personnel.length,                                                                    label: 'Personnel Records',  bg: 'bg-blue-50',    num: 'text-blue-700'    },
    { icon: '✅', value: allDocs.filter(d => d.status === 'COMPLETE').length,                                  label: 'Documents Complete', bg: 'bg-emerald-50', num: 'text-emerald-700' },
    { icon: '❌', value: allDocs.filter(d => d.status === 'MISSING').length,                                   label: 'Documents Missing',  bg: 'bg-red-50',     num: 'text-red-700'     },
    { icon: '🔄', value: allDocs.filter(d => d.status === 'FOR_UPDATE' || d.status === 'EXPIRED').length,      label: 'Need Attention',     bg: 'bg-amber-50',   num: 'text-amber-700'   },
  ]

  return (
    <>
      <PageHeader title="201 Files" />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map(s => (
            <div key={s.label} className={`${s.bg} border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-3`}>
              <span className="text-2xl">{s.icon}</span>
              <div>
                <div className={`text-2xl font-extrabold ${s.num}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-800">Personnel Roster</h2>
              <p className="text-xs text-slate-400 mt-0.5">PNP DPRM 201 File — Checklist in the Updating of Records</p>
            </div>
            <Button variant="primary" size="sm" onClick={addModal.open}>+ New 201 File</Button>
          </div>

          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
            <SearchInput value={query} onChange={setQuery}
              placeholder="Search by name, rank, serial no., unit…" className="max-w-sm flex-1" />
            <span className="text-xs text-slate-400 ml-auto">
              {filtered.length} of {personnel.length} personnel
            </span>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState icon="👤" title="No personnel records found"
                description={query ? `No results for "${query}"` : 'Create your first 201 file to get started.'}
                action={<Button variant="primary" size="sm" onClick={addModal.open}>+ New 201 File</Button>} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(person => (
                  <PersonnelCard key={person.id} person={person} onClick={() => viewDisc.open(person)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Checklist201Modal
        person={viewDisc.payload ?? null}
        onClose={viewDisc.close}
        onUpdate={handleDocUpdate}
        onProfileUpdate={handleProfileUpdate}
      />
      <AddPersonnelModal open={addModal.isOpen} onClose={addModal.close} onAdd={handleAdd} />
    </>
  )
}