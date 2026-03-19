'use client'
// app/admin/master/page.tsx
// Master Documents: stats, live search, hierarchy tree, detail panel, upload modal, confirm archive.

import { useState, useMemo } from 'react'
import { PageHeader }        from '@/components/ui/PageHeader'
import { StatCard }          from '@/components/ui/StatCard'
import { Badge }             from '@/components/ui/Badge'
import { Button }            from '@/components/ui/Button'
import { SearchInput }       from '@/components/ui/SearchInput'
import { ConfirmDialog }     from '@/components/ui/ConfirmDialog'
import { EmptyState }        from '@/components/ui/EmptyState'
import { ToolbarSelect }     from '@/components/ui/Toolbar'
import { AddDocumentModal }  from '@/components/modals/AddDocumentModal'
import { useModal, useDisclosure } from '@/hooks'
import { useToast }          from '@/components/ui/Toast'
import { MASTER_DOCUMENTS }  from '@/lib/data'
import { levelBadgeClass }   from '@/lib/utils'
import type { MasterDocument, DocLevel } from '@/types'

// ── Flatten tree ────────────────────────────
interface FlatNode { doc: MasterDocument; depth: number }
function flatten(docs: MasterDocument[], depth = 0): FlatNode[] {
  return docs.flatMap(doc => [
    { doc, depth },
    ...(doc.children ? flatten(doc.children, depth + 1) : []),
  ])
}
const ALL_FLAT = flatten(MASTER_DOCUMENTS)

// ── Detail Panel ────────────────────────────
function DocDetail({ doc }: { doc: MasterDocument }) {
  const { toast } = useToast()
  const archiveDisc = useDisclosure<string>()

  const pathLabel =
    doc.level === 'STATION'    ? 'Regional → Provincial → Station' :
    doc.level === 'PROVINCIAL' ? 'Regional → Provincial' : 'Regional'

  const pathParts = pathLabel.split(' → ')

  return (
    <div className="animate-fade-up">
      <div className="text-xs text-slate-400 flex items-center gap-1 mb-2">
        {pathParts.map((p, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span>→</span>}
            <span className={i === pathParts.length - 1 ? 'text-blue-600 font-medium' : ''}>{p}</span>
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
        <Button variant="outline" size="sm" onClick={() => { toast.success('Document forwarded.') }}>➡ Forward</Button>
        <Button variant="outline" size="sm">✏️ Edit</Button>
        <Button variant="outline" size="sm">📎 Attach</Button>
        <Button variant="danger"  size="sm" onClick={() => archiveDisc.open(doc.title)}>🗄️ Archive</Button>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-slate-400 text-sm italic leading-relaxed">
        [ Document Preview — {doc.title} ]
        <br /><br />
        <span className="text-xs text-slate-300 not-italic">
          In production this renders via PDF.js / Office Online / native image viewer.
        </span>
        <br /><br />
        <span className="text-xs not-italic text-slate-400">
          Ref: S1 | Uploaded: {doc.date} | Size: {doc.size}
        </span>
      </div>

      <ConfirmDialog
        open={archiveDisc.isOpen}
        title="Archive Document"
        message={`Archive "${archiveDisc.payload}"? You can restore it from the Archive page.`}
        confirmLabel="Archive"
        variant="danger"
        onConfirm={() => { toast.success('Document archived.'); archiveDisc.close() }}
        onCancel={archiveDisc.close}
      />
    </div>
  )
}

// ── Main Page ───────────────────────────────
export default function MasterPage() {
  const [selected, setSelected]   = useState<MasterDocument>(ALL_FLAT[0].doc)
  const [query, setQuery]         = useState('')
  const [levelFilter, setLevel]   = useState<DocLevel | 'ALL'>('ALL')
  const uploadModal = useModal()

  const filtered = useMemo(() => {
    return ALL_FLAT.filter(({ doc }) => {
      const matchesQuery = !query || doc.title.toLowerCase().includes(query.toLowerCase())
      const matchesLevel = levelFilter === 'ALL' || doc.level === levelFilter
      return matchesQuery && matchesLevel
    })
  }, [query, levelFilter])

  return (
    <>
      <PageHeader title="Master Documents" />

      <div className="p-8 flex flex-col gap-6 flex-1">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard icon="📁" value={7} label="Master Documents" bgColor="bg-blue-50" />
          <StatCard icon="📋" value={3} label="Special Orders"    bgColor="bg-emerald-50" />
          <StatCard icon="🔒" value={2} label="Confidential Docs" bgColor="bg-amber-50" />
          <StatCard icon="👥" value={3} label="Registered Users"  bgColor="bg-purple-50" />
        </div>

        {/* Panel */}
        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden flex-1 flex flex-col">

          {/* Toolbar */}
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search documents…"
              className="max-w-xs flex-1"
            />
            <ToolbarSelect
              defaultValue="ALL"
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setLevel(e.target.value as DocLevel | 'ALL')
              }
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

          {/* Split */}
          <div className="grid flex-1 min-h-[440px]" style={{ gridTemplateColumns: '280px 1fr' }}>

            {/* Tree */}
            <div className="border-r border-slate-200 overflow-y-auto py-4">
              <div className="px-4 pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Document Hierarchy · {filtered.length} DOCS
              </div>

              {filtered.length === 0 ? (
                <EmptyState icon="🔍" title="No results" description="Try a different search term or level filter." />
              ) : (
                filtered.map(({ doc, depth }) => (
                  <button
                    key={doc.id}
                    onClick={() => setSelected(doc)}
                    style={{ marginLeft: `${depth * 18 + 8}px`, width: `calc(100% - ${depth * 18 + 16}px)` }}
                    className={`text-left flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition mb-0.5 ${
                      selected.id === doc.id
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background:
                          doc.level === 'REGIONAL'   ? '#3b63b8' :
                          doc.level === 'PROVINCIAL' ? '#f59e0b' : '#10b981',
                      }}
                    />
                    <span className="truncate">{doc.title}</span>
                  </button>
                ))
              )}
            </div>

            {/* Detail */}
            <div className="p-7 overflow-y-auto">
              <DocDetail doc={selected} />
            </div>
          </div>
        </div>
      </div>

      <AddDocumentModal open={uploadModal.isOpen} onClose={uploadModal.close} />
    </>
  )
}
