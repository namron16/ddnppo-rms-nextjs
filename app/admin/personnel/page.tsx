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
import { FileText, Paperclip } from 'lucide-react'
import { useSearch, useModal, useDisclosure } from '@/hooks'
import {
  createPersonnel201,
  updateDoc201Status,
  uploadDoc201File,
  CATEGORY_LABELS,
} from '@/lib/data201'
import { supabase } from '@/lib/supabase'
import { status201BadgeClass, status201Icon, formatDate } from '@/lib/utils'
import type { Personnel201, Doc201Item, Doc201Status, Doc201Category } from '@/types'

// ── Blank checklist (fallback for records with no docs in DB) ──
function makeBlankChecklist(personnelId: string): Doc201Item[] {
  const template: Array<{ category: Doc201Category; label: string; sublabel?: string }> = [
    { category: 'PERSONAL_DATA',  label: 'Updated PDS (DPRM Form)',                         sublabel: 'With latest 2x2 ID in Type A GOA Uniform' },
    { category: 'CIVIL_DOCUMENTS',label: 'Birth Certificate',                                sublabel: 'PSA copy' },
    { category: 'CIVIL_DOCUMENTS',label: 'Marriage Contract',                                sublabel: 'PSA copy (if applicable)' },
    { category: 'CIVIL_DOCUMENTS',label: 'Birth Certificates of all Children',               sublabel: 'PSA copy' },
    { category: 'ACADEMIC',       label: 'College Diploma' },
    { category: 'ACADEMIC',       label: 'Transcript of Records and CAV',                    sublabel: 'School Records or CAV' },
    { category: 'TRAINING',       label: 'Mandatory Training Documents',                     sublabel: 'Diploma, Final Order of Merits, Declaration of Graduates' },
    { category: 'TRAINING',       label: 'Specialized Training / Seminars Attended',         sublabel: 'Certificate of Graduation/Attendance' },
    { category: 'ELIGIBILITY',    label: 'Eligibilities',                                    sublabel: 'Highest/Appropriate — attested copies' },
    { category: 'SPECIAL_ORDERS', label: 'Attested Appointment / Special Orders',            sublabel: 'Temp/Perm — attested and approved' },
    { category: 'ASSIGNMENTS',    label: 'Order of Assignment, Designation / Detail' },
    { category: 'ASSIGNMENTS',    label: 'Service Records',                                  sublabel: 'Indicate Longevity and RCA Orders' },
    { category: 'PROMOTIONS',     label: 'Promotion / Demotion Orders',                      sublabel: 'Include Absorption Order and Appointments' },
    { category: 'AWARDS',         label: 'Awards, Decorations and Commendations' },
    { category: 'FIREARMS',       label: 'Firearms Records',                                 sublabel: 'Property Accountability Receipt (P.A.R)' },
    { category: 'MEDICAL',        label: 'Latest Medical Records' },
    { category: 'CASES',          label: 'Cases / Offenses',                                 sublabel: 'All administrative and criminal cases' },
    { category: 'LEAVE',          label: 'Leave Records' },
    { category: 'PAY_RECORDS',    label: 'RCA / Longevity Pay Orders',                       sublabel: 'All pay orders' },
    { category: 'PAY_RECORDS',    label: 'Latest Per FM Previous Unit' },
    { category: 'FINANCIAL',      label: 'Statement of Assets, Liabilities & Net Worth',     sublabel: 'SALN — latest copy' },
    { category: 'TAXATION',       label: 'Individual Income Tax Return (ITR)',                sublabel: 'Latest filed ITR' },
    { category: 'TAXATION',       label: 'Photocopy of Tax Identification Card (TIN)' },
    { category: 'IDENTIFICATION', label: '1 PC Latest 2x2 ID Picture',                       sublabel: 'GOA Type A Uniform' },
  ]
  return template.map((t, i) => ({
    id:          `${personnelId}-doc-${i + 1}`,
    category:    t.category,
    label:       t.label,
    sublabel:    t.sublabel,
    status:      'MISSING' as Doc201Status,
    dateUpdated: '',
  }))
}

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

