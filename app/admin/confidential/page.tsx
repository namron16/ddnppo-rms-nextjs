'use client'
// app/admin/confidential/page.tsx

import { PageHeader }               from '@/components/ui/PageHeader'
import { Badge }                    from '@/components/ui/Badge'
import { Button }                   from '@/components/ui/Button'
import { AlertWarning }             from '@/components/ui/AlertWarning'
import { EmptyState }               from '@/components/ui/EmptyState'
import { ConfirmDialog }            from '@/components/ui/ConfirmDialog'
import { SearchInput }              from '@/components/ui/SearchInput'
import { AddConfidentialDocModal }  from '@/components/modals/AddConfidentialDocModal'
import { useSearch, useModal, useDisclosure } from '@/hooks'
import { useToast }                 from '@/components/ui/Toast'
import { CONFIDENTIAL_DOCS }        from '@/lib/data'
import { classificationBadgeClass } from '@/lib/utils'

export default function ConfidentialPage() {
  const { toast }  = useToast()
  const newModal   = useModal()
  const deleteDisc = useDisclosure<string>()
  const { query, setQuery, filtered } = useSearch(CONFIDENTIAL_DOCS, ['title'])

  return (
    <>
      <PageHeader title="Confidential Documents" />

      <div className="p-8">
        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">

          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800">Confidential Documents</h2>
            <Button variant="primary" size="sm" onClick={newModal.open}>+ Add Confidential Doc</Button>
          </div>

          <div className="px-6 pt-5 pb-2">
            <AlertWarning message="Confidential documents require per-document password authentication. All access is logged." />
          </div>

          <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
            <SearchInput value={query} onChange={setQuery} placeholder="Search confidential documents…" className="max-w-xs" />
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="🔒" title="No documents found" description="Try a different search term." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Document', 'Classification', 'Date', 'Access', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(doc => (
                    <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3.5">
                        <span className="mr-2">🔒</span>
                        <span className="font-semibold text-sm text-slate-800">{doc.title}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge className={classificationBadgeClass(doc.classification)}>{doc.classification}</Badge>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-500">{doc.date}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">{doc.access}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toast.info(`Enter password for "${doc.title}" to unlock.`)}
                            className="bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-amber-200 transition">
                            🔓 Unlock
                          </button>
                          <Button variant="ghost" size="sm">✏️</Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteDisc.open(doc.title)}>🗑</Button>
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

      <AddConfidentialDocModal open={newModal.isOpen} onClose={newModal.close} />
      <ConfirmDialog
        open={deleteDisc.isOpen}
        title="Delete Confidential Document"
        message={`Permanently delete "${deleteDisc.payload}"? This action cannot be undone.`}
        confirmLabel="Delete" variant="danger"
        onConfirm={() => { toast.success('Document deleted.'); deleteDisc.close() }}
        onCancel={deleteDisc.close}
      />
    </>
  )
}
