'use client'
// app/admin/admin-orders/page.tsx

import { useState, useEffect, useRef } from 'react'
import { PageHeader }           from '@/components/ui/PageHeader'
import { Badge }                from '@/components/ui/Badge'
import { Button }               from '@/components/ui/Button'
import { SearchInput }          from '@/components/ui/SearchInput'
import { EmptyState }           from '@/components/ui/EmptyState'
import { ConfirmDialog }        from '@/components/ui/ConfirmDialog'
import { ToolbarSelect }        from '@/components/ui/Toolbar'
import { Modal }                from '@/components/ui/Modal'
import { AddSpecialOrderModal } from '@/components/modals/AddSpecialOrderModal'
import { useSearch, useModal, useDisclosure } from '@/hooks'
import { useToast }             from '@/components/ui/Toast'
import {
  getSpecialOrders,
  addSpecialOrder,
  archiveSpecialOrder,
  addArchivedDoc,
  getArchivedDocs,
  addSpecialOrderAttachment,
  archiveSpecialOrderAttachment,
  renameSpecialOrderAttachment,
} from '@/lib/data'
import { supabase }             from '@/lib/supabase'

import { statusBadgeClass }     from '@/lib/utils'
import type { SpecialOrder }    from '@/types'

type SOWithUrl = SpecialOrder & { fileUrl?: string }

type SOAttachment = {
  id: string
  special_order_id: string
  file_name: string
  file_url: string
  file_size: string
  file_type: string
  uploaded_at: string
  uploaded_by: string
  archived: boolean
}

