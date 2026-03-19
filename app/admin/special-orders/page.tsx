'use client'
// app/admin/special-orders/page.tsx

import { useState } from 'react'
import { PageHeader }            from '@/components/ui/PageHeader'
import { Badge }                 from '@/components/ui/Badge'
import { Button }                from '@/components/ui/Button'
import { SearchInput }           from '@/components/ui/SearchInput'
import { EmptyState }            from '@/components/ui/EmptyState'
import { ConfirmDialog }         from '@/components/ui/ConfirmDialog'
import { ToolbarSelect }         from '@/components/ui/Toolbar'
import { AddSpecialOrderModal }  from '@/components/modals/AddSpecialOrderModal'
import { useSearch, useModal, useDisclosure } from '@/hooks'
import { useToast }              from '@/components/ui/Toast'
import { SPECIAL_ORDERS }        from '@/lib/data'
import { statusBadgeClass }      from '@/lib/utils'

export default function SpecialOrdersPage() {
  const { toast } = useToast()
  const newSOModal   = useModal()
  const deleteDisc   = useDisclosure<string>()
  const [statusFilter, setStatus] = useState('ALL')

  const { query, setQuery, filtered: searched } = useSearch(SPECIAL_ORDERS, ['reference', 'subject'])

  const filtered = searched.filter(so =>
    statusFilter === 'ALL' || so.status === statusFilter
  )

  return (
    <>
      <PageHeader title="Special Orders" />

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
            <ToolbarSelect>
              <option>All Years</option>
              <option>2024</option>
              <option>2023</option>
            </ToolbarSelect>
            <Button variant="primary" size="sm" className="ml-auto" onClick={newSOModal.open}>+ New SO</Button>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="📋" title="No special orders found" description="Try adjusting your filters." />
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
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-medium px-2 py-1 rounded-full">📅 {so.date}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-medium px-2 py-1 rounded-full">📎 {so.attachments}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge className={statusBadgeClass(so.status)}>{so.status}</Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" title="View">👁</Button>
                          <Button variant="ghost" size="sm" title="Edit">✏️</Button>
                          <Button variant="ghost" size="sm" title="More">⋯</Button>
                          <Button variant="ghost" size="sm" title="Delete" onClick={() => deleteDisc.open(so.reference)}>🗑</Button>
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

      <AddSpecialOrderModal open={newSOModal.isOpen} onClose={newSOModal.close} />

      <ConfirmDialog
        open={deleteDisc.isOpen}
        title="Delete Special Order"
        message={`Permanently delete "${deleteDisc.payload}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { toast.success('Special order deleted.'); deleteDisc.close() }}
        onCancel={deleteDisc.close}
      />
    </>
  )
}
