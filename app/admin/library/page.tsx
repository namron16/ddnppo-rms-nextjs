'use client'
// app/admin/library/page.tsx

import { useState }              from 'react'
import { PageHeader }            from '@/components/ui/PageHeader'
import { Badge }                 from '@/components/ui/Badge'
import { Button }                from '@/components/ui/Button'
import { SearchInput }           from '@/components/ui/SearchInput'
import { EmptyState }            from '@/components/ui/EmptyState'
import { ConfirmDialog }         from '@/components/ui/ConfirmDialog'
import { ToolbarSelect }         from '@/components/ui/Toolbar'
import { AddLibraryItemModal }   from '@/components/modals/AddLibraryItemModal'
import { useSearch, useModal, useDisclosure } from '@/hooks'
import { useToast }              from '@/components/ui/Toast'
import { LIBRARY_ITEMS }         from '@/lib/data'
import { libraryBadgeClass }     from '@/lib/utils'
import type { LibraryCategory }  from '@/types'

export default function LibraryPage() {
  const { toast }  = useToast()
  const newModal   = useModal()
  const deleteDisc = useDisclosure<string>()
  const [catFilter, setCat] = useState<LibraryCategory | 'ALL'>('ALL')
  const { query, setQuery, filtered: searched } = useSearch(LIBRARY_ITEMS, ['title'])
  const filtered = searched.filter(i => catFilter === 'ALL' || i.category === catFilter)

  return (
    <>
      <PageHeader title="E-Library" />

      <div className="p-8">
        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">

          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50">
            <SearchInput value={query} onChange={setQuery} placeholder="Search library…" className="max-w-xs flex-1" />
            <ToolbarSelect onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCat(e.target.value as LibraryCategory | 'ALL')}>
              <option value="ALL">All Categories</option>
              <option value="MANUAL">Manual</option>
              <option value="GUIDELINE">Guideline</option>
              <option value="TEMPLATE">Template</option>
            </ToolbarSelect>
            <Button variant="primary" size="sm" className="ml-auto" onClick={newModal.open}>+ Add to Library</Button>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="📚" title="No items found" description="Try a different search or category." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Title', 'Category', 'Size', 'Date Added', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3.5"><span className="mr-2">📗</span><span className="font-semibold text-sm text-slate-800">{item.title}</span></td>
                      <td className="px-4 py-3.5"><Badge className={libraryBadgeClass(item.category)}>{item.category}</Badge></td>
                      <td className="px-4 py-3.5 text-sm text-slate-500">{item.size}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-500">{item.dateAdded}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm">👁</Button>
                          <Button variant="ghost" size="sm" onClick={() => toast.success(`Downloading ${item.title}…`)}>⬇</Button>
                          <Button variant="ghost" size="sm">⋯</Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteDisc.open(item.title)}>🗑</Button>
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

      <AddLibraryItemModal open={newModal.isOpen} onClose={newModal.close} />
      <ConfirmDialog
        open={deleteDisc.isOpen}
        title="Remove from Library"
        message={`Remove "${deleteDisc.payload}" from the library?`}
        confirmLabel="Remove" variant="danger"
        onConfirm={() => { toast.success('Item removed.'); deleteDisc.close() }}
        onCancel={deleteDisc.close}
      />
    </>
  )
}