// ── View Modal ────────────────────────────────
function ViewSOModal({
  so,
  open,
  onClose,
  onAttach,
  onAttachUnderAttachment,
  onArchiveAttachment,
  onRenameAttachment,
  attachments,
  loadingAttachments,
  uploading,
  archivingId,
  renamingId,
}: {
  so: SOWithUrl | null
  open: boolean
  onClose: () => void
  onAttach: (soId: string, files: FileList) => Promise<void>
  onAttachUnderAttachment: (parent: SOAttachment, files: FileList) => Promise<void>
  onArchiveAttachment: (att: SOAttachment) => Promise<void>
  onRenameAttachment: (att: SOAttachment, newName: string) => Promise<boolean>
  attachments: SOAttachment[]
  loadingAttachments: boolean
  uploading: boolean
  archivingId: string | null
  renamingId: string | null
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const childFileInputRef = useRef<HTMLInputElement>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null)
  const [parentAttachment, setParentAttachment] = useState<SOAttachment | null>(null)

  useEffect(() => {
    if (!open) {
      setEditingId(null)
      setEditingName('')
      setPreviewFile(null)
      setParentAttachment(null)
    }
  }, [open])

  useEffect(() => {
    if (!open || !so) return

    const firstActiveAttachment = attachments.find(att => !att.archived)
    if (firstActiveAttachment) {
      setPreviewFile({
        url: firstActiveAttachment.file_url,
        name: firstActiveAttachment.file_name,
      })
      return
    }

    if (so.fileUrl) {
      setPreviewFile({
        url: so.fileUrl,
        name: `${so.reference} (Primary File)`,
      })
      return
    }

    setPreviewFile(null)
  }, [open, so, attachments])

  if (!so) return null

  const activeAttachments = attachments.filter(att => !att.archived)
  const archivedAttachments = attachments.filter(att => att.archived)
  const displayed = showArchived ? archivedAttachments : activeAttachments
  const previewUrl = previewFile?.url ?? null

  const isPdf = !!previewUrl?.match(/\.pdf(\?|$)/i)
  const isImage = !!previewUrl?.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)
  const fileIcon = isPdf ? '📕'
    : previewUrl?.match(/\.docx?(\?|$)/i) ? '📘' : '📄'

  return (
    <Modal open={open} onClose={onClose} title="Special Order Details" width="max-w-4xl">
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Reference</p>
            <p className="text-base font-bold text-slate-800">{so.reference}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Date</p>
            <p className="text-base font-bold text-slate-800">{so.date}</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Subject</p>
          <p className="text-sm font-semibold text-slate-800">{so.subject}</p>
        </div>

        <div className="flex items-center gap-3">
          <Badge className={statusBadgeClass(so.status)}>{so.status}</Badge>
          <span className="text-xs text-slate-400">📎 {activeAttachments.length} attachment(s)</span>
        </div>

        {previewUrl ? (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">File Preview</p>
                <p className="text-xs text-slate-600 truncate">{previewFile?.name}</p>
              </div>
              <div className="flex gap-1.5">
                <a href={previewUrl} download target="_blank" rel="noopener noreferrer"
                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-medium transition">
                  ⬇ Download
                </a>
              </div>
            </div>
            {isPdf ? (
              <iframe src={previewUrl} className="w-full border-0" style={{ height: '400px' }} title={previewFile?.name ?? so.reference} />
            ) : isImage ? (
              <img src={previewUrl} alt={previewFile?.name ?? so.reference} className="w-full max-h-96 object-contain p-4" />
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="text-4xl mb-3">{fileIcon}</span>
                <p className="text-sm text-slate-500 mb-3">Preview not available for this file type.</p>
                <a href={previewUrl} download
                  className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                  ⬇ Download to view
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <span className="text-3xl mb-2">📄</span>
            <p className="text-sm text-slate-400">No attachment uploaded for this order.</p>
          </div>
        )}

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Attachments</span>
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
              {uploading && (
                <span className="flex items-center gap-1.5 text-xs text-blue-600 font-medium bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                  <span className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin block" />
                  Uploading...
                </span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={e => {
                  if (so && e.target.files && e.target.files.length > 0) onAttach(so.id, e.target.files)
                  e.target.value = ''
                }}
              />
              <input
                ref={childFileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={e => {
                  if (parentAttachment && e.target.files && e.target.files.length > 0) {
                    onAttachUnderAttachment(parentAttachment, e.target.files)
                  }
                  e.target.value = ''
                  setParentAttachment(null)
                }}
              />
              {!showArchived && (
                <Button variant="primary" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  + Attach file
                </Button>
              )}
            </div>
          </div>

          {loadingAttachments ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">
              {showArchived ? 'No archived attachments.' : 'No active attachments yet.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {displayed.map(att => (
                <div key={att.id} className="px-4 py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 pr-2">
                    {editingId === att.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={async e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const renamed = await onRenameAttachment(att, editingName)
                              if (renamed) {
                                setEditingId(null)
                                setEditingName('')
                              }
                            }
                            if (e.key === 'Escape') {
                              setEditingId(null)
                              setEditingName('')
                            }
                          }}
                          className="w-full max-w-md px-2.5 py-1.5 text-sm border border-blue-300 bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                          disabled={renamingId === att.id}
                          autoFocus
                        />
                        <button
                          onClick={async () => {
                            const renamed = await onRenameAttachment(att, editingName)
                            if (renamed) {
                              setEditingId(null)
                              setEditingName('')
                            }
                          }}
                          disabled={renamingId === att.id}
                          className="text-xs px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md font-medium transition disabled:opacity-60"
                        >
                          {renamingId === att.id ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null)
                            setEditingName('')
                          }}
                          disabled={renamingId === att.id}
                          className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-medium transition disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (att.archived) return
                          setParentAttachment(att)
                          childFileInputRef.current?.click()
                        }}
                        className={`block w-full text-sm font-semibold text-left break-words leading-snug hover:underline ${att.archived ? 'text-slate-400 line-through hover:text-slate-500' : 'text-slate-700 hover:text-blue-700'}`}
                        title={att.archived ? 'Archived attachment' : 'Attach a child file under this attachment'}
                      >
                        {att.file_name}
                      </button>
                    )}
                    <p className="text-xs text-slate-400">
                      {att.file_size} • {new Date(att.uploaded_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5 flex-shrink-0 max-w-[55%]">
                    {!att.archived && (
                      <button
                        onClick={() => setPreviewFile({ url: att.file_url, name: att.file_name })}
                        className="text-xs px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md font-medium transition whitespace-nowrap"
                      >
                        👁 View here
                      </button>
                    )}
                    {!att.archived && (
                      <button
                        onClick={() => {
                          setParentAttachment(att)
                          childFileInputRef.current?.click()
                        }}
                        disabled={uploading}
                        className="text-xs px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md font-medium transition disabled:opacity-60 whitespace-nowrap"
                      >
                        + Sub-attach
                      </button>
                    )}
                    <a href={att.file_url} download target="_blank" rel="noopener noreferrer"
                      className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-medium transition whitespace-nowrap">
                      ⬇
                    </a>
                    {!att.archived && (
                      <button
                        onClick={() => {
                          setEditingId(att.id)
                          setEditingName(att.file_name)
                        }}
                        disabled={archivingId === att.id || renamingId === att.id}
                        className="text-xs px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md font-medium transition disabled:opacity-60 whitespace-nowrap"
                      >
                        ✏️ Rename
                      </button>
                    )}
                    {!att.archived && (
                      <button
                        onClick={() => onArchiveAttachment(att)}
                        disabled={archivingId === att.id || renamingId === att.id}
                        className="text-xs px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-md font-medium transition disabled:opacity-60 whitespace-nowrap"
                      >
                        {archivingId === att.id ? 'Archiving…' : '🗄️ Archive'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────
export default function SpecialOrdersPage() {
  const { toast }  = useToast()
  const [orders, setOrders]                  = useState<SOWithUrl[]>([])
  const [loading, setLoading]                = useState(true)
  const [statusFilter, setStatus]            = useState('ALL')
  const [attachmentsMap, setAttachmentsMap]  = useState<Map<string, SOAttachment[]>>(new Map())
  const [uploadingId, setUploadingId]        = useState<string | null>(null)
  const [archivingId, setArchivingId]        = useState<string | null>(null)
  const [renamingId, setRenamingId]          = useState<string | null>(null)

  const newSOModal  = useModal()
  const viewDisc    = useDisclosure<SOWithUrl>()
  const archiveDisc = useDisclosure<SOWithUrl>()

  const { query, setQuery, filtered: searched } = useSearch(orders, ['reference', 'subject'] as Array<keyof SOWithUrl>)
  const filtered = searched.filter(so => statusFilter === 'ALL' || so.status === statusFilter)

  useEffect(() => {
    async function loadAll() {
      try {
        const [data, archived] = await Promise.all([getSpecialOrders(), getArchivedDocs()])
        const archivedIds = new Set(
          (archived ?? [])
            .map((a: any) => String(a.id ?? ''))
            .filter((id: string) => id.startsWith('arc-so-'))
            .map((id: string) => id.replace('arc-so-', ''))
        )

        const activeOrders = data.filter(o => o.status !== 'ARCHIVED' && !archivedIds.has(o.id))
        setOrders(activeOrders)

        // Load all attachments upfront
        const allIds = activeOrders.map(o => o.id)
        if (allIds.length > 0) {
          const { data: allAtts, error } = await supabase
            .from('special_order_attachments')
            .select('*')
            .in('special_order_id', allIds)
            .order('uploaded_at', { ascending: true })

          if (error) {
            console.error('Failed to load attachments:', error.message)
          } else {
            const map = new Map<string, SOAttachment[]>()
            for (const row of (allAtts ?? [])) {
              const att = {
                id: row.id,
                special_order_id: row.special_order_id,
                file_name: row.file_name,
                file_url: row.file_url,
                file_size: row.file_size,
                file_type: row.file_type,
                uploaded_at: row.uploaded_at,
                uploaded_by: row.uploaded_by,
                archived: row.archived === true,
              }
              const list = map.get(row.special_order_id) ?? []
              list.push(att)
              map.set(row.special_order_id, list)
            }
            setAttachmentsMap(map)
          }
        }
      } catch (err) {
        console.error('loadAll error:', err)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  async function handleAdd(newSO: SOWithUrl) {
    await addSpecialOrder(newSO)
    setOrders(prev => [newSO, ...prev])
  }

  async function handleArchive() {
    const so = archiveDisc.payload
    if (!so) return

    const today = new Date().toISOString().split('T')[0]

    // Mark as ARCHIVED in the special_orders table
    await archiveSpecialOrder(so.id)

    // Add to archived_docs so the Archive page shows it
    await addArchivedDoc({
      id:           `arc-so-${so.id}`,
      title:        `${so.reference} – ${so.subject}`,
      type:         'Special Order',
      archivedDate: today,
      archivedBy:   'Admin',
    })

    // Remove from this page immediately
    setOrders(prev => prev.filter(o => o.id !== so.id))

    toast.success(`"${so.reference}" has been moved to the Archive.`)
    archiveDisc.close()
  }

  async function handleAttachFromView(soId: string, files: FileList) {
    setUploadingId(soId)

    try {
      let addedCount = 0

      for (const file of Array.from(files)) {
        const fileName = `special-orders/${soId}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`

        const { data: storageData, error: storageError } = await supabase.storage
          .from('documents')
          .upload(fileName, file, { cacheControl: '3600', upsert: false })

        if (storageError) {
          toast.error(`Failed to upload "${file.name}".`)
          continue
        }

        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(storageData.path)

        const ext = file.name.split('.').pop()?.toUpperCase() ?? 'FILE'
        const newAtt = await addSpecialOrderAttachment({
          id: `soa-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          special_order_id: soId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size < 1024 * 1024
            ? `${(file.size / 1024).toFixed(1)} KB`
            : `${(file.size / 1024 / 1024).toFixed(1)} MB`,
          file_type: ext,
          uploaded_by: 'Admin',
          archived: false,
        })

        if (!newAtt) {
          toast.error(`Failed to save "${file.name}".`)
          continue
        }

        setAttachmentsMap(prev => {
          const next = new Map(prev)
          const list = [...(next.get(soId) ?? []), newAtt]
          next.set(soId, list)
          return next
        })

        addedCount++
      }

      if (addedCount > 0) {
        setOrders(prev => prev.map(o => (
          o.id === soId
            ? { ...o, attachments: (o.attachments ?? 0) + addedCount }
            : o
        )))
        toast.success(`${addedCount} attachment${addedCount > 1 ? 's' : ''} saved.`)
      }
    } finally {
      setUploadingId(null)
    }
  }

  async function handleAttachUnderAttachmentFromView(parent: SOAttachment, files: FileList) {
    setUploadingId(parent.special_order_id)

    try {
      let addedCount = 0

      for (const file of Array.from(files)) {
        const fileName = `special-orders/${parent.special_order_id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`

        const { data: storageData, error: storageError } = await supabase.storage
          .from('documents')
          .upload(fileName, file, { cacheControl: '3600', upsert: false })

        if (storageError) {
          toast.error(`Failed to upload "${file.name}".`)
          continue
        }

        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(storageData.path)

        const ext = file.name.split('.').pop()?.toUpperCase() ?? 'FILE'
        const hierarchicalName = `${parent.file_name} -> ${file.name}`

        const newAtt = await addSpecialOrderAttachment({
          id: `soa-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          special_order_id: parent.special_order_id,
          file_name: hierarchicalName,
          file_url: urlData.publicUrl,
          file_size: file.size < 1024 * 1024
            ? `${(file.size / 1024).toFixed(1)} KB`
            : `${(file.size / 1024 / 1024).toFixed(1)} MB`,
          file_type: ext,
          uploaded_by: 'Admin',
          archived: false,
        })

        if (!newAtt) {
          toast.error(`Failed to save "${file.name}".`)
          continue
        }

        setAttachmentsMap(prev => {
          const next = new Map(prev)
          const list = [...(next.get(parent.special_order_id) ?? []), newAtt]
          next.set(parent.special_order_id, list)
          return next
        })

        addedCount++
      }

      if (addedCount > 0) {
        setOrders(prev => prev.map(o => (
          o.id === parent.special_order_id
            ? { ...o, attachments: (o.attachments ?? 0) + addedCount }
            : o
        )))
        toast.success(`${addedCount} child attachment${addedCount > 1 ? 's' : ''} added under "${parent.file_name}".`)
      }
    } finally {
      setUploadingId(null)
    }
  }

  async function handleArchiveAttachmentFromView(att: SOAttachment) {
    setArchivingId(att.id)

    try {
      await archiveSpecialOrderAttachment(att.id)

      // Keep archived record in map (same pattern as Master Documents)
      setAttachmentsMap(prev => {
        const next = new Map(prev)
        const list = (next.get(att.special_order_id) ?? []).map(a =>
          a.id === att.id ? { ...a, archived: true } : a
        )
        next.set(att.special_order_id, list)
        return next
      })

      // Keep primary file as-is; decrement active attachment count only
      setOrders(prev => prev.map(o => (
        o.id === att.special_order_id
          ? { ...o, attachments: Math.max(0, (o.attachments ?? 0) - 1) }
          : o
      )))

      toast.success('Attachment archived.')
    } finally {
      setArchivingId(null)
    }
  }

  async function handleRenameAttachmentFromView(att: SOAttachment, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed) {
      toast.error('File name cannot be empty.')
      return false
    }

    if (trimmed === att.file_name) return true

    setRenamingId(att.id)

    try {
      const renamed = await renameSpecialOrderAttachment(att.id, trimmed)
      if (!renamed) {
        toast.error('Failed to rename attachment.')
        return false
      }

      setAttachmentsMap(prev => {
        const next = new Map(prev)
        const list = (next.get(att.special_order_id) ?? []).map(a =>
          a.id === att.id ? { ...a, file_name: trimmed } : a
        )
        next.set(att.special_order_id, list)
        return next
      })

      toast.success('Attachment renamed.')
      return true
    } finally {
      setRenamingId(null)
    }
  }

  return (
    <>
      <PageHeader title="Admin Orders" />

      <div className="p-8">
        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">

          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50">
            <SearchInput value={query} onChange={setQuery} placeholder="Search special orders…" className="max-w-xs flex-1" />
            <ToolbarSelect onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value)}>
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </ToolbarSelect>
            <Button variant="primary" size="sm" className="ml-auto" onClick={newSOModal.open}>
              + New SO
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon="📋" title="No special orders found" description="Create your first special order to get started." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Reference', 'Subject', 'Date', 'Attachments', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(so => (
                    <tr key={so.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3.5 font-bold text-slate-800 text-sm">
                        <button
                          onClick={() => viewDisc.open(so)}
                          className="text-left hover:text-blue-700 hover:underline transition"
                          title="Open special order details"
                        >
                          {so.reference}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-700">
                        <button
                          onClick={() => viewDisc.open(so)}
                          className="text-left hover:text-blue-700 hover:underline transition"
                          title="Open special order details"
                        >
                          {so.subject}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-medium px-2 py-1 rounded-full">
                          📅 {so.date}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => viewDisc.open(so)}
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full transition ${so.attachments > 0 ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          title="View attachments"
                        >
                          📎 {so.attachments}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge className={statusBadgeClass(so.status)}>{so.status}</Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" title="View" onClick={() => viewDisc.open(so)}>👁</Button>
                          <Button variant="ghost" size="sm" title="Archive" onClick={() => archiveDisc.open(so)}>🗄️</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AddSpecialOrderModal open={newSOModal.isOpen} onClose={newSOModal.close} onAdd={handleAdd} />
      <ViewSOModal
        so={orders.find(o => o.id === viewDisc.payload?.id) ?? viewDisc.payload ?? null}
        open={viewDisc.isOpen}
        onClose={viewDisc.close}
        onAttach={handleAttachFromView}
        onAttachUnderAttachment={handleAttachUnderAttachmentFromView}
        onArchiveAttachment={handleArchiveAttachmentFromView}
        onRenameAttachment={handleRenameAttachmentFromView}
        attachments={viewDisc.payload?.id ? (attachmentsMap.get(viewDisc.payload.id) ?? []) : []}
        loadingAttachments={false}
        uploading={uploadingId === viewDisc.payload?.id}
        archivingId={archivingId}
        renamingId={renamingId}
      />

      <ConfirmDialog
        open={archiveDisc.isOpen}
        title="Archive Special Order"
        message={`Archive "${archiveDisc.payload?.reference}"? It will be moved to the Archive and can be restored later.`}
        confirmLabel="Archive"
        variant="primary"
        onConfirm={handleArchive}
        onCancel={archiveDisc.close}
      />
    </>
  )
}