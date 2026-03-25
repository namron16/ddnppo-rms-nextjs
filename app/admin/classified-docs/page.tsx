'use client'
// app/admin/classified-docs/page.tsx

import { useState, useEffect } from 'react'
import { PageHeader }              from '@/components/ui/PageHeader'
import { Badge }                   from '@/components/ui/Badge'
import { Button }                  from '@/components/ui/Button'
import { AlertWarning }            from '@/components/ui/AlertWarning'
import { EmptyState }              from '@/components/ui/EmptyState'
import { ConfirmDialog }           from '@/components/ui/ConfirmDialog'
import { SearchInput }             from '@/components/ui/SearchInput'
import { Modal }                   from '@/components/ui/Modal'
import { AddConfidentialDocModal } from '@/components/modals/AddConfidentialDocModal'
import { useSearch, useModal, useDisclosure } from '@/hooks'
import { useToast }                from '@/components/ui/Toast'
import { getConfidentialDocs, addConfidentialDoc, archiveConfidentialDoc, addArchivedDoc, getArchivedDocs } from '@/lib/data'
import { classificationBadgeClass } from '@/lib/utils'
import type { ConfidentialDoc }    from '@/types'

type ConfDocWithUrl = ConfidentialDoc & { fileUrl?: string; passwordHash?: string; archived?: boolean }

// Ensure ConfidentialDoc type includes archived property by extending it
type ConfidentialDocExtended = ConfidentialDoc & { archived?: boolean }

const LOCAL_KEY = 'ddnppo_classified_docs'

function loadLocalDocs(): ConfDocWithUrl[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalDocs(docs: ConfDocWithUrl[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(docs))
  } catch {}
}

