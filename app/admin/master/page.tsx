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
  file_name: string
  file_url: string
  file_size: string
  file_type: string
  uploaded_at: string
  uploaded_by: string
}

type Selection =
  | { kind: 'doc';        doc: DocWithUrl }
  | { kind: 'attachment'; doc: DocWithUrl; attachment: DocAttachment }

// ── Supabase helpers ───────────────────────────────────────────────────────
async function addAttachment(att: Omit<DocAttachment, 'uploaded_at'>): Promise<DocAttachment | null> {
  const { data, error } = await supabase
    .from('master_document_attachments')
    .insert({ ...att, uploaded_at: new Date().toISOString() })
    .select()
    .single()
  if (error) { console.warn('add attachment error:', error.message); return null }
  return data
}

async function removeAttachment(id: string, fileUrl?: string): Promise<void> {
  if (fileUrl) {
    const path = fileUrl.split('/storage/v1/object/public/documents/')[1]
    if (path) await supabase.storage.from('documents').remove([path])
  }
  const { error } = await supabase
    .from('master_document_attachments')
    .delete()
    .eq('id', id)
  if (error) console.warn('delete attachment error:', error.message)
}

// ── File-type helpers ──────────────────────────────────────────────────────
function fileInfo(name: string) {
  if (name.match(/\.pdf$/i))                return { icon: '📕', label: 'PDF',  color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    badgeCls: 'bg-red-100 text-red-700'      }
  if (name.match(/\.docx?$/i))              return { icon: '📘', label: 'DOCX', color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   badgeCls: 'bg-blue-100 text-blue-700'    }
  if (name.match(/\.xlsx?$/i))              return { icon: '📗', label: 'XLSX', color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200',  badgeCls: 'bg-green-100 text-green-700'  }
  if (name.match(/\.(jpg|jpeg|png|webp)$/i)) return { icon: '🖼️', label: 'IMG', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', badgeCls: 'bg-violet-100 text-violet-700' }
  return { icon: '📄', label: 'FILE', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', badgeCls: 'bg-slate-100 text-slate-600' }
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
            <option>P/Maj. Ana Santos — PDMU</option>
            <option>P/Insp. Jose Reyes — PCADU</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Remarks / Instructions</label>
          <textarea rows={3} className={`${cls} resize-none`} placeholder="Add any instructions or remarks…"
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
// Attachments Table Panel (shown when a parent doc is selected)
// ══════════════════════════════════════════════════════════════════════════
function AttachmentsTablePanel({
  doc,
  attachments,
  onSelectAttachment,
  onUpload,
  uploadingId,
  onForward,
  onEdit,
  onArchive,
}: {
  doc: DocWithUrl
  attachments: DocAttachment[]
  onSelectAttachment: (doc: DocWithUrl, att: DocAttachment) => void
  onUpload: (docId: string, files: FileList) => void
  uploadingId: string | null
  onForward: () => void
  onEdit: () => void
  onArchive: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const pathLabel =
    doc.level === 'STATION'    ? 'Regional → Provincial → Station' :
    doc.level === 'PROVINCIAL' ? 'Regional → Provincial' : 'Regional'

  const typeIcon =
    doc.type === 'PDF'  ? '📕' :
    doc.type === 'DOCX' ? '📘' :
    doc.type === 'XLSX' ? '📗' : '🖼️'

  return (
    <div className="animate-fade-up h-full flex flex-col">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-400 flex items-center gap-1 mb-2 flex-wrap">
        {pathLabel.split(' → ').map((p, i, arr) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-300">→</span>}
            <span className={i === arr.length - 1 ? 'text-blue-600 font-medium' : ''}>{p}</span>
          </span>
        ))}
      </div>

      {/* Title + meta + actions row */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold text-slate-800 leading-tight truncate">{doc.title}</h2>
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">📅 {doc.date}</span>
            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{typeIcon} {doc.type} · {doc.size}</span>
            <Badge className="bg-blue-50 text-blue-700 border border-blue-200">{doc.tag}</Badge>
            <Badge className={levelBadgeClass(doc.level)}>{doc.level}</Badge>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onForward}>➡ Forward</Button>
          <Button variant="outline" size="sm" onClick={onEdit}>✏️ Edit</Button>
          <Button variant="danger"  size="sm" onClick={onArchive}>🗄️ Archive</Button>
        </div>
      </div>

      {/* Primary file quick-access (if doc has a direct fileUrl) */}
      {doc.fileUrl && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-lg flex-shrink-0">{typeIcon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-800 truncate">Primary file</p>
            <p className="text-xs text-blue-600 truncate">{doc.title}.{doc.type.toLowerCase()}</p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <a href={doc.fileUrl} download target="_blank" rel="noopener noreferrer"
              className="text-xs px-2.5 py-1 bg-white border border-blue-200 text-blue-700 rounded-md font-medium hover:bg-blue-100 transition">
              ⬇ Download
            </a>
            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs px-2.5 py-1 bg-white border border-blue-200 text-blue-700 rounded-md font-medium hover:bg-blue-100 transition">
              🔗 Open
            </a>
          </div>
        </div>
      )}

      {/* Attachments table card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex-1 flex flex-col min-h-0">

        {/* Table toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Attachments · {attachments.length}
          </span>
          <div className="flex items-center gap-2">
            {uploadingId === doc.id && (
              <span className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
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
                if (e.target.files && e.target.files.length > 0) {
                  onUpload(doc.id, e.target.files)
                }
                e.target.value = ''
              }}
            />
            <Button
              variant="primary"
              size="sm"
              disabled={uploadingId === doc.id}
              onClick={() => fileInputRef.current?.click()}
            >
              + Attach file
            </Button>
          </div>
        </div>

        {/* Empty state */}
        {attachments.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-14 px-6">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl mb-3">📂</div>
            <p className="text-sm font-semibold text-slate-600 mb-1">No attachments yet</p>
            <p className="text-xs text-slate-400 mb-4 max-w-xs">
              Click <strong>+ Attach file</strong> above to upload supporting documents to this record.
            </p>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              + Attach file
            </Button>
          </div>
        ) : (
          /* Attachments table */
          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">File name</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 w-[80px]">Type</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 w-[90px]">Size</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 w-[130px]">Uploaded</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 w-[90px]">By</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {attachments.map(att => {
                  const fi = fileInfo(att.file_name)
                  return (
                    <tr
                      key={att.id}
                      className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors group"
                      onClick={() => onSelectAttachment(doc, att)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base flex-shrink-0 leading-none">{fi.icon}</span>
                          <span className="text-sm font-semibold text-slate-800 truncate max-w-[280px]">
                            {att.file_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${fi.badgeCls}`}>
                          {fi.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{att.file_size}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(att.uploaded_at).toLocaleDateString('en-PH', {
                          year: 'numeric', month: 'short', day: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{att.uploaded_by}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={att.file_url} download target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" title="Download">⬇</Button>
                          </a>
                          <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" title="Open in tab">🔗</Button>
                          </a>
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
// Right panel — Attachment detail viewer (drill-down from table row click)
// ══════════════════════════════════════════════════════════════════════════
function AttachmentDetailPanel({ doc, attachment, onRemove, onBack }: {
  doc: DocWithUrl
  attachment: DocAttachment
  onRemove: (id: string) => void
  onBack: () => void
}) {
  const { toast }      = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const fi      = fileInfo(attachment.file_name)
  const isPDF   = !!attachment.file_url.match(/\.pdf(\?|$)/i)
  const isImage = !!attachment.file_url.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)

  async function handleRemove() {
    await removeAttachment(attachment.id, attachment.file_url)
    toast.success(`"${attachment.file_name}" removed.`)
    onRemove(attachment.id)
    setConfirmOpen(false)
  }

  return (
    <div className="animate-fade-up h-full flex flex-col">
      {/* Back button + breadcrumb */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg"
        >
          ← Back to attachments
        </button>
        <span className="text-xs text-slate-300">/</span>
        <span className="text-xs text-slate-500 font-medium truncate max-w-[200px]">{doc.title}</span>
        <span className="text-xs text-slate-300">/</span>
        <span className={`text-xs font-semibold ${fi.color} truncate max-w-[160px]`}>{attachment.file_name}</span>
      </div>

      {/* File header */}
      <div className="flex items-start gap-3 mb-4">
        <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl border text-2xl ${fi.bg} ${fi.border}`}>
          {fi.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-extrabold text-slate-800 leading-snug break-all">{attachment.file_name}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {attachment.file_size} · {attachment.file_type} · Uploaded{' '}
            {new Date(attachment.uploaded_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
            {' '}by {attachment.uploaded_by}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap mb-5">
        <a href={attachment.file_url} download target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">⬇ Download</Button>
        </a>
        <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">🔗 Open in Tab</Button>
        </a>
        <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>🗑 Remove</Button>
      </div>

      {/* Preview */}
      <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white flex-shrink-0">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">File Preview</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${fi.bg} ${fi.color} ${fi.border}`}>
            {fi.label}
          </span>
        </div>

        {isPDF ? (
          <iframe
            src={attachment.file_url}
            title={attachment.file_name}
            className="w-full border-0"
            style={{ height: '440px' }}
          />
        ) : isImage ? (
          <div className="flex items-center justify-center p-6" style={{ minHeight: '300px' }}>
            <img
              src={attachment.file_url}
              alt={attachment.file_name}
              className="max-w-full max-h-96 object-contain rounded-xl shadow border border-slate-200 bg-white"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <span className="text-6xl mb-4">{fi.icon}</span>
            <p className="text-sm font-semibold text-slate-700 mb-1 break-all">{attachment.file_name}</p>
            <p className="text-xs text-slate-400 mb-5 max-w-xs">Preview unavailable for this file type. Download it to view the contents.</p>
            <a href={attachment.file_url} download
              className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition">
              ⬇ Download to view
            </a>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Remove Attachment"
        message={`Permanently remove "${attachment.file_name}" from "${doc.title}"? This cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleRemove}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Left-panel tree node — one document + its expandable attachments
// ══════════════════════════════════════════════════════════════════════════
function DocTreeNode({
  doc, depth, selection, onSelectDoc,
  attachmentsMap, expandedDocs, toggleExpand, onUpload, uploadingId,
}: {
  doc: DocWithUrl
  depth: number
  selection: Selection | null
  onSelectDoc: (doc: DocWithUrl) => void
  attachmentsMap: Map<string, DocAttachment[]>
  expandedDocs: Set<string>
  toggleExpand: (id: string) => void
  onUpload: (docId: string, files: FileList) => void
  uploadingId: string | null
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachments  = attachmentsMap.get(doc.id) ?? []
  const isExpanded   = expandedDocs.has(doc.id)
  const isDocActive  = selection?.kind === 'doc' && selection.doc.id === doc.id
  const hasAttActive = selection?.kind === 'attachment' && selection.doc.id === doc.id

  const levelColor =
    doc.level === 'REGIONAL'   ? '#3b63b8' :
    doc.level === 'PROVINCIAL' ? '#f59e0b' : '#10b981'

  const indentPx = depth * 16 + 8
  const rowWidth = `calc(100% - ${indentPx + 8}px)`

  return (
    <div>
      {/* Document row */}
      <div
        style={{ marginLeft: indentPx, width: rowWidth }}
        className={`group flex items-center gap-1.5 pr-1.5 pl-2.5 py-2 rounded-lg mb-0.5 transition cursor-pointer ${
          isDocActive
            ? 'bg-blue-50 text-blue-700'
            : hasAttActive
            ? 'bg-blue-50/40 text-slate-700'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
        onClick={() => onSelectDoc(doc)}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={e => { e.stopPropagation(); toggleExpand(doc.id) }}
          className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-[11px] transition font-bold ${
            isDocActive || hasAttActive ? 'text-blue-500' : 'text-slate-400 hover:text-slate-700'
          }`}
          title={isExpanded ? 'Collapse attachments' : 'Expand attachments'}
        >
          {isExpanded ? '▾' : '▸'}
        </button>

        {/* Level indicator dot */}
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: levelColor }} />

        {/* Document title */}
        <span className={`flex-1 truncate text-[13px] ${isDocActive ? 'font-semibold' : 'font-medium'}`}>
          {doc.title}
        </span>

        {/* Attachment count badge */}
        {attachments.length > 0 && (
          <span
            onClick={e => { e.stopPropagation(); toggleExpand(doc.id) }}
            className={`flex-shrink-0 cursor-pointer text-[10px] font-bold px-1.5 py-0.5 rounded-full transition leading-none ${
              isDocActive || hasAttActive
                ? 'bg-blue-200 text-blue-800'
                : 'bg-slate-200 text-slate-500 group-hover:bg-slate-300'
            }`}
            title={`${attachments.length} attachment${attachments.length !== 1 ? 's' : ''}`}
          >
            📎{attachments.length}
          </span>
        )}

        {/* Add file button */}
        <button
          onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
          disabled={uploadingId === doc.id}
          title="Attach a file to this document"
          className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-sm transition ${
            uploadingId === doc.id
              ? 'opacity-70 cursor-not-allowed bg-blue-100 text-blue-500'
              : 'opacity-0 group-hover:opacity-100 bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
        >
          {uploadingId === doc.id
            ? <span className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin block" />
            : '+'}
        </button>
      </div>

      {/* Hidden file picker */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files.length > 0) {
            onUpload(doc.id, e.target.files)
            if (!expandedDocs.has(doc.id)) toggleExpand(doc.id)
          }
          e.target.value = ''
        }}
      />

      {/* Attachment sub-rows */}
      {isExpanded && (
        <div>
          {attachments.length === 0 ? (
            <div
              style={{ marginLeft: indentPx + 24, width: `calc(100% - ${indentPx + 32}px)` }}
              className="text-[11px] text-slate-400 italic py-1.5 pl-2"
            >
              No attachments — click + to add
            </div>
          ) : (
            attachments.map((att, idx) => {
              const fi       = fileInfo(att.file_name)
              const isActive =
                selection?.kind === 'attachment' && selection.attachment.id === att.id
              const attIndent = indentPx + 22
              const attWidth  = `calc(100% - ${attIndent + 8}px)`
              const isLast    = idx === attachments.length - 1

              return (
                <button
                  key={att.id}
                  onClick={() => {
                    // Clicking a tree attachment row goes straight to detail view
                    // We use a custom event here; parent handles via onSelectAttachment
                    const event = new CustomEvent('select-attachment', { detail: { doc, att } })
                    window.dispatchEvent(event)
                  }}
                  style={{ marginLeft: attIndent, width: attWidth }}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] mb-0.5 w-full text-left transition ${
                    isActive
                      ? `${fi.bg} ${fi.color} font-semibold border ${fi.border}`
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex-shrink-0 text-slate-300 text-[11px] font-mono leading-none select-none">
                    {isLast ? '└' : '├'}
                  </span>
                  <span className="flex-shrink-0 text-base leading-none">{fi.icon}</span>
                  <span className="truncate flex-1">{att.file_name}</span>
                  <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${fi.bg} ${fi.color} ${fi.border}`}>
                    {fi.label}
                  </span>
                  <span className="flex-shrink-0 text-[10px] text-slate-400 hidden xl:block">{att.file_size}</span>
                </button>
              )
            })
          )}
        </div>
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
  const [expandedDocs,   setExpandedDocs]   = useState<Set<string>>(new Set())
  const [selection,      setSelection]      = useState<Selection | null>(null)
  const [uploadingId,    setUploadingId]    = useState<string | null>(null)
  const [counts, setCounts] = useState({ specialOrders: 0, confidentialDocs: 0, registeredUsers: 0 })

  const uploadModal  = useModal()
  const forwardModal = useModal()
  const editModal    = useModal()
  const archiveDisc  = useDisclosure<string>()

  // Listen for attachment selections from tree nodes
  useEffect(() => {
    function handler(e: Event) {
      const { doc, att } = (e as CustomEvent).detail
      setSelection({ kind: 'attachment', doc, attachment: att })
    }
    window.addEventListener('select-attachment', handler)
    return () => window.removeEventListener('select-attachment', handler)
  }, [])

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadAll() {
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
        const { data: allAtts } = await supabase
          .from('master_document_attachments')
          .select('*')
          .in('document_id', allIds)
          .order('uploaded_at', { ascending: true })
        const map = new Map<string, DocAttachment[]>()
        for (const att of (allAtts ?? [])) {
          const list = map.get(att.document_id) ?? []
          list.push(att)
          map.set(att.document_id, list)
        }
        setAttachmentsMap(map)
      }

      if (activeDocs.length > 0) setSelection({ kind: 'doc', doc: activeDocs[0] })

      const [soRes, cdRes] = await Promise.all([
        supabase.from('special_orders').select('id', { count: 'exact', head: true }),
        supabase.from('confidential_docs').select('id', { count: 'exact', head: true }),
      ])
      setCounts({ specialOrders: soRes.count ?? 0, confidentialDocs: cdRes.count ?? 0, registeredUsers: 3 })
      setLoading(false)
    }
    loadAll()
  }, [])

  // ── Helpers ─────────────────────────────────────────────────────────────
  function toggleExpand(docId: string) {
    setExpandedDocs(prev => {
      const next = new Set(prev)
      next.has(docId) ? next.delete(docId) : next.add(docId)
      return next
    })
  }

  async function handleUpload(docId: string, files: FileList) {
    setUploadingId(docId)
    let count = 0
    for (const file of Array.from(files)) {
      const fileName = `master-docs/attachments/${docId}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
      const { data: storageData, error: storageError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })
      if (storageError) { toast.error(`Failed to upload "${file.name}".`); continue }
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storageData.path)
      const ext    = file.name.split('.').pop()?.toUpperCase() ?? 'FILE'
      const newAtt = await addAttachment({
        id:          `att-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        document_id: docId,
        file_name:   file.name,
        file_url:    urlData.publicUrl,
        file_size:   file.size < 1024 * 1024
                       ? `${(file.size / 1024).toFixed(1)} KB`
                       : `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        file_type:   ext,
        uploaded_by: 'Admin',
      })
      if (newAtt) {
        setAttachmentsMap(prev => {
          const next = new Map(prev)
          next.set(docId, [...(next.get(docId) ?? []), newAtt])
          return next
        })
        count++
      }
    }
    if (count > 0) toast.success(`${count} file${count > 1 ? 's' : ''} attached.`)
    setUploadingId(null)
  }

  function handleAttachmentRemoved(removedId: string) {
    setAttachmentsMap(prev => {
      const next = new Map(prev)
      for (const [docId, list] of next) {
        const filtered = list.filter(a => a.id !== removedId)
        if (filtered.length !== list.length) { next.set(docId, filtered); break }
      }
      return next
    })
    // Go back to parent doc view after removing
    if (selection?.kind === 'attachment' && selection.attachment.id === removedId) {
      setSelection({ kind: 'doc', doc: selection.doc })
    }
  }

  async function handleAdd(newDoc: DocWithUrl) {
    await addMasterDocument(newDoc)
    setDocuments(prev => [...prev, newDoc])
    setAttachmentsMap(prev => { const next = new Map(prev); next.set(newDoc.id, []); return next })
    setSelection({ kind: 'doc', doc: newDoc })
  }

  async function handleSave(updated: DocWithUrl) {
    await updateMasterDocument(updated)
    setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d))
    if (selection?.kind === 'doc' && selection.doc.id === updated.id)
      setSelection({ kind: 'doc', doc: updated })
    toast.success('Document updated successfully.')
    editModal.close()
  }

  async function handleArchive() {
    if (!selection || selection.kind !== 'doc') return
    const doc  = selection.doc
    const date = new Date().toISOString().split('T')[0]
    await addArchivedDoc({ id: `arc-md-${doc.id}`, title: doc.title, type: 'Master Document', archivedDate: date, archivedBy: 'Admin' })
    await archiveMasterDocument(doc.id)
    setDocuments(prev => prev.filter(d => d.id !== doc.id))
    setSelection(null)
    toast.success('Document archived.')
    archiveDisc.close()
  }

  // ── Filtered list ───────────────────────────────────────────────────────
  const allFlat  = useMemo(() => flattenDocs(documents), [documents])
  const filtered = useMemo(() => allFlat.filter(({ doc }) => {
    const q = query.trim().toLowerCase()
    return (!q || doc.title.toLowerCase().includes(q)) &&
           (levelFilter === 'ALL' || doc.level === levelFilter)
  }), [allFlat, query, levelFilter])

  const activeDoc = selection ? selection.doc : null

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <PageHeader title="Master Documents" />

      <div className="p-8 flex flex-col gap-6 flex-1">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard icon="📁" value={documents.length}        label="Master Documents"  bgColor="bg-blue-50" />
          <StatCard icon="📋" value={counts.specialOrders}    label="Admin Orders"       bgColor="bg-emerald-50" />
          <StatCard icon="🔒" value={counts.confidentialDocs} label="Confidential Docs"  bgColor="bg-amber-50" />
          <StatCard icon="👥" value={counts.registeredUsers}  label="Registered Users"   bgColor="bg-purple-50" />
        </div>

        {/* Main card */}
        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden flex-1 flex flex-col">

          {/* Toolbar */}
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

          {/* Split view */}
          <div className="flex flex-1 min-h-[480px] overflow-hidden">

            {/* ── Left panel: hierarchy tree ────────────────────────── */}
            <div
              className="flex-shrink-0 border-r border-slate-200 flex flex-col overflow-hidden"
              style={{ width: 300 }}
            >
              {/* Panel header */}
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex-shrink-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 leading-none">
                  Document Hierarchy · {filtered.length}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Click doc → view attachments table · ▸ expand inline
                </p>
              </div>

              {/* Tree */}
              <div className="flex-1 overflow-y-auto py-2">
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
                      selection={selection}
                      onSelectDoc={doc => setSelection({ kind: 'doc', doc })}
                      attachmentsMap={attachmentsMap}
                      expandedDocs={expandedDocs}
                      toggleExpand={toggleExpand}
                      onUpload={handleUpload}
                      uploadingId={uploadingId}
                    />
                  ))
                )}
              </div>

              {/* Level legend */}
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
              </div>
            </div>

            {/* ── Right panel ────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-7">
              {!selection ? (
                <div className="h-full flex items-center justify-center">
                  <EmptyState
                    icon="📄"
                    title="Nothing selected"
                    description="Select a document from the hierarchy on the left to view its attachments."
                    action={<Button variant="primary" size="sm" onClick={uploadModal.open}>+ Upload Document</Button>}
                  />
                </div>
              ) : selection.kind === 'doc' ? (
                /* Clicking a doc → show attachments table */
                <AttachmentsTablePanel
                  doc={selection.doc}
                  attachments={attachmentsMap.get(selection.doc.id) ?? []}
                  onSelectAttachment={(doc, att) => setSelection({ kind: 'attachment', doc, attachment: att })}
                  onUpload={handleUpload}
                  uploadingId={uploadingId}
                  onForward={forwardModal.open}
                  onEdit={editModal.open}
                  onArchive={() => archiveDisc.open(selection.doc.title)}
                />
              ) : (
                /* Clicking a table row → drill into single file preview */
                <AttachmentDetailPanel
                  doc={selection.doc}
                  attachment={selection.attachment}
                  onRemove={handleAttachmentRemoved}
                  onBack={() => setSelection({ kind: 'doc', doc: selection.doc })}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddDocumentModal open={uploadModal.isOpen} onClose={uploadModal.close} onAdd={handleAdd} />
      <ForwardModal doc={activeDoc} open={forwardModal.isOpen} onClose={forwardModal.close} />
      <EditModal    doc={activeDoc} open={editModal.isOpen}    onClose={editModal.close} onSave={handleSave} />

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