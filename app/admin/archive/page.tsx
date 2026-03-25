'use client'
// app/admin/archive/page.tsx

<<<<<<< HEAD
import { useState, useEffect, useCallback } from 'react'
=======
import { useState, useEffect } from 'react'
>>>>>>> 95854486feda8436983777c16b1af8b447843777
import { PageHeader }    from '@/components/ui/PageHeader'
import { Badge }         from '@/components/ui/Badge'
import { Button }        from '@/components/ui/Button'
import { SearchInput }   from '@/components/ui/SearchInput'
import { EmptyState }    from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ToolbarSelect } from '@/components/ui/Toolbar'
import { useSearch, useDisclosure } from '@/hooks'
import { useToast }      from '@/components/ui/Toast'
<<<<<<< HEAD
import { getArchivedDocs, restoreArchivedDoc, deleteArchivedDoc } from '@/lib/data'

export default function ArchivePage() {
  const { toast }    = useToast()
  const restoreDisc  = useDisclosure<string>()
  const deleteDisc   = useDisclosure<string>()
  const [archivedItems, setArchivedItems] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { query, setQuery, filtered } = useSearch(archivedItems, ['title', 'archived_by'])

  const loadArchivedDocs = useCallback(async () => {
    try {
      console.log('📂 Loading archived documents...')
      setLoading(true)
      const docs = await getArchivedDocs()
      console.log('✅ Loaded archived documents:', docs.length, 'items')
      setArchivedItems(docs)
    } catch (err) {
      console.error('❌ Failed to load archived docs:', err)
      toast.error('Failed to load archived documents')
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Load on mount
  useEffect(() => {
    loadArchivedDocs()
  }, [loadArchivedDocs])

  // Poll for new archives every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadArchivedDocs()
    }, 3000)
    return () => clearInterval(interval)
  }, [loadArchivedDocs])

  async function handleRestore() {
    if (!selectedId) return
    try {
      await restoreArchivedDoc(selectedId)
      toast.success('Document restored successfully.')
      await loadArchivedDocs()
      restoreDisc.close()
    } catch (err) {
      toast.error('Failed to restore document.')
    }
  }

  async function handleDelete() {
    if (!selectedId) return
    try {
      await deleteArchivedDoc(selectedId)
      toast.success('Document permanently deleted.')
      await loadArchivedDocs()
      deleteDisc.close()
    } catch (err) {
      toast.error('Failed to delete document.')
    }
=======
import { getArchivedDocs, deleteArchivedDoc, restoreArchivedDoc } from '@/lib/data'

interface ArchivedItem {
  id: string
  title: string
  type: string
  archivedDate: string
  archivedBy: string
}

export default function ArchivePage() {
  const { toast }    = useToast()
  const [items, setItems]     = useState<ArchivedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setType] = useState('All Types')

  const restoreDisc  = useDisclosure<ArchivedItem>()
  const deleteDisc   = useDisclosure<ArchivedItem>()

  const { query, setQuery, filtered: searched } = useSearch(items, ['title', 'archivedBy'] as Array<keyof ArchivedItem>)
  const filtered = searched.filter(i => typeFilter === 'All Types' || i.type === typeFilter)

  useEffect(() => {
    getArchivedDocs().then(data => {
      const mapped: ArchivedItem[] = data.map((d: any) => ({
        id:           d.id,
        title:        d.title,
        type:         d.type,
        archivedDate: d.archived_date ?? d.archivedDate ?? '',
        archivedBy:   d.archived_by  ?? d.archivedBy  ?? 'Admin',
      }))
      setItems(mapped)
      setLoading(false)
    })
  }, [])

  async function handleRestore() {
    const item = restoreDisc.payload
    if (!item) return
    await restoreArchivedDoc(item.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
    toast.success(`"${item.title}" has been restored.`)
    restoreDisc.close()
  }

  async function handleDelete() {
    const item = deleteDisc.payload
    if (!item) return
    await deleteArchivedDoc(item.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
    toast.success(`"${item.title}" permanently deleted.`)
    deleteDisc.close()
>>>>>>> 95854486feda8436983777c16b1af8b447843777
  }

  return (
    <>
      <PageHeader title="Archive" />

      <div className="p-8">
        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">

          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50">
            <SearchInput value={query} onChange={setQuery} placeholder="Search archived documents…" className="max-w-xs flex-1" />
<<<<<<< HEAD
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setRefreshing(true)
                loadArchivedDocs().then(() => setRefreshing(false))
              }}
              disabled={refreshing}
            >
              {refreshing ? '⟳ Refreshing...' : '⟳ Refresh'}
            </Button>
            <ToolbarSelect>
              <option>All Types</option>
              <option>Special Order</option>
              <option>Confidential Document</option>
              <option>Master Document</option>
=======
            <ToolbarSelect onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setType(e.target.value)}>
              <option>All Types</option>
              <option>Special Order</option>
              <option>Classified Document</option>
              <option>Master Document</option>
              <option>Library Item</option>
>>>>>>> 95854486feda8436983777c16b1af8b447843777
            </ToolbarSelect>
          </div>

          {loading ? (
<<<<<<< HEAD
            <div className="px-6 py-8 text-center text-slate-500">Loading archived documents...</div>
=======
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
>>>>>>> 95854486feda8436983777c16b1af8b447843777
          ) : filtered.length === 0 ? (
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
                      <td className="px-4 py-3.5 text-sm text-slate-500">{item.archived_date}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">{item.archived_by}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
<<<<<<< HEAD
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setSelectedId(item.id)
                              restoreDisc.open(item.title)
                            }}
                          >
                            ↩ Restore
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setSelectedId(item.id)
                              deleteDisc.open(item.title)
                            }}
                          >
                            🗑
                          </Button>
=======
                          <Button variant="outline" size="sm" onClick={() => restoreDisc.open(item)}>↩ Restore</Button>
                          <Button variant="ghost"   size="sm" onClick={() => deleteDisc.open(item)}>🗑</Button>
>>>>>>> 95854486feda8436983777c16b1af8b447843777
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
        message={`Restore "${restoreDisc.payload?.title}" to its original location?`}
        confirmLabel="Restore" variant="primary"
        onConfirm={handleRestore}
        onCancel={restoreDisc.close}
      />
      <ConfirmDialog
        open={deleteDisc.isOpen}
        title="Permanently Delete"
        message={`Permanently delete "${deleteDisc.payload?.title}"? This cannot be undone.`}
        confirmLabel="Delete Forever" variant="danger"
        onConfirm={handleDelete}
        onCancel={deleteDisc.close}
      />
    </>
  )
}