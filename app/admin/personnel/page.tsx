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
  PERSONNEL_201,
  createPersonnel201,
  updateDoc201Status,
  uploadDoc201File,
  deletePersonnel201,
  CATEGORY_LABELS,
} from '@/lib/data201'
import { status201BadgeClass, status201Icon, formatDate } from '@/lib/utils'
import type { Personnel201, Doc201Item, Doc201Status } from '@/types'

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

// ── Checklist Row ─────────────────────────────
function ChecklistRow({ item, index, onUpload, onMarkComplete }: {
  item: Doc201Item & { fileUrl?: string }
  index: number
  onUpload: (item: Doc201Item) => void
  onMarkComplete: (item: Doc201Item) => void
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
          {item.status !== 'COMPLETE' && (
            <button onClick={() => onMarkComplete(item)}
              className="text-[10px] font-semibold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 transition whitespace-nowrap">
              ✅ Complete
            </button>
          )}
          <button onClick={() => onUpload(item)}
            className="text-[10px] font-semibold px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition">
            📎 Upload
          </button>
          {(item as any).fileUrl && (
            <a href={(item as any).fileUrl} target="_blank" rel="noopener noreferrer"
              className="text-[10px] font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition">
              👁 View
            </a>
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

  return (
    <button onClick={onClick}
      className="w-full text-left bg-white border-[1.5px] border-slate-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition-all duration-200">
      <div className="flex items-start gap-3 mb-4">
        <Avatar initials={person.initials} color={person.avatarColor} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-800 text-[15px] leading-tight truncate">
            {person.rank} {person.name}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{person.serialNo} · {person.unit}</div>
          <div className="text-xs text-slate-400 mt-0.5">Updated: {formatDate(person.lastUpdated)}</div>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
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
  const [file, setFile]         = useState<File | null>(null)
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
              <button onClick={() => setFile(null)}
                className="text-slate-400 hover:text-red-500 font-bold text-sm ml-3">✕</button>
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

// ── 201 Checklist Modal ───────────────────────
function Checklist201Modal({ person, onClose, onUpdate }: {
  person: Personnel201 | null
  onClose: () => void
  onUpdate: (personId: string, docId: string, status: Doc201Status, fileUrl?: string, fileSize?: string) => void
}) {
  const { toast }   = useToast()
  const [statusFilter, setStatusFilter] = useState<Doc201Status | 'ALL'>('ALL')
  const [catFilter,    setCatFilter]    = useState('ALL')
  const [docQuery,     setDocQuery]     = useState('')
  const uploadDisc = useDisclosure<Doc201Item>()

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

  async function handleMarkComplete(item: Doc201Item) {
    if (!person) return
    await updateDoc201Status(item.id, 'COMPLETE', 'Admin')
    onUpdate(person.id, item.id, 'COMPLETE')
    toast.success(`"${item.label}" marked as complete.`)
  }

  return (
    <>
      <Modal open={!!person} onClose={onClose} title="Police Personal File" width="max-w-5xl">

        {/* Header */}
        <div className="border-b border-slate-200">
          <div className="bg-[#0f1c35] px-6 py-5 flex items-stretch gap-5">
            <div className="flex-shrink-0">
              <div className="w-40 h-40 rounded-xl border-2 border-white/20 flex flex-col items-center justify-center text-center"
                style={{ background: person.avatarColor + '33' }}>
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white mb-2"
                  style={{ background: person.avatarColor }}>{person.initials}</div>
                <span className="text-[9px] text-white/40 uppercase tracking-wide">2x2 Photo</span>
              </div>
            </div>
            <div className="w-px bg-white/10 self-stretch" />
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
            <div className="flex-1 flex flex-col gap-2 justify-center min-w-0">
              {[
                { label: 'Serial No.',    value: person.serialNo },
                { label: 'Firearm No.',   value: person.firearmSerialNo ?? '—' },
                { label: 'Pag-IBIG',      value: person.pagIbigNo ?? '—' },
                { label: 'PhilHealth',    value: person.philHealthNo ?? '—' },
                { label: 'TIN',           value: person.tin ?? '—' },
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
                    onMarkComplete={handleMarkComplete}
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
  const [form, setForm] = useState({ lastName: '', firstName: '', rank: '', serialNo: '', unit: '' })
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function submit() {
    if (!form.lastName || !form.firstName || !form.rank) {
      toast.error('Fill in all required fields.')
      return
    }
    setLoading(true)
    const fullName = `${form.firstName} ${form.lastName}`
    const initials = `${form.firstName[0]}${form.lastName[0]}`.toUpperCase()
    const colors   = ['#3b63b8','#f0b429','#8b5cf6','#10b981','#ef4444','#0891b2']
    const color    = colors[Math.floor(Math.random() * colors.length)]

    const result = await createPersonnel201({
      name:        fullName,
      rank:        form.rank,
      serialNo:    form.serialNo,
      unit:        form.unit,
      initials,
      avatarColor: color,
    })

    if (result) {
      toast.success(`201 file for ${form.rank} ${fullName} created.`)
      onAdd(result)
      setForm({ lastName: '', firstName: '', rank: '', serialNo: '', unit: '' })
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
    // Load from the seeded PERSONNEL_201 array (replace with API call if needed)
    setPersonnel(PERSONNEL_201)
    setLoading(false)
  }, [])

  function handleAdd(p: Personnel201) {
    setPersonnel(prev => [...prev, p])
  }

  // Update a doc item status/fileUrl in local state
  function handleDocUpdate(personId: string, docId: string, status: Doc201Status, fileUrl?: string, fileSize?: string) {
    setPersonnel(prev => prev.map(p => {
      if (p.id !== personId) return p
      return {
        ...p,
        documents: p.documents.map(d => {
          if (d.id !== docId) return d
          const today = new Date().toISOString().split('T')[0]
          return {
            ...d,
            status,
            dateUpdated: today,
            filedBy:     'Admin',
            ...(fileUrl  ? { fileUrl }  : {}),
            ...(fileSize ? { fileSize } : {}),
          }
        }),
      }
    }))
    // Also update the viewed person if modal is open
    if (viewDisc.payload?.id === personId) {
      viewDisc.open({
        ...viewDisc.payload,
        documents: viewDisc.payload.documents.map(d => {
          if (d.id !== docId) return d
          const today = new Date().toISOString().split('T')[0]
          return { ...d, status, dateUpdated: today, filedBy: 'Admin',
            ...(fileUrl ? { fileUrl } : {}), ...(fileSize ? { fileSize } : {}) }
        }),
      })
    }
  }

  const allDocs    = personnel.flatMap(p => p.documents)
  const statCards  = [
    { icon: '👥', value: personnel.length,                                                             label: 'Personnel Records',  bg: 'bg-blue-50',    num: 'text-blue-700'    },
    { icon: '✅', value: allDocs.filter(d => d.status === 'COMPLETE').length,                          label: 'Documents Complete', bg: 'bg-emerald-50', num: 'text-emerald-700' },
    { icon: '❌', value: allDocs.filter(d => d.status === 'MISSING').length,                           label: 'Documents Missing',  bg: 'bg-red-50',     num: 'text-red-700'     },
    { icon: '🔄', value: allDocs.filter(d => d.status === 'FOR_UPDATE' || d.status === 'EXPIRED').length, label: 'Need Attention', bg: 'bg-amber-50',   num: 'text-amber-700'   },
  ]

  return (
    <>
      <PageHeader title="201 Files" />

      <div className="p-8 space-y-6">

        {/* Stats */}
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

        {/* Roster */}
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
      />
      <AddPersonnelModal open={addModal.isOpen} onClose={addModal.close} onAdd={handleAdd} />
    </>
  )
}