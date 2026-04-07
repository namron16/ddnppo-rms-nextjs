'use client'
// app/admin/master/page.tsx
// Enhanced with Nested Attachment / Branching File System

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { PageHeader }       from '@/components/ui/PageHeader'
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
import { FileText, Paperclip } from 'lucide-react'
import {
  getMasterDocuments,
  addMasterDocument,
  updateMasterDocument,
  archiveMasterDocument,
  addArchivedDoc,
  getArchivedDocs,
} from '@/lib/data'
import type { MasterDocument, DocLevel } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────
type DocWithUrl = MasterDocument & { fileUrl?: string }

export interface DocAttachment {
  id: string
  document_id: string
  parent_attachment_id: string | null
  file_name: string
  file_url: string
  file_size: string
  file_type: string
  uploaded_at: string
  uploaded_by: string
  archived: boolean
}

type NavEntry =
  | { kind: 'doc';        doc: DocWithUrl }
  | { kind: 'attachment'; att: DocAttachment }

type Selection = { kind: 'doc'; doc: DocWithUrl }

// ── Supabase helpers ───────────────────────────────────────────────────────
function normaliseAttachment(row: any): DocAttachment {
  return {
    id:                   row.id,
    document_id:          row.document_id,
    parent_attachment_id: row.parent_attachment_id ?? null,
    file_name:            row.file_name,
    file_url:             row.file_url,
    file_size:            row.file_size,
    file_type:            row.file_type,
    uploaded_at:          row.uploaded_at,
    uploaded_by:          row.uploaded_by,
    archived:             row.archived === true,
  }
}

async function dbAddAttachment(
  att: Omit<DocAttachment, 'uploaded_at'>
): Promise<DocAttachment | null> {
  const { data, error } = await supabase
    .from('master_document_attachments')
    .insert({ ...att, archived: false, uploaded_at: new Date().toISOString() })
    .select()
    .single()
  if (error) { console.error('addAttachment error:', error.message); return null }
  return normaliseAttachment(data)
}

async function dbArchiveAttachment(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('master_document_attachments')
    .update({ archived: true })
    .eq('id', id)
    .select('id, archived')
    .single()
  if (error) { console.error('archiveAttachment DB error:', error.message); return false }
  return data?.archived === true
}

async function dbRestoreAttachment(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('master_document_attachments')
    .update({ archived: false })
    .eq('id', id)
    .select('id, archived')
    .single()
  if (error) { console.error('restoreAttachment DB error:', error.message); return false }
  return data?.archived === false
}

