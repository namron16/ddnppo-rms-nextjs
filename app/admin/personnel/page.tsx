'use client'
// app/admin/daily-journals/page.tsx
// RENAMED TO: Personnel Files (201 File)
// Based on: PNP DPRM "Checklist in the Updating of Records — Police Personal File (Database)"
// Checklist items A–U as pictured in the reference image.

import { useState, useMemo } from 'react'
import { PageHeader }   from '@/components/ui/PageHeader'
import { Badge }        from '@/components/ui/Badge'
import { Button }       from '@/components/ui/Button'
import { Avatar }       from '@/components/ui/Avatar'
import { SearchInput }  from '@/components/ui/SearchInput'
import { EmptyState }   from '@/components/ui/EmptyState'
import { AlertWarning } from '@/components/ui/AlertWarning'
import { Modal }        from '@/components/ui/Modal'
import { useToast }     from '@/components/ui/Toast'
import { useModal, useDisclosure } from '@/hooks'
import { PERSONNEL_201, CATEGORY_LABELS } from '@/lib/data201'
import { status201BadgeClass, status201Icon, formatDate } from '@/lib/utils'
import type { Personnel201, Doc201Item, Doc201Status, Doc201Category } from '@/types'

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function completionPercent(docs: Doc201Item[]) {
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

// ─────────────────────────────────────────────
// CHECKLIST ROW
// ─────────────────────────────────────────────
function ChecklistRow({ item, index, onUpload, onMarkComplete }: {
  item: Doc201Item; index: number
  onUpload: (item: Doc201Item) => void
  onMarkComplete: (item: Doc201Item) => void
}) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/80 transition group">
      <td className="px-4 py-3 text-center w-10">
        <span className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 text-slate-500 text-[11px] font-bold rounded-full">
          {LETTERS[index]}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="font-semibold text-[13.5px] text-slate-800 leading-snug">{item.label}</div>
        {item.sublabel && <div className="text-xs text-slate-400 mt-0.5">{item.sublabel}</div>}
        {item.remarks  && <div className="text-xs text-amber-600 mt-1 font-medium">⚠ {item.remarks}</div>}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-500">{CATEGORY_LABELS[item.category]}</td>
      <td className="px-4 py-3">
        <Badge className={status201BadgeClass(item.status)}>
          {status201Icon(item.status)} {item.status.replace('_', ' ')}
        </Badge>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell whitespace-nowrap">
        {item.dateUpdated ? formatDate(item.dateUpdated) : <span className="text-red-400">Not filed</span>}
      </td>
      <td className="px-4 py-3 text-xs text-slate-400 hidden xl:table-cell">{item.filedBy ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-slate-400 hidden xl:table-cell">{item.fileSize ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          {item.status !== 'COMPLETE' && (
            <button onClick={() => onMarkComplete(item)}
              className="text-[11px] font-semibold px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 transition whitespace-nowrap">
              ✅ Mark Complete
            </button>
          )}
          <button onClick={() => onUpload(item)}
            className="text-[11px] font-semibold px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition">
            📎 Upload
          </button>
          <button className="text-[11px] font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition">
            👁
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────
// PERSONNEL ROSTER CARD
// ─────────────────────────────────────────────
function PersonnelCard({ person, onClick }: { person: Personnel201; onClick: () => void }) {
  const pct      = completionPercent(person.documents)
  const complete = person.documents.filter(d => d.status === 'COMPLETE').length
  const missing  = person.documents.filter(d => d.status === 'MISSING').length
  const forUpdate= person.documents.filter(d => d.status === 'FOR_UPDATE').length
  const expired  = person.documents.filter(d => d.status === 'EXPIRED').length

  return (
    <button onClick={onClick}
      className="w-full text-left bg-white border-[1.5px] border-slate-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition-all duration-200">
      <div className="flex items-start gap-3 mb-4">
        <Avatar initials={person.initials} color={person.avatarColor} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-800 text-[15px] leading-tight truncate">{person.rank} {person.name}</div>
          <div className="text-xs text-slate-400 mt-0.5">{person.serialNo} · {person.unit}</div>
          <div className="text-xs text-slate-400 mt-0.5">Updated: {formatDate(person.lastUpdated)}</div>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
          pct === 100 ? 'bg-emerald-100 text-emerald-700' : pct >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
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

// ─────────────────────────────────────────────
// 201 CHECKLIST MODAL
// ─────────────────────────────────────────────
function Checklist201Modal({ person, onClose }: { person: Personnel201 | null; onClose: () => void }) {
  const { toast } = useToast()
  const [statusFilter, setStatusFilter] = useState<Doc201Status | 'ALL'>('ALL')
  const [catFilter, setCatFilter]       = useState<string>('ALL')
  const [docQuery, setDocQuery]         = useState('')

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

  const pct      = completionPercent(person.documents)
  const complete = person.documents.filter(d => d.status === 'COMPLETE').length
  const missing  = person.documents.filter(d => d.status === 'MISSING').length
  const forUpdate= person.documents.filter(d => d.status === 'FOR_UPDATE').length
  const expired  = person.documents.filter(d => d.status === 'EXPIRED').length

  return (
    <Modal open={!!person} onClose={onClose} title={`201 File — ${person.rank} ${person.name}`} width="max-w-5xl">

      {/* Header summary */}
      <div className="px-7 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-4 mb-4">
          <Avatar initials={person.initials} color={person.avatarColor} size="lg" />
          <div>
            <div className="font-bold text-slate-800 text-base">{person.rank} {person.name}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {person.serialNo} · {person.unit} · File created: {formatDate(person.dateCreated)}
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <button className="text-sm font-semibold px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition">
              📤 Batch Upload
            </button>
            <button className="text-sm font-semibold px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition">
              🖨 Print Checklist
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${completionColor(pct)}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm font-bold text-slate-700">{pct}% Complete</span>
        </div>

        {/* Stat pills */}
        <div className="flex gap-2 flex-wrap text-xs font-medium">
          <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">✅ {complete} Complete</span>
          <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full">❌ {missing} Missing</span>
          <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full">🔄 {forUpdate} For Update</span>
          <span className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full">⚠️ {expired} Expired</span>
          <span className="ml-auto text-slate-400">{person.documents.length} items total</span>
        </div>

        {(missing + expired + forUpdate) > 0 && (
          <div className="mt-4">
            <AlertWarning message={`This 201 file has ${missing + expired + forUpdate} document(s) that require attention before submission to DPRM.`} />
          </div>
        )}
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
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      {docs.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">No documents match your filters.</div>
      ) : (
        <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200">
                {['#','Document','Category','Status','Date Updated','Filed By','Size','Actions'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-left ${
                    i === 0 ? 'w-10 text-center' :
                    i === 2 ? 'hidden lg:table-cell' :
                    i === 4 ? 'hidden md:table-cell' :
                    [5,6].includes(i) ? 'hidden xl:table-cell' : ''
                  }`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map((item, idx) => (
                <ChecklistRow key={item.id} item={item} index={idx}
                  onUpload={d => toast.info(`Upload dialog for: ${d.label}`)}
                  onMarkComplete={d => toast.success(`"${d.label}" marked as complete.`)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-7 py-4 border-t border-slate-100 bg-slate-50">
        <span className="text-xs text-slate-400">Showing {docs.length} of {person.documents.length} documents</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          <Button variant="primary" size="sm" onClick={() => toast.success('201 file submitted for DPRM review.')}>
            📨 Submit to DPRM
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────
// ADD PERSONNEL MODAL
// ─────────────────────────────────────────────
function AddPersonnelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState({ lastName: '', firstName: '', rank: '', serialNo: '', unit: '' })
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  function submit() {
    if (!form.lastName || !form.firstName || !form.rank) { toast.error('Fill in all required fields.'); return }
    toast.success(`201 file for ${form.rank} ${form.firstName} ${form.lastName} created.`)
    onClose()
    setForm({ lastName: '', firstName: '', rank: '', serialNo: '', unit: '' })
  }

  const cls = 'w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition'

  return (
    <Modal open={open} onClose={onClose} title="Create New 201 File" width="max-w-md">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Last Name <span className="text-red-500">*</span></label>
            <input className={cls} placeholder="Santos" value={form.lastName} onChange={e => f('lastName', e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">First Name <span className="text-red-500">*</span></label>
            <input className={cls} placeholder="Ana" value={form.firstName} onChange={e => f('firstName', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Rank <span className="text-red-500">*</span></label>
            <select className={cls} value={form.rank} onChange={e => f('rank', e.target.value)}>
              <option value="">Select rank…</option>
              {['P/Col.','P/Lt. Col.','P/Maj.','P/Capt.','P/Lt.','P/Insp.','PSMS','PMMS','PEMS','PNCOP'].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Serial No.</label>
            <input className={cls} placeholder="PN-2024-0001" value={form.serialNo} onChange={e => f('serialNo', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Unit / Assignment</label>
          <input className={cls} placeholder="e.g. DDNPPO HQ, PCADU" value={form.unit} onChange={e => f('unit', e.target.value)} />
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          A blank 201 checklist (24 items, A–U) based on the PNP DPRM standard form will be created.
        </p>
        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>📁 Create 201 File</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
export default function PersonnelFilesPage() {
  const viewDisc = useDisclosure<Personnel201>()
  const addModal = useModal()

  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return PERSONNEL_201

    return PERSONNEL_201.filter(person =>
      [person.name, person.rank, person.serialNo, person.unit]
        .some(value => (value ?? '').toLowerCase().includes(q))
    )
  }, [query])

  const allDocs    = PERSONNEL_201.flatMap(p => p.documents)
  const stats = {
    personnel: PERSONNEL_201.length,
    complete:  allDocs.filter(d => d.status === 'COMPLETE').length,
    missing:   allDocs.filter(d => d.status === 'MISSING').length,
    attention: allDocs.filter(d => d.status === 'FOR_UPDATE' || d.status === 'EXPIRED').length,
  }

  return (
    <>
      <PageHeader title="Personnel Files (201)" />

      <div className="p-8 space-y-6">

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: '👥', value: stats.personnel, label: 'Personnel Records',  bg: 'bg-blue-50',    num: 'text-blue-700' },
            { icon: '✅', value: stats.complete,  label: 'Documents Complete', bg: 'bg-emerald-50', num: 'text-emerald-700' },
            { icon: '❌', value: stats.missing,   label: 'Documents Missing',  bg: 'bg-red-50',     num: 'text-red-700' },
            { icon: '🔄', value: stats.attention, label: 'Need Attention',     bg: 'bg-amber-50',   num: 'text-amber-700' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-3`}>
              <span className="text-2xl">{s.icon}</span>
              <div>
                <div className={`text-2xl font-extrabold ${s.num}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Roster panel */}
        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">

          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-800">Personnel Roster</h2>
              <p className="text-xs text-slate-400 mt-0.5">PNP DPRM 201 File — Checklist in the Updating of Records (Police Personal File Database)</p>
            </div>
            <Button variant="primary" size="sm" onClick={addModal.open}>+ New 201 File</Button>
          </div>

          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
            <SearchInput value={query} onChange={setQuery} placeholder="Search by name, rank, serial no., unit…" className="max-w-sm flex-1" />
            <span className="text-xs text-slate-400 ml-auto">{filtered.length} of {stats.personnel} personnel</span>
          </div>

          <div className="p-6">
            {filtered.length === 0 ? (
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

      <Checklist201Modal person={viewDisc.payload ?? null} onClose={viewDisc.close} />
      <AddPersonnelModal open={addModal.isOpen} onClose={addModal.close} />
    </>
  )
}