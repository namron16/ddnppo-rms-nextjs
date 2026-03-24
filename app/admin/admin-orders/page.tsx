'use client'
// app/admin/special-orders/page.tsx

import { useState, useEffect } from 'react'
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
import { getSpecialOrders, addSpecialOrder, deleteSpecialOrder } from '@/lib/data'
import { statusBadgeClass }     from '@/lib/utils'
import type { SpecialOrder }    from '@/types'

type SOWithUrl = SpecialOrder & { fileUrl?: string }

// ── View Modal ────────────────────────────────
function ViewSOModal({ so, open, onClose }: { so: SOWithUrl | null; open: boolean; onClose: () => void }) {
  if (!so) return null

  const fileIcon = so.fileUrl?.endsWith('.pdf') ? '📕'
    : so.fileUrl?.match(/\.docx?$/) ? '📘' : '📄'

  return (
    <Modal open={open} onClose={onClose} title="Special Order Details" width="max-w-2xl">
      <div className="p-6 space-y-5">

        {/* Header info */}
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
          <span className="text-xs text-slate-400">📎 {so.attachments} attachment(s)</span>
        </div>

        {/* File preview */}
        {so.fileUrl ? (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Attachment</span>
              <div className="flex gap-1.5">
                <a href={so.fileUrl} download target="_blank" rel="noopener noreferrer"
                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-medium transition">
                  ⬇ Download
                </a>
                <a href={so.fileUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-medium transition">
                  🔗 Open
                </a>
              </div>
            </div>
            {so.fileUrl.endsWith('.pdf') ? (
              <iframe src={so.fileUrl} className="w-full border-0" style={{ height: '400px' }} title={so.reference} />
            ) : so.fileUrl.match(/\.(jpg|jpeg|png|webp)$/i) ? (
              <img src={so.fileUrl} alt={so.reference} className="w-full max-h-96 object-contain p-4" />
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="text-4xl mb-3">{fileIcon}</span>
                <p className="text-sm text-slate-500 mb-3">Preview not available for this file type.</p>
                <a href={so.fileUrl} download
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
  const [orders, setOrders]     = useState<SOWithUrl[]>([])
  const [loading, setLoading]   = useState(true)
  const [statusFilter, setStatus] = useState('ALL')

  const newSOModal  = useModal()
  const viewDisc    = useDisclosure<SOWithUrl>()
  const deleteDisc  = useDisclosure<SOWithUrl>()

  const { query, setQuery, filtered: searched } = useSearch(orders, ['reference', 'subject'] as Array<keyof SOWithUrl>)
  const filtered = searched.filter(so => statusFilter === 'ALL' || so.status === statusFilter)

  // Load from Supabase on mount
  useEffect(() => {
    getSpecialOrders().then(data => {
      setOrders(data)
      setLoading(false)
    })
  }, [])

  // Add new SO
  async function handleAdd(newSO: SOWithUrl) {
    await addSpecialOrder(newSO)
    setOrders(prev => [newSO, ...prev])
  }

  // Delete SO
  async function handleDelete() {
    const so = deleteDisc.payload
    if (!so) return
    await deleteSpecialOrder(so.id)
    setOrders(prev => prev.filter(o => o.id !== so.id))
    toast.success(`"${so.reference}" deleted.`)
    deleteDisc.close()
  }

  return (
    <>
      <PageHeader title="Admin Orders" />

      <div className="p-8">
        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">

          {/* Toolbar */}
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
                      <td className="px-4 py-3.5 font-bold text-slate-800 text-sm">{so.reference}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-700">{so.subject}</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-medium px-2 py-1 rounded-full">
                          📅 {so.date}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-medium px-2 py-1 rounded-full">
                          📎 {so.attachments}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge className={statusBadgeClass(so.status)}>{so.status}</Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => viewDisc.open(so)}>👁</Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteDisc.open(so)}>🗑</Button>
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

      <ViewSOModal so={viewDisc.payload ?? null} open={viewDisc.isOpen} onClose={viewDisc.close} />

      <ConfirmDialog
        open={deleteDisc.isOpen}
        title="Delete Special Order"
        message={`Permanently delete "${deleteDisc.payload?.reference}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={deleteDisc.close}
      />
    </>
  )
}