async function hashPassword(password: string): Promise<string> {
  const encoder    = new TextEncoder()
  const data       = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray  = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Unlock Modal ──────────────────────────────
function UnlockModal({ doc, open, onClose, onUnlocked }: {
  doc: ConfDocWithUrl | null
  open: boolean
  onClose: () => void
  onUnlocked: (doc: ConfDocWithUrl) => void
}) {
  const { toast }  = useToast()
  const [password, setPassword]   = useState('')
  const [show, setShow]           = useState(false)
  const [checking, setChecking]   = useState(false)
  const [wrongPass, setWrongPass] = useState(false)

  async function submit() {
    if (!password) { toast.error('Please enter the document password.'); return }
    if (!doc)      return
    setChecking(true)
    setWrongPass(false)
    const inputHash = await hashPassword(password)
    if (inputHash === doc.passwordHash) {
      toast.success('Document unlocked successfully.')
      setPassword('')
      setWrongPass(false)
      onUnlocked(doc)
      onClose()
    } else {
      setWrongPass(true)
      toast.error('Incorrect password. Access denied.')
    }
    setChecking(false)
  }

  function handleClose() {
    setPassword('')
    setWrongPass(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Unlock Document" width="max-w-sm">
      <div className="p-6 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-xs text-amber-800 font-semibold mb-0.5">🔒 {doc?.title}</p>
          <p className="text-xs text-amber-700">Enter the document password to view this file.</p>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Document Password
          </label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              className={`w-full px-3 py-2.5 border-[1.5px] rounded-lg text-sm bg-slate-50 focus:outline-none focus:bg-white transition pr-10 ${
                wrongPass ? 'border-red-400 focus:border-red-400' : 'border-slate-200 focus:border-blue-500'
              }`}
              placeholder="Enter password…"
              value={password}
              onChange={e => { setPassword(e.target.value); setWrongPass(false) }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              disabled={checking}
            />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
              {show ? '🙈' : '👁'}
            </button>
          </div>
          {wrongPass && (
            <p className="text-xs text-red-500 mt-1.5 font-medium">❌ Incorrect password. Please try again.</p>
          )}
        </div>
        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={handleClose} disabled={checking}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={checking}>
            {checking ? 'Verifying…' : '🔓 Unlock'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── View Modal ────────────────────────────────
function ViewDocModal({ doc, open, onClose }: {
  doc: ConfDocWithUrl | null
  open: boolean
  onClose: () => void
}) {
  if (!doc) return null
  const isPDF   = doc.fileUrl?.endsWith('.pdf')
  const isImage = doc.fileUrl?.match(/\.(jpg|jpeg|png|webp)$/i)

  return (
    <Modal open={open} onClose={onClose} title="Classified Document" width="max-w-4xl">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Title</p>
            <p className="text-sm font-bold text-slate-800">{doc.title}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Classification</p>
            <Badge className={classificationBadgeClass(doc.classification)}>{doc.classification}</Badge>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Date</p>
            <p className="text-sm font-bold text-slate-800">{doc.date}</p>
          </div>
        </div>
        {doc.fileUrl ? (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">🔒 Classified Document</span>
              <div className="flex gap-1.5">
                <a href={doc.fileUrl} download target="_blank" rel="noopener noreferrer"
                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-medium transition">
                  ⬇ Download
                </a>
                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-medium transition">
                  🔗 Open
                </a>
              </div>
            </div>
            {isPDF ? (
              <iframe src={doc.fileUrl} title={doc.title} className="w-full border-0" style={{ height: '500px' }} />
            ) : isImage ? (
              <img src={doc.fileUrl} alt={doc.title} className="w-full max-h-[500px] object-contain p-4" />
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="text-4xl mb-3">🔒</span>
                <p className="text-sm text-slate-500 mb-3">Preview not available for this file type.</p>
                <a href={doc.fileUrl} download
                  className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                  ⬇ Download to view
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <span className="text-3xl mb-2">🔒</span>
            <p className="text-sm text-slate-400">No file uploaded for this document.</p>
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────
export default function ConfidentialPage() {
  const { toast }  = useToast()
  const [docs, setDocs]       = useState<ConfDocWithUrl[]>([])
  const [loading, setLoading] = useState(true)

  const newModal    = useModal()
  const unlockDisc  = useDisclosure<ConfDocWithUrl>()
  const viewDisc    = useDisclosure<ConfDocWithUrl>()
  const archiveDisc = useDisclosure<ConfDocWithUrl>()

  const { query, setQuery, filtered } = useSearch(docs, ['title'] as Array<keyof ConfDocWithUrl>)

  useEffect(() => {
    async function load() {
      try {
        const [remoteDocs, archived] = await Promise.all([
          getConfidentialDocs(),
          getArchivedDocs(),
        ])
        const archivedIds = new Set(
          (archived ?? [])
            .map((a: any) => String(a.id ?? ''))
            .filter((id: string) => id.startsWith('arc-cd-'))
            .map((id: string) => id.replace('arc-cd-', ''))
        )

        if (remoteDocs.length > 0) {
          // Only show non-archived docs on this page
          const active = (remoteDocs as ConfDocWithUrl[]).filter(d => !d.archived && !archivedIds.has(d.id))
          setDocs(active)
          saveLocalDocs(active)
        } else {
          const localDocs = loadLocalDocs().filter(d => !d.archived)
          setDocs(localDocs)
        }
      } catch {
        const localDocs = loadLocalDocs().filter(d => !d.archived)
        setDocs(localDocs)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleAdd(newDoc: ConfDocWithUrl) {
    const updatedDocs = [newDoc, ...docs]
    setDocs(updatedDocs)
    saveLocalDocs(updatedDocs)
    try {
      await addConfidentialDoc(newDoc)
    } catch {}
  }

  function handleUnlocked(doc: ConfDocWithUrl) {
    viewDisc.open(doc)
  }

  async function handleArchive() {
    const doc = archiveDisc.payload
    if (!doc) return

    const today = new Date().toISOString().split('T')[0]

    // Mark archived in Supabase confidential_docs table
    try {
      await archiveConfidentialDoc(doc.id)
    } catch {}

    // Add to archived_docs so the Archive page shows it
    await addArchivedDoc({
      id:           `arc-cd-${doc.id}`,
      title:        doc.title,
      type:         'Classified Document',
      archivedDate: today,
      archivedBy:   'Admin',
    })

    // Remove from local list so it disappears from this page
    const updatedDocs = docs.filter(d => d.id !== doc.id)
    setDocs(updatedDocs)
    saveLocalDocs(updatedDocs)

    toast.success(`"${doc.title}" has been moved to the Archive.`)
    archiveDisc.close()
  }

  return (
    <>
      <PageHeader title="Classified Documents" />

      <div className="p-8">
        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">

          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800">Classified Documents</h2>
            <Button variant="primary" size="sm" onClick={newModal.open}>+ Add Classified Doc</Button>
          </div>

          <div className="px-6 pt-5 pb-2">
            <AlertWarning message="Classified documents require per-document password authentication. All access is logged." />
          </div>

          <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
            <SearchInput value={query} onChange={setQuery}
              placeholder="Search classified documents…" className="max-w-xs" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon="🔒" title="No classified documents found"
              description="Add your first classified document to get started." />
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
                          <button onClick={() => unlockDisc.open(doc)}
                            className="bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-amber-200 transition">
                            🔓 Unlock
                          </button>
                          <Button variant="ghost" size="sm" title="Archive" onClick={() => archiveDisc.open(doc)}>
                            🗄️
                          </Button>
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

      <AddConfidentialDocModal open={newModal.isOpen} onClose={newModal.close} onAdd={handleAdd} />

      <UnlockModal
        doc={unlockDisc.payload ?? null}
        open={unlockDisc.isOpen}
        onClose={unlockDisc.close}
        onUnlocked={handleUnlocked}
      />

      <ViewDocModal
        doc={viewDisc.payload ?? null}
        open={viewDisc.isOpen}
        onClose={viewDisc.close}
      />

      <ConfirmDialog
        open={archiveDisc.isOpen}
        title="Archive Classified Document"
        message={`Archive "${archiveDisc.payload?.title}"? It will be moved to the Archive and can be restored later.`}
        confirmLabel="Archive"
        variant="primary"
        onConfirm={handleArchive}
        onCancel={archiveDisc.close}
      />
    </>
  )
}