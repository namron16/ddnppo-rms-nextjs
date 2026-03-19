'use client'
// app/admin/archive/page.tsx

import { PageHeader }    from '@/components/ui/PageHeader'
import { Badge }         from '@/components/ui/Badge'
import { Button }        from '@/components/ui/Button'
import { SearchInput }   from '@/components/ui/SearchInput'
import { EmptyState }    from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ToolbarSelect } from '@/components/ui/Toolbar'
import { useSearch, useDisclosure } from '@/hooks'
import { useToast }      from '@/components/ui/Toast'

const ARCHIVED_ITEMS = [
  { id: 'a-1', title: 'SO No. 2023-244 – Promotion of Personnel', type: 'Special Order', archivedDate: '2024-01-15', archivedBy: 'P/Col. Dela Cruz' },
  { id: 'a-2', title: 'DDNPPO Compliance Report Q3 2023',         type: 'Master Document', archivedDate: '2023-12-20', archivedBy: 'P/Capt. Sara Yap' },
]

export default function ArchivePage() {
  const { toast }    = useToast()
  const restoreDisc  = useDisclosure<string>()
  const deleteDisc   = useDisclosure<string>()
  const { query, setQuery, filtered } = useSearch(ARCHIVED_ITEMS, ['title', 'archivedBy'])

  return (
    <>
      <PageHeader title="Archive" />

      <div className="p-8">
        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">

          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50">
            <SearchInput value={query} onChange={setQuery} placeholder="Search archived documents…" className="max-w-xs flex-1" />
            <ToolbarSelect>
              <option>All Types</option>
              <option>Special Order</option>
              <option>Master Document</option>
              <option>Daily Journal</option>
            </ToolbarSelect>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="🗄️" title="No archived documents found" description="Documents you archive will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Document', 'Type', 'Archived Date', 'Archived By', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3.5 font-semibold text-sm text-slate-800">{item.title}</td>
                      <td className="px-4 py-3.5"><Badge className="bg-slate-200 text-slate-500">{item.type}</Badge></td>
                      <td className="px-4 py-3.5 text-sm text-slate-500">{item.archivedDate}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">{item.archivedBy}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => restoreDisc.open(item.title)}>↩ Restore</Button>
                          <Button variant="ghost"   size="sm" onClick={() => deleteDisc.open(item.title)}>🗑</Button>
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

      <ConfirmDialog
        open={restoreDisc.isOpen}
        title="Restore Document"
        message={`Restore "${restoreDisc.payload}" to its original location?`}
        confirmLabel="Restore" variant="primary"
        onConfirm={() => { toast.success('Document restored successfully.'); restoreDisc.close() }}
        onCancel={restoreDisc.close}
      />
      <ConfirmDialog
        open={deleteDisc.isOpen}
        title="Permanently Delete"
        message={`Permanently delete "${deleteDisc.payload}"? This cannot be undone.`}
        confirmLabel="Delete Forever" variant="danger"
        onConfirm={() => { toast.success('Document permanently deleted.'); deleteDisc.close() }}
        onCancel={deleteDisc.close}
      />
    </>
  )
}