// ── File-type helpers ──────────────────────────────────────────────────────
function fileInfo(name: string) {
  if (name.match(/\.pdf$/i))
    return { icon: '📕', label: 'PDF',  color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    badgeCls: 'bg-red-100 text-red-700'      }
  if (name.match(/\.docx?$/i))
    return { icon: '📘', label: 'DOCX', color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   badgeCls: 'bg-blue-100 text-blue-700'    }
  if (name.match(/\.xlsx?$/i))
    return { icon: '📗', label: 'XLSX', color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200',  badgeCls: 'bg-green-100 text-green-700'  }
  if (name.match(/\.(jpg|jpeg|png|webp)$/i))
    return { icon: '🖼️', label: 'IMG',  color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', badgeCls: 'bg-violet-100 text-violet-700' }
  return   { icon: '📄', label: 'FILE', color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200',  badgeCls: 'bg-slate-100 text-slate-600'  }
}

// ── Flatten doc tree ───────────────────────────────────────────────────────
interface FlatNode { doc: DocWithUrl; depth: number }
function flattenDocs(docs: DocWithUrl[], depth = 0): FlatNode[] {
  return docs.flatMap(doc => [
    { doc, depth },
    ...(doc.children ? flattenDocs(doc.children as DocWithUrl[], depth + 1) : []),
  ])
}

// ══════════════════════════════════════════════════════════════════════════
// Inline File Viewer Modal
// ══════════════════════════════════════════════════════════════════════════
function InlineFileViewerModal({
  fileUrl, fileName, open, onClose,
}: { fileUrl: string; fileName: string; open: boolean; onClose: () => void }) {
  const isPDF   = !!fileUrl.match(/\.pdf(\?|$)/i)
  const isImage = !!fileUrl.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)
  const fi      = fileInfo(fileName)
  return (
    <Modal open={open} onClose={onClose} title={`Viewing: ${fileName}`} width="max-w-5xl">
      <div className="flex flex-col" style={{ maxHeight: '85vh' }}>
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg flex-shrink-0">{fi.icon}</span>
            <p className="text-xs font-semibold text-slate-700 truncate max-w-sm">{fileName}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
            <a href={fileUrl} download className="text-[11px] font-semibold px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition flex items-center gap-1">
              ⬇ Download
            </a>
            <Button variant="outline" size="sm" onClick={onClose}>✕ Close</Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 min-h-0" style={{ minHeight: 400 }}>
          {isPDF ? (
            <iframe src={fileUrl} title={fileName} className="w-full border-0" style={{ height: '75vh', minHeight: 400 }} />
          ) : isImage ? (
            <div className="flex items-center justify-center p-6 min-h-96">
              <img src={fileUrl} alt={fileName} className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md border border-slate-200 bg-white" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
              <span className="text-6xl mb-4">{fi.icon}</span>
              <p className="text-sm font-semibold text-slate-700 mb-1 break-all">{fileName}</p>
              <p className="text-xs text-slate-400 mb-5 max-w-xs">Preview not available. Download to view the file.</p>
              <a href={fileUrl} download className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition">
                ⬇ Download to view
              </a>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Forward Modal
// ══════════════════════════════════════════════════════════════════════════
function ForwardModal({ doc, open, onClose }: { doc: DocWithUrl | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const [recipient, setRecipient] = useState('')
  const [remarks,   setRemarks]   = useState('')
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
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Forward To <span className="text-red-500">*</span></label>
          <select className={cls} value={recipient} onChange={e => setRecipient(e.target.value)}>
            <option value="">Select recipient…</option>
            <option>P/Col. Ramon Dela Cruz — Provincial Director</option>
            <option>P/Capt. Sara Yap — PCADU Unit Chief</option>
            <option>P/Capt. Jun Santos — PDMU Unit Chief</option>
            <option>P/Maj. Dan Lim — PPPU Unit Chief</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Remarks / Instructions</label>
          <textarea rows={3} className={`${cls} resize-none`} placeholder="Add any instructions or remarks…" value={remarks} onChange={e => setRemarks(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>➡ Forward</Button>
        </div>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Edit Modal
// ══════════════════════════════════════════════════════════════════════════
function EditModal({ doc, open, onClose, onSave }: {
  doc: DocWithUrl | null; open: boolean; onClose: () => void
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
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Document Title <span className="text-red-500">*</span></label>
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

// ══════════════════════════════════════════════════════════════════════════
// IMPROVED Breadcrumb Component
// ══════════════════════════════════════════════════════════════════════════
function Breadcrumb({
  navStack,
  onNavigateTo,
}: {
  navStack: NavEntry[]
  onNavigateTo: (index: number) => void
}) {
  if (navStack.length <= 1) return null

  return (
    <div className="flex items-center gap-0 flex-wrap mb-4 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl">
      {/* Home icon for root */}
      <span className="text-slate-400 mr-1 text-sm">🗂</span>
      {navStack.map((entry, i) => {
        const label = entry.kind === 'doc' ? entry.doc.title : entry.att.file_name
        const isLast = i === navStack.length - 1
        const fi = entry.kind === 'attachment' ? fileInfo(entry.att.file_name) : null

        return (
          <span key={i} className="flex items-center">
            {i > 0 && (
              <span className="mx-1.5 text-slate-400 font-bold text-sm select-none">›</span>
            )}
            {isLast ? (
              /* Current location — bold and clearly highlighted */
              <span
                className="flex items-center gap-1 text-[13px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg"
                title={label}
              >
                {fi && <span className="text-sm">{fi.icon}</span>}
                <span className="truncate max-w-[180px]">{label.length > 28 ? label.slice(0, 27) + '…' : label}</span>
              </span>
            ) : (
              /* Ancestor — clearly clickable link */
              <button
                onClick={() => onNavigateTo(i)}
                className="flex items-center gap-1 text-[13px] font-semibold text-slate-600 hover:text-blue-700 hover:bg-white border border-transparent hover:border-blue-200 px-2 py-1 rounded-lg transition-all"
                title={`Go back to ${label}`}
              >
                {fi && <span className="text-sm">{fi.icon}</span>}
                <span className="truncate max-w-[140px]">{label.length > 20 ? label.slice(0, 19) + '…' : label}</span>
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// IMPROVED Attachments Table Panel
// ══════════════════════════════════════════════════════════════════════════
function AttachmentsTablePanel({
  navStack,
  currentEntry,
  attachments,
  allAttachments,
  onUpload,
  uploadingId,
  onForward,
  onEdit,
  onArchiveDoc,
  onViewFile,
  onArchiveAttachment,
  onRestoreAttachment,
  onDrillDown,
  onNavigateTo,
}: {
  navStack: NavEntry[]
  currentEntry: NavEntry
  attachments: DocAttachment[]
  allAttachments: Map<string, DocAttachment[]>
  onUpload: (parentDocId: string, parentAttId: string | null, files: FileList) => void
  uploadingId: string | null
  onForward: () => void
  onEdit: () => void
  onArchiveDoc: () => void
  onViewFile: (fileUrl: string, fileName: string) => void
  onArchiveAttachment: (att: DocAttachment) => void
  onRestoreAttachment: (att: DocAttachment) => void
  onDrillDown: (att: DocAttachment) => void
  onNavigateTo: (index: number) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showArchived, setShowArchived] = useState(false)

  const activeAttachments   = attachments.filter(a => !a.archived)
  const archivedAttachments = attachments.filter(a =>  a.archived)
  const displayed           = showArchived ? archivedAttachments : activeAttachments

  const isDrillDown = currentEntry.kind === 'attachment'
  const currentLabel = isDrillDown ? currentEntry.att.file_name : currentEntry.doc.title

  const rootDocId = navStack[0].kind === 'doc' ? navStack[0].doc.id : ''
  const parentAttId = isDrillDown ? currentEntry.att.id : null

  function childCount(attId: string): number {
    return (allAttachments.get(attId) ?? []).filter(a => !a.archived).length
  }

  const drillAtt = isDrillDown ? currentEntry.att : null
  const drillFi = drillAtt ? fileInfo(drillAtt.file_name) : null
  const typeIcon =
    !isDrillDown
      ? (currentEntry.doc.type === 'PDF'  ? '📕' :
         currentEntry.doc.type === 'DOCX' ? '📘' :
         currentEntry.doc.type === 'XLSX' ? '📗' : '🖼️')
      : (drillFi?.icon ?? '📄')

  return (
    <div className="animate-fade-up h-full flex flex-col">

      {/* ── IMPROVED Breadcrumb ── */}
      <Breadcrumb navStack={navStack} onNavigateTo={onNavigateTo} />

      {/* ── IMPROVED Back Button ── */}
      {navStack.length > 1 && (
        <button
          onClick={() => onNavigateTo(navStack.length - 2)}
          className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-white border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow-md self-start"
        >
          {/* Left arrow icon */}
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>
            Back to{' '}
            <span className="font-bold">
              {navStack.length >= 2
                ? (navStack[navStack.length - 2].kind === 'doc'
                    ? (navStack[navStack.length - 2] as { kind: 'doc'; doc: DocWithUrl }).doc.title
                    : (navStack[navStack.length - 2] as { kind: 'attachment'; att: DocAttachment }).att.file_name)
                : 'Documents'}
            </span>
          </span>
        </button>
      )}

      {/* Title + actions */}
      <div className="flex items-start justify-between mb-4 gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl flex-shrink-0">{typeIcon}</span>
            <h2 className="text-lg font-extrabold text-slate-800 leading-tight truncate">{currentLabel}</h2>
            {isDrillDown && (
              <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 inline-flex items-center gap-1">
                <Paperclip size={12} /> Nested File
              </span>
            )}
          </div>
          {isDrillDown && drillAtt && (
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                {drillFi?.label}
              </span>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                {drillAtt.file_size}
              </span>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                📅 {new Date(drillAtt.uploaded_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>
          )}
          {!isDrillDown && (
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium">📅 {currentEntry.doc.date}</span>
              <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium">{typeIcon} {currentEntry.doc.type} · {currentEntry.doc.size}</span>
              <Badge className="bg-blue-50 text-blue-700 border border-blue-200">{currentEntry.doc.tag}</Badge>
              <Badge className={levelBadgeClass(currentEntry.doc.level)}>{currentEntry.doc.level}</Badge>
            </div>
          )}
        </div>

        {!isDrillDown && (
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={onForward}>➡ Forward</Button>
            <Button variant="outline" size="sm" onClick={onEdit}>✏️ Edit</Button>
            <Button variant="danger"  size="sm" onClick={onArchiveDoc}>🗄️ Archive</Button>
          </div>
        )}

        {isDrillDown && drillAtt && (
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              onClick={() => onViewFile(drillAtt.file_url, drillAtt.file_name)}
              className="text-xs px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-semibold hover:bg-blue-100 transition"
            >
              👁 View File
            </button>
            <a href={drillAtt.file_url} download target="_blank" rel="noopener noreferrer"
              className="text-xs px-2.5 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg font-semibold hover:bg-slate-200 transition"
            >
              ⬇ Download
            </a>
            <button
              onClick={() => onArchiveAttachment(drillAtt)}
              className="text-xs px-2.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-semibold hover:bg-amber-100 transition"
            >
              🗄️ Archive
            </button>
          </div>
        )}
      </div>

      {/* Primary file preview strip (root doc only) */}
      {!isDrillDown && currentEntry.doc.fileUrl && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-lg flex-shrink-0">{typeIcon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-800 truncate">Primary file</p>
            <p className="text-xs text-blue-600 truncate">{currentEntry.doc.title}.{currentEntry.doc.type.toLowerCase()}</p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <a href={currentEntry.doc.fileUrl} download target="_blank" rel="noopener noreferrer"
              className="text-xs px-2.5 py-1 bg-white border border-blue-200 text-blue-700 rounded-md font-medium hover:bg-blue-100 transition">
              ⬇ Download
            </a>
            <button
              onClick={() => onViewFile(currentEntry.doc.fileUrl!, currentEntry.doc.title)}
              className="text-xs px-2.5 py-1 bg-white border border-blue-200 text-blue-700 rounded-md font-medium hover:bg-blue-100 transition"
            >
              👁 View
            </button>
          </div>
        </div>
      )}

      {/* Attachments card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex-1 flex flex-col min-h-0">

        {/* ── IMPROVED Toolbar with Active/Archived Tabs ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
              {isDrillDown ? 'Attachments' : 'Attachments'}
            </span>

            {/* IMPROVED Toggle Buttons — look like real tabs */}
            <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden bg-white shadow-sm">
              <button
                onClick={() => setShowArchived(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all ${
                  !showArchived
                    ? 'bg-blue-600 text-white shadow-inner'
                    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                  !showArchived ? 'bg-white/30 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {activeAttachments.length}
                </span>
                Active
              </button>
              <div className="w-px h-full bg-slate-300" />
              <button
                onClick={() => setShowArchived(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all ${
                  showArchived
                    ? 'bg-amber-500 text-white shadow-inner'
                    : 'bg-white text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                }`}
              >
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                  showArchived ? 'bg-white/30 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {archivedAttachments.length}
                </span>
                Archived
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {uploadingId && (
              <span className="flex items-center gap-1.5 text-xs text-blue-600 font-medium bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                <span className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin block" />
                Uploading…
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={e => {
                if (e.target.files && e.target.files.length > 0)
                  onUpload(rootDocId, parentAttId, e.target.files)
                e.target.value = ''
              }}
            />
            {!showArchived && (
              <Button variant="primary" size="sm" disabled={!!uploadingId}
                onClick={() => fileInputRef.current?.click()}>
                + Attach file
              </Button>
            )}
          </div>
        </div>

        {/* Body */}
        {displayed.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-14 px-6">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl mb-3">
                  {showArchived ? '🗄️' : isDrillDown ? <Paperclip size={16} /> : <FileText size={16} />}
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-1">
              {showArchived ? 'No archived attachments' : `No ${isDrillDown ? 'child ' : ''}attachments yet`}
            </p>
            <p className="text-xs text-slate-400 mb-4 max-w-xs">
              {showArchived
                ? 'Files you archive will appear here and can be restored.'
                : isDrillDown
                  ? 'Click + Attach file to add child files under this attachment.'
                  : 'Click + Attach file above to upload supporting documents.'}
            </p>
            {!showArchived && (
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                + Attach file
              </Button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">File name</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 w-[80px]">Type</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 w-[90px]">Size</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 w-[130px]">Uploaded</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 w-[90px]">By</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 w-[90px]">Children</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 w-[180px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(att => {
                  const fi = fileInfo(att.file_name)
                  const children = childCount(att.id)
                  return (
                    <tr key={att.id}
                      className={`border-b border-slate-100 transition-colors group ${
                        att.archived ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-blue-50/50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base flex-shrink-0 leading-none">{fi.icon}</span>
                          <button
                            disabled={att.archived}
                            onClick={() => !att.archived && onDrillDown(att)}
                            className={`text-sm font-semibold truncate max-w-[240px] text-left transition ${
                              att.archived
                                ? 'text-slate-400 line-through cursor-default'
                                : 'text-slate-800 hover:text-blue-600 hover:underline cursor-pointer'
                            }`}
                            title={att.archived ? att.file_name : `Click to explore ${att.file_name}`}
                          >
                            {att.file_name}
                          </button>
                          {!att.archived && (
                            <span className="flex-shrink-0 text-[9px] font-bold text-slate-300 group-hover:text-blue-400 transition">
                              ›
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${fi.badgeCls}`}>
                          {fi.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{att.file_size}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(att.uploaded_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{att.uploaded_by}</td>
                      <td className="px-4 py-3">
                        {!att.archived && children > 0 ? (
                          <button
                            onClick={() => onDrillDown(att)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full transition"
                          >
                            <Paperclip size={14} /> {children}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!att.archived ? (
                            <>
                              <button
                                onClick={() => onViewFile(att.file_url, att.file_name)}
                                className="text-[10px] font-semibold px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition"
                              >
                                👁 View
                              </button>
                              <a href={att.file_url} download target="_blank" rel="noopener noreferrer">
                                <button className="text-[10px] font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition">
                                  ⬇
                                </button>
                              </a>
                              <button
                                onClick={() => onDrillDown(att)}
                                className="text-[10px] font-semibold px-2 py-1 bg-violet-50 text-violet-700 border border-violet-200 rounded hover:bg-violet-100 transition"
                                title="Open & explore this file's attachments"
                              >
                                📂 Open
                              </button>
                              <button
                                onClick={() => onArchiveAttachment(att)}
                                className="text-[10px] font-semibold px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 transition"
                              >
                                🗄️
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => onRestoreAttachment(att)}
                              className="text-[10px] font-semibold px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 transition"
                            >
                              ↩ Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Left-panel tree node
// ══════════════════════════════════════════════════════════════════════════
function DocTreeNode({
  doc, depth, isSelected, onSelectDoc, attachmentsMap, uploadingId,
}: {
  doc: DocWithUrl
  depth: number
  isSelected: boolean
  onSelectDoc: (doc: DocWithUrl) => void
  attachmentsMap: Map<string, DocAttachment[]>
  uploadingId: string | null
}) {
  const activeCount = (attachmentsMap.get(doc.id) ?? []).filter(a => !a.archived && !a.parent_attachment_id).length
  const levelColor  =
    doc.level === 'REGIONAL'   ? '#3b63b8' :
    doc.level === 'PROVINCIAL' ? '#f59e0b' : '#10b981'
  const indentPx = depth * 16 + 8
  const rowWidth  = `calc(100% - ${indentPx + 8}px)`
  return (
    <div
      style={{ marginLeft: indentPx, width: rowWidth }}
      className={`flex items-center gap-1.5 pr-2 pl-2.5 py-2.5 rounded-lg mb-0.5 cursor-pointer transition ${
        isSelected ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
      }`}
      onClick={() => onSelectDoc(doc)}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isSelected ? 'opacity-70' : ''}`} style={{ background: levelColor }} />
      <span className="flex-1 truncate text-[13px] font-medium">{doc.title}</span>
      {activeCount > 0 && (
        <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
          isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
        }`}>
          <Paperclip size={13} /> {activeCount}
        </span>
      )}
      {uploadingId === doc.id && (
        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin block flex-shrink-0 opacity-70" />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════════════════
export default function MasterPage() {
  const { toast } = useToast()

  const [documents,      setDocuments]      = useState<DocWithUrl[]>([])
  const [query,          setQuery]          = useState('')
  const [levelFilter,    setLevel]          = useState<DocLevel | 'ALL'>('ALL')
  const [loading,        setLoading]        = useState(true)
  const [attachmentsMap, setAttachmentsMap] = useState<Map<string, DocAttachment[]>>(new Map())
  const [selection,      setSelection]      = useState<Selection | null>(null)
  const [uploadingId,    setUploadingId]    = useState<string | null>(null)
  const [archivingAtt,   setArchivingAtt]   = useState(false)

  const [navStack, setNavStack] = useState<NavEntry[]>([])

  const [viewerFile, setViewerFile] = useState<{ url: string; name: string } | null>(null)

  const archiveAttDisc = useDisclosure<DocAttachment>()
  const uploadModal    = useModal()
  const forwardModal   = useModal()
  const editModal      = useModal()
  const archiveDisc    = useDisclosure<string>()

  const currentEntry: NavEntry | null = navStack.length > 0 ? navStack[navStack.length - 1] : null

  const currentAttachments = useMemo((): DocAttachment[] => {
    if (!currentEntry) return []
    if (currentEntry.kind === 'doc') {
      return (attachmentsMap.get(currentEntry.doc.id) ?? []).filter(a => !a.parent_attachment_id)
    } else {
      return attachmentsMap.get(currentEntry.att.id) ?? []
    }
  }, [currentEntry, attachmentsMap])

  useEffect(() => {
    async function loadAll() {
      try {
        const [docs, archived] = await Promise.all([getMasterDocuments(), getArchivedDocs()])
        const archivedIds = new Set(
          (archived ?? [])
            .map((a: any) => String(a.id ?? ''))
            .filter((id: string) => id.startsWith('arc-md-'))
            .map((id: string) => id.replace('arc-md-', ''))
        )
        const activeDocs = docs.filter((d: DocWithUrl) => !archivedIds.has(d.id))
        setDocuments(activeDocs)

        const allIds = activeDocs.map((d: DocWithUrl) => d.id)
        if (allIds.length > 0) {
          const { data: allAtts, error } = await supabase
            .from('master_document_attachments')
            .select('*')
            .in('document_id', allIds)
            .order('uploaded_at', { ascending: true })

          if (error) {
            console.error('Failed to load attachments:', error.message)
          } else {
            const map = new Map<string, DocAttachment[]>()
            for (const row of (allAtts ?? [])) {
              const att = normaliseAttachment(row)
              const key = att.parent_attachment_id ?? att.document_id
              const list = map.get(key) ?? []
              list.push(att)
              map.set(key, list)
            }
            setAttachmentsMap(map)
          }
        }

        if (activeDocs.length > 0) {
          const firstDoc = activeDocs[0]
          setSelection({ kind: 'doc', doc: firstDoc })
          setNavStack([{ kind: 'doc', doc: firstDoc }])
        }
      } catch (err) {
        console.error('loadAll error:', err)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  function handleSelectDoc(doc: DocWithUrl) {
    setSelection({ kind: 'doc', doc })
    setNavStack([{ kind: 'doc', doc }])
  }

  function handleDrillDown(att: DocAttachment) {
    setNavStack(prev => [...prev, { kind: 'attachment', att }])
  }

  function handleNavigateTo(index: number) {
    setNavStack(prev => prev.slice(0, index + 1))
  }

  async function handleUpload(parentDocId: string, parentAttId: string | null, files: FileList) {
    setUploadingId(parentAttId ?? parentDocId)
    let count = 0
    for (const file of Array.from(files)) {
      const folder   = parentAttId ? `master-docs/attachments/${parentDocId}/nested/${parentAttId}` : `master-docs/attachments/${parentDocId}`
      const fileName = `${folder}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
      const { data: storageData, error: storageError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })
      if (storageError) { toast.error(`Failed to upload "${file.name}".`); continue }
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storageData.path)
      const ext    = file.name.split('.').pop()?.toUpperCase() ?? 'FILE'
      const newAtt = await dbAddAttachment({
        id:                   `att-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        document_id:          parentDocId,
        parent_attachment_id: parentAttId,
        file_name:            file.name,
        file_url:             urlData.publicUrl,
        file_size:            file.size < 1024 * 1024
                                ? `${(file.size / 1024).toFixed(1)} KB`
                                : `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        file_type:            ext,
        uploaded_by:          'Admin',
        archived:             false,
      })
      if (newAtt) {
        const mapKey = parentAttId ?? parentDocId
        setAttachmentsMap(prev => {
          const next = new Map(prev)
          next.set(mapKey, [...(next.get(mapKey) ?? []), newAtt])
          return next
        })
        count++
      }
    }
    if (count > 0) toast.success(`${count} file${count > 1 ? 's' : ''} attached.`)
    setUploadingId(null)
  }

  async function handleAdd(newDoc: DocWithUrl) {
    await addMasterDocument(newDoc)
    setDocuments(prev => [...prev, newDoc])
    setAttachmentsMap(prev => { const next = new Map(prev); next.set(newDoc.id, []); return next })
    setSelection({ kind: 'doc', doc: newDoc })
    setNavStack([{ kind: 'doc', doc: newDoc }])
  }

  async function handleSave(updated: DocWithUrl) {
    await updateMasterDocument(updated)
    setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d))
    if (selection?.doc.id === updated.id) {
      setSelection({ kind: 'doc', doc: updated })
      setNavStack(prev => prev.map(e => e.kind === 'doc' && e.doc.id === updated.id ? { kind: 'doc', doc: updated } : e))
    }
    toast.success('Document updated.')
    editModal.close()
  }

  async function handleArchiveDoc() {
    if (!selection) return
    const doc  = selection.doc
    const date = new Date().toISOString().split('T')[0]
    await addArchivedDoc({ id: `arc-md-${doc.id}`, title: doc.title, type: 'Master Document', archivedDate: date, archivedBy: 'Admin' })
    await archiveMasterDocument(doc.id)
    setDocuments(prev => prev.filter(d => d.id !== doc.id))
    setSelection(null)
    setNavStack([])
    toast.success('Document archived.')
    archiveDisc.close()
  }

  async function handleArchiveAttachment() {
    const att = archiveAttDisc.payload
    if (!att) return
    setArchivingAtt(true)
    try {
      const ok = await dbArchiveAttachment(att.id)
      if (!ok) {
        toast.error('Could not archive attachment — the database update failed.')
        return
      }
      const mapKey = att.parent_attachment_id ?? att.document_id
      setAttachmentsMap(prev => {
        const next = new Map(prev)
        const list = next.get(mapKey) ?? []
        next.set(mapKey, list.map(a => a.id === att.id ? { ...a, archived: true } : a))
        return next
      })
      toast.success(`"${att.file_name}" archived.`)
      archiveAttDisc.close()
      if (currentEntry?.kind === 'attachment' && currentEntry.att.id === att.id) {
        setNavStack(prev => prev.slice(0, -1))
      }
    } finally {
      setArchivingAtt(false)
    }
  }

  async function handleRestoreAttachment(att: DocAttachment) {
    const ok = await dbRestoreAttachment(att.id)
    if (!ok) { toast.error('Could not restore attachment.'); return }
    const mapKey = att.parent_attachment_id ?? att.document_id
    setAttachmentsMap(prev => {
      const next = new Map(prev)
      const list = next.get(mapKey) ?? []
      next.set(mapKey, list.map(a => a.id === att.id ? { ...a, archived: false } : a))
      return next
    })
    toast.success(`"${att.file_name}" restored.`)
  }

  const allFlat  = useMemo(() => flattenDocs(documents), [documents])
  const filtered = useMemo(() => allFlat.filter(({ doc }) => {
    const q = query.trim().toLowerCase()
    return (!q || doc.title.toLowerCase().includes(q)) &&
           (levelFilter === 'ALL' || doc.level === levelFilter)
  }), [allFlat, query, levelFilter])

  const activeDocForModals = selection?.doc ?? null

  return (
    <>
      <PageHeader title="Master Documents" />

      <div className="p-6 flex flex-col gap-5 flex-1" style={{ height: 'calc(100vh - 56px)' }}>

        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">

          {/* Toolbar */}
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
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

          {/* Split view */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* Left: document list */}
            <div className="flex-shrink-0 border-r border-slate-200 flex flex-col overflow-hidden" style={{ width: 280 }}>
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex-shrink-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 leading-none">
                  Documents · {filtered.length}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Click to view attachments</p>
              </div>

              <div className="flex-1 overflow-y-auto py-2 px-2">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filtered.length === 0 ? (
                  <EmptyState icon="📁" title="No documents" description="Upload your first document." />
                ) : (
                  filtered.map(({ doc, depth }) => (
                    <DocTreeNode
                      key={doc.id}
                      doc={doc}
                      depth={depth}
                      isSelected={selection?.doc.id === doc.id}
                      onSelectDoc={handleSelectDoc}
                      attachmentsMap={attachmentsMap}
                      uploadingId={uploadingId}
                    />
                  ))
                )}
              </div>

              {/* Legend */}
              <div className="px-4 py-3 border-t border-slate-100 space-y-1.5 flex-shrink-0">
                {[
                  { color: '#3b63b8', label: 'Regional' },
                  { color: '#f59e0b', label: 'Provincial' },
                  { color: '#10b981', label: 'Station' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }} />
                    <span className="text-[11px] text-slate-400">{l.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-1">
                  <span className="text-[11px] text-slate-400">📎 = top-level attachments</span>
                </div>
              </div>
            </div>

            {/* Right: attachment detail with drill-down */}
            <div className="flex-1 overflow-y-auto p-6">
              {!currentEntry ? (
                <div className="h-full flex items-center justify-center">
                  <EmptyState
                    icon="📄"
                    title="Select a document"
                    description="Click any document from the list on the left to view its attachments."
                    action={<Button variant="primary" size="sm" onClick={uploadModal.open}>+ Upload Document</Button>}
                  />
                </div>
              ) : (
                <AttachmentsTablePanel
                  navStack={navStack}
                  currentEntry={currentEntry}
                  attachments={currentAttachments}
                  allAttachments={attachmentsMap}
                  onUpload={handleUpload}
                  uploadingId={uploadingId}
                  onForward={forwardModal.open}
                  onEdit={editModal.open}
                  onArchiveDoc={() => selection && archiveDisc.open(selection.doc.title)}
                  onViewFile={(url, name) => setViewerFile({ url, name })}
                  onArchiveAttachment={att => archiveAttDisc.open(att)}
                  onRestoreAttachment={handleRestoreAttachment}
                  onDrillDown={handleDrillDown}
                  onNavigateTo={handleNavigateTo}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddDocumentModal open={uploadModal.isOpen}  onClose={uploadModal.close}  onAdd={handleAdd} />
      <ForwardModal     doc={activeDocForModals}    open={forwardModal.isOpen}   onClose={forwardModal.close} />
      <EditModal        doc={activeDocForModals}    open={editModal.isOpen}      onClose={editModal.close} onSave={handleSave} />

      {viewerFile && (
        <InlineFileViewerModal
          fileUrl={viewerFile.url}
          fileName={viewerFile.name}
          open={!!viewerFile}
          onClose={() => setViewerFile(null)}
        />
      )}

      <ConfirmDialog
        open={archiveDisc.isOpen}
        title="Archive Document"
        message={`Archive "${archiveDisc.payload}"? It will be moved to the Archive page and can be restored from there.`}
        confirmLabel="Archive"
        variant="danger"
        onConfirm={handleArchiveDoc}
        onCancel={archiveDisc.close}
      />

      <ConfirmDialog
        open={archiveAttDisc.isOpen}
        title="Archive Attachment"
        message={`Archive "${archiveAttDisc.payload?.file_name}"? It will be hidden from active view but can be restored at any time.`}
        confirmLabel={archivingAtt ? 'Archiving…' : 'Archive'}
        variant="primary"
        onConfirm={handleArchiveAttachment}
        onCancel={archiveAttDisc.close}
      />
    </>
  )
}