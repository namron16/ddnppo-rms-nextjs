'use client'
// app/admin/master/page.tsx

import { useState, useMemo, useRef, useEffect } from 'react'
import { PageHeader }       from '@/components/ui/PageHeader'
import { StatCard }         from '@/components/ui/StatCard'
import { Badge }            from '@/components/ui/Badge'
import { Button }           from '@/components/ui/Button'
import { SearchInput }      from '@/components/ui/SearchInput'
import { ConfirmDialog }    from '@/components/ui/ConfirmDialog'
import { EmptyState }       from '@/components/ui/EmptyState'
import { ToolbarSelect }    from '@/components/ui/Toolbar'
import { Modal }            from '@/components/ui/Modal'
import { AddDocumentModal } from '@/components/modals/AddDocumentModal'
import { useModal, useDisclosure } from '@/hooks'
import { useToast }         from '@/components/ui/Toast'
import { levelBadgeClass }  from '@/lib/utils'
import { supabase }         from '@/lib/supabase'
import {
  getMasterDocuments,
  addMasterDocument,
  updateMasterDocument,
  deleteMasterDocument,
  addArchivedDoc,
} from '@/lib/data'
import type { MasterDocument, DocLevel } from '@/types'

type DocWithUrl = MasterDocument & { fileUrl?: string }

// ── Flatten tree ─────────────────────────────
interface FlatNode { doc: DocWithUrl; depth: number }
function flatten(docs: DocWithUrl[], depth = 0): FlatNode[] {
  return docs.flatMap(doc => [
    { doc, depth },
    ...(doc.children ? flatten(doc.children as DocWithUrl[], depth + 1) : []),
  ])
}