// ── Inline File Viewer Modal ──────────────────
function ViewFileModal({ item, open, onClose }: {
  item: (Doc201Item & { fileUrl?: string }) | null
  open: boolean
  onClose: () => void
}) {
  if (!item || !(item as any).fileUrl) return null
  const fileUrl = (item as any).fileUrl as string
  const isPDF   = !!fileUrl.match(/\.pdf(\?|$)/i)
  const isImage = !!fileUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)
  const isDocx  = !!fileUrl.match(/\.docx?(\?|$)/i)
  const isXlsx  = !!fileUrl.match(/\.xlsx?(\?|$)/i)

  const fileIcon = isPDF ? '📕' : isDocx ? '📘' : isXlsx ? '📗' : isImage ? '🖼️' : '📄'

  return (
    <Modal open={open} onClose={onClose} title={`View: ${item.label}`} width="max-w-4xl">
      <div className="flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg flex-shrink-0">{fileIcon}</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{item.label}</p>
              {item.sublabel && <p className="text-[10px] text-slate-400 truncate">{item.sublabel}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
            <a href={fileUrl} download
              className="text-[11px] font-semibold px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-blue-300 transition flex items-center gap-1">
              ⬇ Download
            </a>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 min-h-0">
          {isPDF ? (
            <iframe src={fileUrl} title={item.label} className="w-full border-0" style={{ height: '65vh', minHeight: 400 }} />
          ) : isImage ? (
            <div className="flex items-center justify-center p-6 min-h-[400px]">
              <img src={fileUrl} alt={item.label} className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-md border border-slate-200 bg-white" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center min-h-[300px]">
              <span className="text-5xl mb-4">{fileIcon}</span>
              <p className="text-sm font-semibold text-slate-700 mb-1">{item.label}</p>
              <p className="text-xs text-slate-400 mb-5 max-w-xs">This file type cannot be previewed inline. Download it to view the contents.</p>
              <a href={fileUrl} download className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                ⬇ Download to view
              </a>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-white flex-shrink-0">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {item.dateUpdated && <span>Filed: {formatDate(item.dateUpdated)}</span>}
            {item.filedBy && <span>· By: {item.filedBy}</span>}
            {item.fileSize && <span>· {item.fileSize}</span>}
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Checklist Row ─────────────────────────────
function ChecklistRow({ item, index, onUpload, onView }: {
  item: Doc201Item & { fileUrl?: string }
  index: number
  onUpload: (item: Doc201Item) => void
  onView: (item: Doc201Item & { fileUrl?: string }) => void
}) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/80 transition group">
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
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => onUpload(item)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition">
            <Paperclip size={11} /> Upload
          </button>
          {(item as any).fileUrl && (
            <button onClick={() => onView(item)}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition">
              <FileText size={11} /> View
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Personnel Card ────────────────────────────
function PersonnelCard({ person, onClick }: { person: Personnel201; onClick: () => void }) {
  const pct       = completionPercent(person.documents)
  const complete  = person.documents.filter(d => d.status === 'COMPLETE').length
  const missing   = person.documents.filter(d => d.status === 'MISSING').length
  const forUpdate = person.documents.filter(d => d.status === 'FOR_UPDATE').length
  const expired   = person.documents.filter(d => d.status === 'EXPIRED').length
  const isRetired = person.status === 'Retired'

  return (
    <button onClick={onClick}
      className="w-full text-left bg-white border-[1.5px] border-slate-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition-all duration-200">
      <div className="flex items-start gap-3 mb-4">
        {person.photoUrl ? (
          <img src={person.photoUrl} alt={person.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0 border-2 border-white shadow" />
        ) : (
          <Avatar initials={person.initials} color={person.avatarColor} size="lg" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-800 text-[15px] leading-tight truncate">{person.rank} {person.name}</div>
          <div className="text-xs text-slate-400 mt-0.5">{person.serialNo} · {person.unit}</div>
          {/* Status + archive badge row */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              isRetired
                ? 'bg-slate-200 text-slate-600'
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {isRetired ? '🏅 Retired' : '🟢 Active'}
            </span>
            {isRetired && (person as any).archiveAfterYears != null && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                🗄 Archive in {(person as any).archiveAfterYears}y
              </span>
            )}
          </div>
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

// ── Upload Doc Modal ──────────────────────────
function UploadDocModal({ item, personName, open, onClose, onDone }: {
  item: Doc201Item | null
  personName: string
  open: boolean
  onClose: () => void
  onDone: (docId: string, fileUrl: string, fileSize: string) => void
}) {
  const { toast }    = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile]           = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function submit() {
    if (!file || !item) { toast.error('Please select a file.'); return }
    setUploading(true)
    const url = await uploadDoc201File(item.id, file, 'Admin')
    if (url) {
      const size = (file.size / 1024 / 1024).toFixed(1) + ' MB'
      toast.success(`"${item.label}" uploaded successfully.`)
      onDone(item.id, url, size)
      setFile(null)
      onClose()
    } else {
      toast.error('Upload failed. Please try again.')
    }
    setUploading(false)
  }

  return (
    <Modal open={open} onClose={uploading ? () => {} : onClose} title="Upload Document" width="max-w-md">
      <div className="p-6 space-y-4">
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Document</p>
          <p className="text-sm font-semibold text-slate-800">{item?.label}</p>
          <p className="text-xs text-slate-400 mt-0.5">For: {personName}</p>
        </div>
        <input ref={fileInputRef} type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          className="hidden"
          onChange={e => setFile(e.target.files?.[0] ?? null)} />
        {file ? (
          <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-[1.5px] border-blue-200 rounded-xl">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl">📄</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            {!uploading && (
              <button onClick={() => setFile(null)} className="text-slate-400 hover:text-red-500 font-bold text-sm ml-3">✕</button>
            )}
          </div>
        ) : (
          <div onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
            <div className="text-3xl mb-2">📎</div>
            <p className="text-sm font-medium text-slate-600 mb-1">Click to browse</p>
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
          <Button variant="outline" onClick={onClose} disabled={uploading}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={uploading}>
            {uploading ? 'Uploading…' : '📤 Upload'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Edit Profile Modal ────────────────────────
function EditProfileModal({ person, open, onClose, onSave }: {
  person: Personnel201 | null
  open: boolean
  onClose: () => void
  onSave: (updates: Partial<Personnel201> & { photoUrl?: string; archiveAfterYears?: number }) => void
}) {
  const { toast }    = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving]   = useState(false)
  const [preview, setPreview] = useState<string>('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [archiveAfterYears, setArchiveAfterYears] = useState<string>('')
  const [form, setForm] = useState({
    name: '', rank: '', unit: '', status: '', contactNo: '', address: '',
    tin: '', pagIbigNo: '', philHealthNo: '', firearmSerialNo: '',
  })

  const isRetired = form.status === 'Retired'

  useEffect(() => {
    if (person && open) {
      setForm({
        name:            person.name            ?? '',
        rank:            person.rank            ?? '',
        unit:            person.unit            ?? '',
        status:          person.status          ?? '',
        contactNo:       person.contactNo       ?? '',
        address:         person.address         ?? '',
        tin:             person.tin             ?? '',
        pagIbigNo:       person.pagIbigNo       ?? '',
        philHealthNo:    person.philHealthNo    ?? '',
        firearmSerialNo: person.firearmSerialNo ?? '',
      })
      setPreview(person.photoUrl ?? '')
      setPhotoFile(null)
      setArchiveAfterYears((person as any).archiveAfterYears != null ? String((person as any).archiveAfterYears) : '')
    }
  }, [person, open])

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function submit() {
    if (!form.name.trim()) { toast.error('Name is required.'); return }

    if (isRetired) {
      if (!archiveAfterYears) {
        toast.error('Please specify the file retention period before archiving.')
        return
      }
      const years = Number(archiveAfterYears)
      if (isNaN(years) || years <= 0) {
        toast.error('Please enter a valid number of years (must be greater than 0).')
        return
      }
    }

    setSaving(true)
    try {
      let photoUrl = person?.photoUrl ?? undefined

      if (photoFile) {
        const fileName = `avatars/${person?.id}-${Date.now()}-${photoFile.name.replace(/\s+/g, '_')}`
        const { data: storageData, error: storageError } = await supabase.storage
          .from('documents')
          .upload(fileName, photoFile, { cacheControl: '3600', upsert: true })

        if (storageError) {
          toast.error('Photo upload failed.')
          setSaving(false)
          return
        }
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storageData.path)
        photoUrl = urlData.publicUrl
      }

      onSave({
        name:            form.name.trim(),
        rank:            form.rank.trim(),
        unit:            form.unit.trim(),
        status:          form.status.trim(),
        contactNo:       form.contactNo.trim(),
        address:         form.address.trim(),
        photoUrl,
        tin:             form.tin.trim()             || undefined,
        pagIbigNo:       form.pagIbigNo.trim()       || undefined,
        philHealthNo:    form.philHealthNo.trim()    || undefined,
        firearmSerialNo: form.firearmSerialNo.trim() || undefined,
        archiveAfterYears: isRetired && archiveAfterYears ? Number(archiveAfterYears) : undefined,
      })
      toast.success('Profile updated.')
      onClose()
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const cls = 'w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition'

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose} title="Edit Profile" width="max-w-md">
      <div className="p-6 space-y-4">

        {/* Photo Upload */}
        <div className="flex flex-col items-center gap-2">
          <div
            onClick={() => !saving && fileInputRef.current?.click()}
            className="w-24 h-24 rounded-full border-4 border-dashed border-slate-300 hover:border-blue-400 cursor-pointer flex items-center justify-center overflow-hidden transition relative group"
          >
            {preview ? (
              <img src={preview} alt="preview" className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-3xl font-bold text-slate-400">
                {form.name ? form.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '📷'}
              </span>
            )}
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
              <span className="text-white text-xs font-semibold">Change</span>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          <button onClick={() => !saving && fileInputRef.current?.click()}
            className="text-xs text-blue-600 hover:underline font-medium">
            {preview ? 'Change Photo' : 'Upload Photo'}
          </button>
          {preview && (
            <button onClick={() => { setPreview(''); setPhotoFile(null) }}
              className="text-xs text-red-500 hover:underline">Remove Photo</button>
          )}
        </div>

        {/* Rank + Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Rank</label>
            <select className={cls} value={form.rank}
              onChange={e => setForm(f => ({ ...f, rank: e.target.value }))} disabled={saving}>
              <option value="">None</option>
              {['P/Col.','P/Lt. Col.','P/Maj.','P/Capt.','P/Lt.','P/Insp.','PSMS','PMMS','PEMS','PNCOP'].map(r => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input className={cls} placeholder="e.g. Ana Santos"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} disabled={saving} />
          </div>
        </div>

        {/* Unit */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Unit / Assignment</label>
          <input className={cls} placeholder="e.g. DDNPPO HQ"
            value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} disabled={saving} />
        </div>

        {/* Status */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Status</label>
          <select className={cls} value={form.status}
            onChange={e => {
              setForm(f => ({ ...f, status: e.target.value }))
              // Clear archive years when switching away from Retired
              if (e.target.value !== 'Retired') setArchiveAfterYears('')
            }}
            disabled={saving}>
            <option value="">Select status…</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="On Leave">On Leave</option>
            <option value="Retired">Retired</option>
            <option value="Transferred">Transferred</option>
          </select>
        </div>

        {/* ── Archive retention — only shown when Retired ── */}
        {isRetired && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-amber-500 text-base flex-shrink-0 mt-0.5">🗄️</span>
              <div>
                <p className="text-[12px] font-semibold text-amber-800 leading-snug">File Retention Period</p>
                <p className="text-[11px] text-amber-600 mt-0.5 leading-relaxed">
                  Specify how many years this 201 file should be kept before it is automatically moved to the Archive.
                </p>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-amber-700 mb-1.5">
                Archive file after <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="50"
                  disabled={saving}
                  className="w-28 px-3 py-2.5 border-[1.5px] border-amber-300 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition font-semibold text-slate-800 text-center disabled:opacity-50"
                  placeholder="e.g. 5"
                  value={archiveAfterYears}
                  onChange={e => setArchiveAfterYears(e.target.value)}
                />
                <span className="text-sm text-amber-700 font-medium">
                  {Number(archiveAfterYears) === 1 ? 'year' : 'years'} from retirement date
                </span>
              </div>
              {archiveAfterYears && Number(archiveAfterYears) > 0 && (
                <p className="text-[11px] text-amber-600 mt-2">
                  📅 This file will be queued for archiving{' '}
                  <strong>{archiveAfterYears} {Number(archiveAfterYears) === 1 ? 'year' : 'years'}</strong>{' '}
                  after the retirement date.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Contact No */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Contact No.</label>
          <input className={cls} placeholder="e.g. 09171234567"
            value={form.contactNo} onChange={e => setForm(f => ({ ...f, contactNo: e.target.value }))} disabled={saving} />
        </div>

        {/* Address */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Address</label>
          <textarea rows={2} className={`${cls} resize-none`} placeholder="e.g. Tagum City, Davao del Norte"
            value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} disabled={saving} />
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 pt-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">ID Numbers</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">TIN</label>
              <input className={cls} placeholder="e.g. 123-456-789"
                value={form.tin} onChange={e => setForm(f => ({ ...f, tin: e.target.value }))} disabled={saving} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Pag-IBIG No.</label>
              <input className={cls} placeholder="e.g. 1234-5678-9012"
                value={form.pagIbigNo} onChange={e => setForm(f => ({ ...f, pagIbigNo: e.target.value }))} disabled={saving} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">PhilHealth No.</label>
              <input className={cls} placeholder="e.g. 12-345678901-2"
                value={form.philHealthNo} onChange={e => setForm(f => ({ ...f, philHealthNo: e.target.value }))} disabled={saving} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Firearm Serial No.</label>
              <input className={cls} placeholder="e.g. SER-2024-001"
                value={form.firearmSerialNo} onChange={e => setForm(f => ({ ...f, firearmSerialNo: e.target.value }))} disabled={saving} />
            </div>
          </div>
        </div>

        {saving && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-700 font-medium">Saving…</p>
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : '💾 Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── 201 Checklist Modal ───────────────────────
function Checklist201Modal({ person, onClose, onUpdate, onProfileSave }: {
  person: Personnel201 | null
  onClose: () => void
  onUpdate: (personId: string, docId: string, status: Doc201Status, fileUrl?: string, fileSize?: string) => void
  onProfileSave: (personId: string, updates: Partial<Personnel201> & { photoUrl?: string; archiveAfterYears?: number }) => void
}) {
  const { toast }        = useToast()
  const [statusFilter, setStatusFilter] = useState<Doc201Status | 'ALL'>('ALL')
  const [catFilter,    setCatFilter]    = useState('ALL')
  const [docQuery,     setDocQuery]     = useState('')
  const uploadDisc       = useDisclosure<Doc201Item>()
  const viewDisc         = useDisclosure<Doc201Item & { fileUrl?: string }>()
  const editProfileModal = useModal()

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
  const isRetired = person.status === 'Retired'

  return (
    <>
      <Modal open={!!person} onClose={onClose} title="Police Personal File" width="max-w-5xl">

        {/* Blue Header */}
        <div className="border-b border-slate-200">
          <div className="bg-[#0f1c35] px-6 py-5 flex items-stretch gap-5">
            <div className="flex-shrink-0">
              <div className="w-40 h-40 rounded-xl border-2 border-white/20 flex flex-col items-center justify-center text-center overflow-hidden relative"
                style={{ background: person.avatarColor + '33' }}>
                {person.photoUrl ? (
                  <img src={person.photoUrl} alt={person.name} className="w-full h-full object-cover" />
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white mb-2"
                      style={{ background: person.avatarColor }}>{person.initials}</div>
                    <span className="text-[9px] text-white/40 uppercase tracking-wide">2x2 Photo</span>
                  </>
                )}
              </div>
            </div>
            <div className="w-px bg-white/10 self-stretch" />
            <div className="flex-1 flex flex-col gap-2 justify-center min-w-0">
              {[
                { label: 'Name',    value: `${person.rank} ${person.name}` },
                { label: 'Unit',    value: person.unit },
                { label: 'Status',  value: person.status ?? 'Active', isStatus: true },
                { label: 'Contact', value: person.contactNo ?? '—' },
                { label: 'Address', value: person.address ?? '—' },
              ].map(r => (
                <div key={r.label} className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[9.5px] text-white/45 font-semibold uppercase tracking-wide whitespace-nowrap w-20 flex-shrink-0">{r.label}:</span>
                  <span className={`text-[12px] font-medium truncate ${
                    (r as any).isStatus && isRetired ? 'text-amber-300' : 'text-white'
                  }`}>
                    {(r as any).isStatus && isRetired ? '🏅 ' : ''}{r.value}
                    {(r as any).isStatus && isRetired && (person as any).archiveAfterYears != null && (
                      <span className="ml-2 text-[10px] text-amber-400/80 font-normal">
                        (Archive after {(person as any).archiveAfterYears} {(person as any).archiveAfterYears === 1 ? 'year' : 'years'})
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className="w-px bg-white/10 self-stretch" />
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
            {/* Edit button */}
            <div className="flex flex-col justify-start pt-1 flex-shrink-0">
              <button
                onClick={editProfileModal.open}
                className="text-[11px] font-semibold px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/20 rounded-lg transition flex items-center gap-1.5"
              >
                ✏️ Edit
              </button>
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
          <SearchInput value={docQuery} onChange={setDocQuery} placeholder="Search documents…" className="w-48" />
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

        {/* Checklist table */}
        {docs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No documents match your filters.</div>
        ) : (
          <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
            <table className="w-full border-collapse table-fixed">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-center w-9">#</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-left w-[28%]">Document</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-left w-[18%]">Category</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-left w-[13%]">Status</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-left w-[12%]">Date Updated</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-left w-[9%]">Filed By</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-left w-[7%]">Size</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((item, idx) => (
                  <ChecklistRow
                    key={item.id}
                    item={item}
                    index={idx}
                    onUpload={d => uploadDisc.open(d)}
                    onView={d => viewDisc.open(d)}
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

      <ViewFileModal
        item={viewDisc.payload ?? null}
        open={viewDisc.isOpen}
        onClose={viewDisc.close}
      />

      <EditProfileModal
        person={person}
        open={editProfileModal.isOpen}
        onClose={editProfileModal.close}
        onSave={(updates) => onProfileSave(person.id, updates)}
      />
    </>
  )
}

// ── Add Personnel Modal ───────────────────────
function AddPersonnelModal({ open, onClose, onAdd }: {
  open: boolean
  onClose: () => void
  onAdd: (p: Personnel201) => void
}) {
  const { toast }  = useToast()
  const [loading, setLoading] = useState(false)
  const [archiveAfterYears, setArchiveAfterYears] = useState<string>('')
  const [form, setForm] = useState({
    lastName: '', firstName: '', rank: '', serialNo: '', unit: '',
    status: 'Active',
  })
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const isRetired = form.status === 'Retired'

  async function submit() {
    if (!form.lastName || !form.firstName || !form.rank) {
      toast.error('Fill in all required fields.')
      return
    }

    if (isRetired) {
      if (!archiveAfterYears) {
        toast.error('Please specify the file retention period before archiving.')
        return
      }
      const years = Number(archiveAfterYears)
      if (isNaN(years) || years <= 0) {
        toast.error('Please enter a valid number of years (must be greater than 0).')
        return
      }
    }

    setLoading(true)
    const fullName = `${form.firstName} ${form.lastName}`
    const initials = `${form.firstName[0]}${form.lastName[0]}`.toUpperCase()
    const colors   = ['#3b63b8','#f0b429','#8b5cf6','#10b981','#ef4444','#0891b2']
    const color    = colors[Math.floor(Math.random() * colors.length)]

    const result = await createPersonnel201({
      name: fullName, rank: form.rank, serialNo: form.serialNo,
      unit: form.unit, initials, avatarColor: color,
      ...(isRetired && archiveAfterYears ? { archiveAfterYears: Number(archiveAfterYears) } : {}),
    })

    if (result) {
      const retentionMsg = isRetired && archiveAfterYears
        ? ` File will be archived after ${archiveAfterYears} ${Number(archiveAfterYears) === 1 ? 'year' : 'years'}.`
        : ''
      toast.success(`201 file for ${form.rank} ${fullName} created.${retentionMsg}`)
      onAdd(result)
      setForm({ lastName: '', firstName: '', rank: '', serialNo: '', unit: '', status: 'Active' })
      setArchiveAfterYears('')
      onClose()
    } else {
      toast.error('Failed to create 201 file. Please try again.')
    }
    setLoading(false)
  }

  const cls = 'w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition'

  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} title="Create New 201 File" width="max-w-md">
      <div className="p-6 space-y-4">
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

        {/* Status */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Status</label>
          <select
            className={cls}
            value={form.status}
            onChange={e => {
              f('status', e.target.value)
              if (e.target.value !== 'Retired') setArchiveAfterYears('')
            }}
            disabled={loading}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="On Leave">On Leave</option>
            <option value="Retired">Retired</option>
            <option value="Transferred">Transferred</option>
          </select>
        </div>

        {/* ── Archive retention — only shown when Retired ── */}
        {isRetired && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-amber-500 text-base flex-shrink-0 mt-0.5">🗄️</span>
              <div>
                <p className="text-[12px] font-semibold text-amber-800 leading-snug">File Retention Period</p>
                <p className="text-[11px] text-amber-600 mt-0.5 leading-relaxed">
                  Since this personnel is marked as <strong>Retired</strong>, specify how many years
                  this 201 file should be kept before it is automatically moved to the Archive.
                </p>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-amber-700 mb-1.5">
                Archive file after <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="50"
                  disabled={loading}
                  className="w-28 px-3 py-2.5 border-[1.5px] border-amber-300 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition font-semibold text-slate-800 text-center disabled:opacity-50"
                  placeholder="e.g. 5"
                  value={archiveAfterYears}
                  onChange={e => setArchiveAfterYears(e.target.value)}
                />
                <span className="text-sm text-amber-700 font-medium">
                  {Number(archiveAfterYears) === 1 ? 'year' : 'years'} from retirement date
                </span>
              </div>
              {archiveAfterYears && Number(archiveAfterYears) > 0 && (
                <p className="text-[11px] text-amber-600 mt-2">
                  📅 This file will be queued for archiving{' '}
                  <strong>{archiveAfterYears} {Number(archiveAfterYears) === 1 ? 'year' : 'years'}</strong>{' '}
                  after the retirement date.
                </p>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-slate-400 leading-relaxed">
          A blank 201 checklist (24 items, A–X) based on the PNP DPRM standard form will be created.
        </p>
        {loading && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-700 font-medium">Creating 201 file…</p>
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
  const [personnel, setPersonnel] = useState<Personnel201[]>([])
  const [loading, setLoading]     = useState(true)

  const viewDisc = useDisclosure<Personnel201>()
  const addModal = useModal()

  const { query, setQuery, filtered } = useSearch(
    personnel,
    ['name', 'rank', 'serialNo', 'unit'] as Array<keyof Personnel201>
  )

  useEffect(() => {
    async function loadPersonnel() {
      try {
        const { data, error } = await supabase
          .from('personnel_201')
          .select('*')
          .order('created_at', { ascending: false })

        if (error || !data || data.length === 0) {
          setPersonnel([])
          setLoading(false)
          return
        }

        const withDocs = await Promise.all(
          data.map(async (p: any) => {
            const { data: docs, error: docsError } = await supabase
              .from('personnel_201_docs')
              .select('*')
              .eq('personnel_id', p.id)
              .order('created_at', { ascending: true })

            const personnelId = p.id

            let documentList: Doc201Item[]
            if (docsError || !docs || docs.length === 0) {
              documentList = makeBlankChecklist(personnelId)
              const docsToInsert = documentList.map(d => ({
                id:           d.id,
                personnel_id: personnelId,
                category:     d.category,
                label:        d.label,
                sublabel:     d.sublabel ?? null,
                status:       d.status,
                date_updated: null,
                filed_by:     null,
                file_size:    null,
                file_url:     null,
                remarks:      null,
              }))
              await supabase.from('personnel_201_docs').insert(docsToInsert)
            } else {
              documentList = docs.map((d: any) => ({
                id:          d.id,
                category:    d.category,
                label:       d.label,
                sublabel:    d.sublabel ?? undefined,
                status:      d.status,
                dateUpdated: d.date_updated ?? '',
                filedBy:     d.filed_by ?? undefined,
                fileSize:    d.file_size ?? undefined,
                fileUrl:     d.file_url ?? undefined,
                remarks:     d.remarks ?? undefined,
              }))
            }

            return {
              id:               p.id,
              name:             p.name,
              rank:             p.rank,
              serialNo:         p.serial_no           ?? '',
              unit:             p.unit                ?? '',
              dateCreated:      p.date_created         ?? '',
              lastUpdated:      p.last_updated         ?? '',
              initials:         p.initials             ?? '',
              avatarColor:      p.avatar_color         ?? '#3b63b8',
              photoUrl:         p.photo_url            ?? undefined,
              address:          p.address              ?? undefined,
              contactNo:        p.contact_no           ?? undefined,
              dateOfRetirement: p.date_of_retirement   ?? undefined,
              status:           p.status               ?? 'Active',
              firearmSerialNo:  p.firearm_serial_no    ?? undefined,
              pagIbigNo:        p.pag_ibig_no          ?? undefined,
              philHealthNo:     p.phil_health_no       ?? undefined,
              tin:              p.tin                  ?? undefined,
              payslipAccountNo: p.payslip_account_no   ?? undefined,
              archiveAfterYears:p.archive_after_years  ?? undefined,
              documents:        documentList,
            } as Personnel201
          })
        )

        setPersonnel(withDocs)
      } catch (err) {
        console.error('Failed to load personnel:', err)
        setPersonnel([])
      } finally {
        setLoading(false)
      }
    }

    loadPersonnel()
  }, [])

  function handleAdd(p: Personnel201) {
    setPersonnel(prev => [p, ...prev])
  }

  function handleDocUpdate(personId: string, docId: string, status: Doc201Status, fileUrl?: string, fileSize?: string) {
    const today = new Date().toISOString().split('T')[0]

    setPersonnel(prev => prev.map(p => {
      if (p.id !== personId) return p
      return {
        ...p,
        lastUpdated: today,
        documents: p.documents.map(d => {
          if (d.id !== docId) return d
          return { ...d, status, dateUpdated: today, filedBy: 'Admin',
            ...(fileUrl  ? { fileUrl }  : {}),
            ...(fileSize ? { fileSize } : {}),
          }
        }),
      }
    }))

    if (viewDisc.payload?.id === personId) {
      viewDisc.open({
        ...viewDisc.payload,
        lastUpdated: today,
        documents: viewDisc.payload.documents.map(d => {
          if (d.id !== docId) return d
          return { ...d, status, dateUpdated: today, filedBy: 'Admin',
            ...(fileUrl ? { fileUrl } : {}), ...(fileSize ? { fileSize } : {}) }
        }),
      })
    }

    supabase
      .from('personnel_201')
      .update({ last_updated: today })
      .eq('id', personId)
      .then(({ error }) => {
        if (error) console.warn('last_updated update warning:', error.message)
      })
  }

  function handleProfileSave(personId: string, updates: Partial<Personnel201> & { photoUrl?: string; archiveAfterYears?: number }) {
    setPersonnel(prev => prev.map(p => p.id !== personId ? p : { ...p, ...updates }))

    if (viewDisc.payload?.id === personId) {
      viewDisc.open({ ...viewDisc.payload, ...updates })
    }

    supabase.from('personnel_201').update({
      name:                updates.name,
      rank:                updates.rank,
      unit:                updates.unit,
      status:              updates.status,
      contact_no:          updates.contactNo,
      address:             updates.address,
      photo_url:           updates.photoUrl            ?? null,
      tin:                 updates.tin                 ?? null,
      pag_ibig_no:         updates.pagIbigNo           ?? null,
      phil_health_no:      updates.philHealthNo        ?? null,
      firearm_serial_no:   updates.firearmSerialNo     ?? null,
      archive_after_years: updates.archiveAfterYears   ?? null,
    }).eq('id', personId).then(({ error }) => {
      if (error) console.warn('Profile update warning:', error.message)
    })
  }

  const allDocs   = personnel.flatMap(p => p.documents)
  const statCards = [
    { icon: '👥', value: personnel.length,                                                                label: 'Personnel Records',  bg: 'bg-blue-50',    num: 'text-blue-700'    },
    { icon: '✅', value: allDocs.filter(d => d.status === 'COMPLETE').length,                             label: 'Documents Complete', bg: 'bg-emerald-50', num: 'text-emerald-700' },
    { icon: '❌', value: allDocs.filter(d => d.status === 'MISSING').length,                              label: 'Documents Missing',  bg: 'bg-red-50',     num: 'text-red-700'     },
    { icon: '🔄', value: allDocs.filter(d => d.status === 'FOR_UPDATE' || d.status === 'EXPIRED').length, label: 'Need Attention',     bg: 'bg-amber-50',   num: 'text-amber-700'   },
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
        onProfileSave={handleProfileSave}
      />
      <AddPersonnelModal open={addModal.isOpen} onClose={addModal.close} onAdd={handleAdd} />
    </>
  )
}