// ── Forward Modal ─────────────────────────────
function ForwardModal({ doc, open, onClose }: { doc: DocWithUrl | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const [recipient, setRecipient] = useState('')
  const [remarks, setRemarks]     = useState('')

  function submit() {
    if (!recipient) { toast.error('Please select a recipient.'); return }
    toast.success(`Document forwarded to ${recipient}.`)
    setRecipient(''); setRemarks(''); onClose()
  }

  const cls = 'w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition'

  return (
    <Modal open={open} onClose={onClose} title="Forward Document" width="max-w-md">
      <div className="p-6 space-y-4">
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Document</p>
          <p className="text-sm font-semibold text-slate-800">{doc?.title}</p>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Forward To <span className="text-red-500">*</span>
          </label>
          <select className={cls} value={recipient} onChange={e => setRecipient(e.target.value)}>
            <option value="">Select recipient…</option>
            <option>P/Col. Ramon Dela Cruz — Provincial Director</option>
            <option>P/Capt. Sara Yap — PCADU Unit Chief</option>
            <option>P/Capt. Jun Santos — PDMU Unit Chief</option>
            <option>P/Maj. Dan Lim — PPPU Unit Chief</option>
            <option>P/Maj. Ana Santos — PDMU</option>
            <option>P/Insp. Jose Reyes — PCADU</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Remarks / Instructions</label>
          <textarea rows={3} className={`${cls} resize-none`}
            placeholder="Add any instructions or remarks…"
            value={remarks} onChange={e => setRemarks(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>➡ Forward</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Edit Modal ────────────────────────────────
function EditModal({ doc, open, onClose, onSave }: {
  doc: DocWithUrl | null
  open: boolean
  onClose: () => void
  onSave: (updated: DocWithUrl) => void
}) {
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState<DocLevel>('REGIONAL')
  const [tag,   setTag]   = useState('COMPLIANCE')
  const [date,  setDate]  = useState('')
  const [type,  setType]  = useState('PDF')

  useMemo(() => {
    if (doc) { setTitle(doc.title); setLevel(doc.level); setTag(doc.tag); setDate(doc.date); setType(doc.type) }
  }, [doc])

  function submit() {
    if (!title.trim()) { toast.error('Title is required.'); return }
    if (!doc) return
    onSave({ ...doc, title: title.trim(), level, tag, date, type })
  }

  const cls = 'w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition'

  return (
    <Modal open={open} onClose={onClose} title="Edit Document" width="max-w-lg">
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Document Title <span className="text-red-500">*</span>
          </label>
          <input className={cls} value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Level</label>
            <select className={cls} value={level} onChange={e => setLevel(e.target.value as DocLevel)}>
              <option value="REGIONAL">Regional</option>
              <option value="PROVINCIAL">Provincial</option>
              <option value="STATION">Station</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Tag</label>
            <select className={cls} value={tag} onChange={e => setTag(e.target.value)}>
              <option value="COMPLIANCE">Compliance</option>
              <option value="DIRECTIVE">Directive</option>
              <option value="CIRCULAR">Circular</option>
              <option value="MEMORANDUM">Memorandum</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Date</label>
            <input type="date" className={cls} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">File Type</label>
            <select className={cls} value={type} onChange={e => setType(e.target.value)}>
              <option value="PDF">PDF</option>
              <option value="DOCX">DOCX</option>
              <option value="XLSX">XLSX</option>
              <option value="Image">Image</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>💾 Save Changes</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Attach Modal ──────────────────────────────
function AttachModal({ doc, open, onClose }: { doc: DocWithUrl | null; open: boolean; onClose: () => void }) {
  const { toast }               = useToast()
  const fileInputRef            = useRef<HTMLInputElement>(null)
  const [files, setFiles]       = useState<File[]>([])
  const [dragging, setDragging] = useState(false)

  function handleFiles(incoming: FileList | null) {
    if (!incoming) return
    setFiles(prev => [...prev, ...Array.from(incoming)])
  }

  function submit() {
    if (files.length === 0) { toast.error('Please attach at least one file.'); return }
    toast.success(`${files.length} file(s) attached to "${doc?.title}".`)
    setFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  function handleClose() {
    setFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Attach Files" width="max-w-lg">
      <div className="p-6 space-y-4">
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Attaching to</p>
          <p className="text-sm font-semibold text-slate-800">{doc?.title}</p>
        </div>
        <input ref={fileInputRef} type="file" multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
          className="hidden" onChange={e => handleFiles(e.target.files)} />
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
            dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50'
          }`}
        >
          <div className="text-3xl mb-2">📎</div>
          <p className="text-sm font-medium text-slate-600 mb-1">Click to browse or drag & drop</p>
          <p className="text-xs text-slate-400">PDF, DOCX, XLSX, JPG — max 50 MB · Multiple files allowed</p>
        </div>
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg flex-shrink-0">
                    {f.name.endsWith('.pdf') ? '📕' : f.name.match(/\.docx?$/) ? '📘' : f.name.match(/\.xlsx?$/) ? '📗' : '🖼️'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{f.name}</p>
                    <p className="text-xs text-slate-400">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))}
                  className="text-slate-400 hover:text-red-500 font-bold text-sm transition flex-shrink-0 ml-2">✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            📎 Attach {files.length > 0 ? `(${files.length})` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Detail Panel ──────────────────────────────
function DocDetail({ doc, onForward, onEdit, onAttach, onArchive }: {
  doc: DocWithUrl
  onForward: () => void
  onEdit: () => void
  onAttach: () => void
  onArchive: () => void
}) {
  const pathLabel =
    doc.level === 'STATION'    ? 'Regional → Provincial → Station' :
    doc.level === 'PROVINCIAL' ? 'Regional → Provincial' : 'Regional'

  const fileIcon =
    doc.type === 'PDF'  ? '📕' :
    doc.type === 'DOCX' ? '📘' :
    doc.type === 'XLSX' ? '📗' : '🖼️'

  const isImage = doc.fileUrl?.match(/\.(jpg|jpeg|png|webp)$/i)
  const isPDF   = doc.type === 'PDF' || doc.fileUrl?.endsWith('.pdf')

  return (
    <div className="animate-fade-up">
      <div className="text-xs text-slate-400 flex items-center gap-1 mb-2">
        {pathLabel.split(' → ').map((p, i, arr) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span>→</span>}
            <span className={i === arr.length - 1 ? 'text-blue-600 font-medium' : ''}>{p}</span>
          </span>
        ))}
      </div>
      <h2 className="text-2xl font-extrabold text-slate-800 leading-tight mb-3">{doc.title}</h2>
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <span className="text-xs text-slate-500">📅 {doc.date}</span>
        <span className="text-xs text-slate-500">📄 {doc.type} · {doc.size}</span>
        <Badge className="bg-blue-50 text-blue-700">{doc.tag}</Badge>
        <Badge className={levelBadgeClass(doc.level)}>{doc.level}</Badge>
      </div>
      <div className="flex gap-2 flex-wrap mb-5">
        <Button variant="outline" size="sm" onClick={onForward}>➡ Forward</Button>
        <Button variant="outline" size="sm" onClick={onEdit}>✏️ Edit</Button>
        <Button variant="outline" size="sm" onClick={onAttach}>📎 Attach</Button>
        <Button variant="danger"  size="sm" onClick={onArchive}>🗄️ Archive</Button>
      </div>

      {/* Preview */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Document Preview</span>
          <div className="flex gap-1.5">
            {doc.fileUrl && (
              <a href={doc.fileUrl} download target="_blank" rel="noopener noreferrer"
                className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-medium transition">
                ⬇ Download
              </a>
            )}
            {doc.fileUrl && (
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-medium transition">
                🔗 Open
              </a>
            )}
          </div>
        </div>
        {doc.fileUrl ? (
          isImage ? (
            <div className="p-4">
              <img src={doc.fileUrl} alt={doc.title}
                className="w-full max-h-[500px] object-contain rounded-lg border border-slate-200" />
            </div>
          ) : isPDF ? (
            <iframe src={doc.fileUrl} title={doc.title} className="w-full border-0" style={{ height: '500px' }} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
              <div className="w-16 h-16 bg-slate-200 rounded-xl flex items-center justify-center text-3xl mb-4">{fileIcon}</div>
              <p className="text-sm font-semibold text-slate-600 mb-1">{doc.title}</p>
              <p className="text-xs text-slate-400 mb-4">{doc.type} · {doc.size}</p>
              <a href={doc.fileUrl} download
                className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                ⬇ Download to view
              </a>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="w-16 h-16 bg-slate-200 rounded-xl flex items-center justify-center text-3xl mb-4">{fileIcon}</div>
            <p className="text-sm font-semibold text-slate-600 mb-1">{doc.title}</p>
            <p className="text-xs text-slate-400">{doc.type} · {doc.size} · Uploaded {doc.date}</p>
            <p className="text-xs text-slate-300 mt-4 max-w-xs leading-relaxed">
              No file attached. Re-upload this document to enable preview.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────
export default function MasterPage() {
  const [documents, setDocuments] = useState<DocWithUrl[]>([])
  const [selected,  setSelected]  = useState<DocWithUrl | null>(null)
  const [query,     setQuery]     = useState('')
  const [levelFilter, setLevel]   = useState<DocLevel | 'ALL'>('ALL')
  const [loading,   setLoading]   = useState(true)

  // ★ Real counts from Supabase
  const [counts, setCounts] = useState({
    specialOrders:   0,
    confidentialDocs: 0,
    registeredUsers:  0,
  })

  const uploadModal  = useModal()
  const forwardModal = useModal()
  const editModal    = useModal()
  const attachModal  = useModal()
  const archiveDisc  = useDisclosure<string>()
  const { toast }    = useToast()

  // Load documents + counts on mount
  useEffect(() => {
    async function loadAll() {
      // Documents
      const docs = await getMasterDocuments()
      setDocuments(docs)
      if (docs.length > 0) setSelected(docs[0])

      // Real counts from Supabase
      const [soRes, cdRes] = await Promise.all([
        supabase.from('special_orders').select('id', { count: 'exact', head: true }),
        supabase.from('confidential_docs').select('id', { count: 'exact', head: true }),
      ])

      setCounts({
        specialOrders:    soRes.count   ?? 0,
        confidentialDocs: cdRes.count   ?? 0,
        registeredUsers:  3, // hardcoded — matches USERS array in lib/data.ts
      })

      setLoading(false)
    }
    loadAll()
  }, [])

  const allFlat  = useMemo(() => flatten(documents), [documents])
  const filtered = useMemo(() => allFlat.filter(({ doc }) => {
    const matchesQuery = !query || doc.title.toLowerCase().includes(query.toLowerCase())
    const matchesLevel = levelFilter === 'ALL' || doc.level === levelFilter
    return matchesQuery && matchesLevel
  }), [allFlat, query, levelFilter])

  async function handleAdd(newDoc: DocWithUrl) {
    await addMasterDocument(newDoc)
    setDocuments(prev => [...prev, newDoc])
    setSelected(newDoc)
  }

  async function handleSave(updated: DocWithUrl) {
    await updateMasterDocument(updated)
    setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d))
    setSelected(updated)
    toast.success('Document updated successfully.')
    editModal.close()
  }

  async function handleArchive() {
    if (!selected) return
    const date = new Date().toISOString().split('T')[0]
    await addArchivedDoc({
      id:           `arc-${Date.now()}`,
      title:        selected.title,
      type:         selected.type,
      archivedDate: date,
      archivedBy:   'Admin',
    })
    await deleteMasterDocument(selected.id)
    setDocuments(prev => prev.filter(d => d.id !== selected.id))
    setSelected(null)
    toast.success('Document archived.')
    archiveDisc.close()
  }

  return (
    <>
      <PageHeader title="Master Documents" />

      <div className="p-8 flex flex-col gap-6 flex-1">

        {/* Stats — all pulling from real Supabase data */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard icon="📁" value={documents.length}         label="Master Documents"  bgColor="bg-blue-50" />
          <StatCard icon="📋" value={counts.specialOrders}     label="Admin Orders"    bgColor="bg-emerald-50" />
          <StatCard icon="🔒" value={counts.confidentialDocs}  label="Confidential Docs" bgColor="bg-amber-50" />
          <StatCard icon="👥" value={counts.registeredUsers}   label="Registered Users"  bgColor="bg-purple-50" />
        </div>

        {/* Panel */}
        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden flex-1 flex flex-col">

          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50">
            <SearchInput value={query} onChange={setQuery} placeholder="Search documents…" className="max-w-xs flex-1" />
            <ToolbarSelect
              defaultValue="ALL"
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLevel(e.target.value as DocLevel | 'ALL')}
            >
              <option value="ALL">All Levels</option>
              <option value="REGIONAL">Regional</option>
              <option value="PROVINCIAL">Provincial</option>
              <option value="STATION">Station</option>
            </ToolbarSelect>
            <Button variant="primary" size="sm" className="ml-auto" onClick={uploadModal.open}>
              + Upload
            </Button>
          </div>

          <div className="grid flex-1 min-h-[440px]" style={{ gridTemplateColumns: '280px 1fr' }}>

            <div className="border-r border-slate-200 overflow-y-auto py-4">
              <div className="px-4 pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Document Hierarchy · {filtered.length} DOCS
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState icon="📁" title="No documents yet" description="Upload your first document to get started." />
              ) : (
                filtered.map(({ doc, depth }) => (
                  <button key={doc.id} onClick={() => setSelected(doc)}
                    style={{ marginLeft: `${depth * 18 + 8}px`, width: `calc(100% - ${depth * 18 + 16}px)` }}
                    className={`text-left flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition mb-0.5 ${
                      selected?.id === doc.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{
                      background:
                        doc.level === 'REGIONAL'   ? '#3b63b8' :
                        doc.level === 'PROVINCIAL' ? '#f59e0b' : '#10b981',
                    }} />
                    <span className="truncate">{doc.title}</span>
                  </button>
                ))
              )}
            </div>

            <div className="p-7 overflow-y-auto">
              {selected ? (
                <DocDetail
                  doc={selected}
                  onForward={forwardModal.open}
                  onEdit={editModal.open}
                  onAttach={attachModal.open}
                  onArchive={() => archiveDisc.open(selected.title)}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <EmptyState icon="📄" title="No document selected"
                    description="Upload a document or select one from the list."
                    action={<Button variant="primary" size="sm" onClick={uploadModal.open}>+ Upload Document</Button>}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AddDocumentModal open={uploadModal.isOpen} onClose={uploadModal.close} onAdd={handleAdd} />
      <ForwardModal doc={selected} open={forwardModal.isOpen} onClose={forwardModal.close} />
      <EditModal    doc={selected} open={editModal.isOpen}    onClose={editModal.close} onSave={handleSave} />
      <AttachModal  doc={selected} open={attachModal.isOpen}  onClose={attachModal.close} />

      <ConfirmDialog
        open={archiveDisc.isOpen}
        title="Archive Document"
        message={`Archive "${archiveDisc.payload}"? It will be moved to the Archive page.`}
        confirmLabel="Archive"
        variant="danger"
        onConfirm={handleArchive}
        onCancel={archiveDisc.close}
      />
    </>
  )
}