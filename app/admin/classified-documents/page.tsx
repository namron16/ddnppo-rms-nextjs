'use client'
// app/admin/daily-journal/page.tsx
// Renamed from "Classified Documents" → "Daily Journal"
// + Approval workflow panel for PD/DPDA/DPDO

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
import { ApprovalWorkflowModal }   from '../../../components/modals/ApprovalWorkflowModal'
import { BlurredDocumentGuard, ApprovalStatusBadge } from '../../../components/ui/BlurredDocumentGuard'
import { useSearch, useModal, useDisclosure } from '@/hooks'
import { useToast }                from '@/components/ui/Toast'
import { useAuth }                 from '@/lib/auth'
import { getConfidentialDocs, addConfidentialDoc, archiveConfidentialDoc, addArchivedDoc, getArchivedDocs } from '@/lib/data'
import { classificationBadgeClass } from '@/lib/utils'
import {
  createApproval,
  getApproval,
  getPendingApprovals,
  canAdminViewDocument,
  type DocumentApproval,
} from '@/lib/rbac'
import type { ConfidentialDoc } from '@/types'
import type { AdminRole } from '@/lib/auth'

type ConfDocWithUrl = ConfidentialDoc & { fileUrl?: string; passwordHash?: string; archived?: boolean }
type DocWithApproval = ConfDocWithUrl & { approval?: DocumentApproval | null; canView?: boolean }

const LOCAL_KEY = 'ddnppo_daily_journal_docs'

function loadLocalDocs(): ConfDocWithUrl[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') } catch { return [] }
}
function saveLocalDocs(docs: ConfDocWithUrl[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(docs)) } catch {}
}

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Unlock Modal ──────────────────────────────
function UnlockModal({ doc, open, onClose, onUnlocked }: {
  doc: ConfDocWithUrl | null; open: boolean; onClose: () => void
  onUnlocked: (doc: ConfDocWithUrl) => void
}) {
  const { toast } = useToast()
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [checking, setChecking] = useState(false)
  const [wrong, setWrong] = useState(false)

  async function submit() {
    if (!password || !doc) return
    setChecking(true); setWrong(false)
    const hash = await hashPassword(password)
    if (hash === doc.passwordHash) {
      toast.success('Document unlocked.')
      setPassword(''); setWrong(false)
      onUnlocked(doc); onClose()
    } else { setWrong(true); toast.error('Incorrect password.') }
    setChecking(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Unlock Daily Journal Entry" width="max-w-sm">
      <div className="p-6 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-xs text-amber-800 font-semibold mb-0.5">🔒 {doc?.title}</p>
          <p className="text-xs text-amber-700">Enter the document password to view.</p>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Password</label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              className={`w-full px-3 py-2.5 border-[1.5px] rounded-lg text-sm bg-slate-50 focus:outline-none transition pr-10 ${
                wrong ? 'border-red-400' : 'border-slate-200 focus:border-blue-500'
              }`}
              placeholder="Enter password…"
              value={password}
              onChange={e => { setPassword(e.target.value); setWrong(false) }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              disabled={checking}
            />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
              {show ? '🙈' : '👁'}
            </button>
          </div>
          {wrong && <p className="text-xs text-red-500 mt-1.5 font-medium">❌ Incorrect password.</p>}
        </div>
        <div className="flex justify-end gap-2.5">
          <Button variant="outline" onClick={onClose} disabled={checking}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={checking}>
            {checking ? 'Verifying…' : '🔓 Unlock'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────
export default function ClassifiedDocumentsPage() {
  const { toast } = useToast()
  const { user }  = useAuth()

  const [docs, setDocs]               = useState<DocWithApproval[]>([])
  const [loading, setLoading]         = useState(true)
  const [pendingApprovals, setPending] = useState<DocumentApproval[]>([])
  const [activeApproval, setActiveApproval] = useState<{
    docId: string; title: string; approval: DocumentApproval | null
  } | null>(null)

  const newModal    = useModal()
  const unlockDisc  = useDisclosure<ConfDocWithUrl>()
  const viewDisc    = useDisclosure<ConfDocWithUrl>()
  const archiveDisc = useDisclosure<ConfDocWithUrl>()
  const approvalModal = useModal()

  const { query, setQuery, filtered } = useSearch(docs, ['title'] as Array<keyof DocWithApproval>)

  const isReviewer   = user?.role === 'DPDA' || user?.role === 'DPDO'
  const isFinalApprover = user?.role === 'PD'
  const canUpload    = user?.role === 'P1'
  const isPrivileged = ['PD','DPDA','DPDO','P1'].includes(user?.role ?? '')

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
        const activeDocs = (remoteDocs as ConfDocWithUrl[]).filter(d => !d.archived && !archivedIds.has(d.id))

        // Load approvals and visibility for each doc
        const docsWithMeta: DocWithApproval[] = await Promise.all(
          activeDocs.map(async doc => {
            const [approval, canView] = await Promise.all([
              getApproval(doc.id, 'daily_journal'),
              user ? canAdminViewDocument(user.role as AdminRole, doc.id, 'daily_journal') : Promise.resolve(false),
            ])
            return { ...doc, approval, canView }
          })
        )
        setDocs(docsWithMeta)
        saveLocalDocs(activeDocs)

        // Load pending approvals for reviewers/PD
        if (isReviewer || isFinalApprover) {
          const pending = await getPendingApprovals(user!.role as AdminRole)
          setPending(pending.filter(a => a.document_type === 'daily_journal'))
        }
      } catch {
        const localDocs = loadLocalDocs().filter(d => !d.archived)
        setDocs(localDocs)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, isReviewer, isFinalApprover])

  async function handleAdd(newDoc: ConfDocWithUrl) {
    const updatedDocs = [{ ...newDoc, canView: true, approval: null }, ...docs]
    setDocs(updatedDocs)
    saveLocalDocs(updatedDocs)
    try {
      await addConfidentialDoc(newDoc)
      // Create approval record
      await createApproval(newDoc.id, 'daily_journal', newDoc.title)
    } catch {}
  }

  async function handleArchive() {
    const doc = archiveDisc.payload
    if (!doc) return
    const today = new Date().toISOString().split('T')[0]
    try { await archiveConfidentialDoc(doc.id) } catch {}
    await addArchivedDoc({ id: `arc-cd-${doc.id}`, title: doc.title, type: 'Daily Journal', archivedDate: today, archivedBy: user?.role ?? 'P1' })
    setDocs(prev => prev.filter(d => d.id !== doc.id))
    toast.success(`"${doc.title}" archived.`)
    archiveDisc.close()
  }

  return (
    <>
      <PageHeader title="Classified Documents" />

      <div className="p-8 space-y-5">

        {/* Pending approvals panel — visible to DPDA, DPDO, PD */}
        {(isReviewer || isFinalApprover) && pendingApprovals.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-amber-200 bg-amber-100">
              <span>📋</span>
              <p className="text-sm font-bold text-amber-800">
                {pendingApprovals.length} Classified Document{pendingApprovals.length === 1 ? '' : 's'} Awaiting Your Action
              </p>
            </div>
            <div className="divide-y divide-amber-100">
              {pendingApprovals.map(pa => {
                const doc = docs.find(d => d.id === pa.document_id)
                return (
                  <div key={pa.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{doc?.title ?? pa.document_id}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Status: <ApprovalStatusBadge approval={pa} compact />
                      </p>
                    </div>
                    <Button
                      variant="primary" size="sm"
                      onClick={() => {
                        setActiveApproval({ docId: pa.document_id, title: doc?.title ?? pa.document_id, approval: pa })
                        approvalModal.open()
                      }}
                    >
                      {isReviewer ? '👁 Review' : '✅ Final Approve'}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800">Classified Documents Entries</h2>
            {canUpload && (
              <Button variant="primary" size="sm" onClick={newModal.open}>+ Add Entry</Button>
            )}
          </div>

          <div className="px-6 pt-4 pb-2">
            <AlertWarning message="Classified Documents use a require per-document password authentication. All access is logged." />
          </div>

          <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
            <SearchInput value={query} onChange={setQuery} placeholder="Search classified documents…" className="max-w-xs" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon="📒" title="No classified documents found" description="Add your first classified document entry." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Document', 'Classification', 'Date', 'Approval', 'Access', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(doc => (
                    <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3.5">
                        <BlurredDocumentGuard
                          documentId={doc.id}
                          documentType="classified_document"
                          canView={doc.canView ?? isPrivileged}
                        >
                          <span className="mr-2">📒</span>
                          <span className="font-semibold text-sm text-slate-800">{doc.title}</span>
                        </BlurredDocumentGuard>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge className={classificationBadgeClass(doc.classification)}>{doc.classification}</Badge>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-500">{doc.date}</td>
                      <td className="px-4 py-3.5">
                        <ApprovalStatusBadge approval={doc.approval ?? null} compact />
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">{doc.access}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {/* Unlock — only if visible and approved */}
                          {(doc.canView || isPrivileged) && doc.approval?.status === 'approved' && (
                            <button onClick={() => unlockDisc.open(doc)}
                              className="bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-amber-200 transition">
                              🔓 Unlock
                            </button>
                          )}
                          {/* Approval action for PD/DPDA/DPDO */}
                          {(isReviewer || isFinalApprover) && doc.approval?.status !== 'approved' && (
                            <Button variant="outline" size="sm" onClick={() => {
                              setActiveApproval({ docId: doc.id, title: doc.title, approval: doc.approval ?? null })
                              approvalModal.open()
                            }}>
                              📋 Workflow
                            </Button>
                          )}
                          {/* Archive — P1 and PD only */}
                          {(canUpload || isFinalApprover) && (
                            <Button variant="ghost" size="sm" onClick={() => archiveDisc.open(doc)}>🗄️</Button>
                          )}
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
        onUnlocked={doc => viewDisc.open(doc)}
      />

      {activeApproval && (
        <ApprovalWorkflowModal
          open={approvalModal.isOpen}
          onClose={approvalModal.close}
          documentId={activeApproval.docId}
          documentType="daily_journal"
          documentTitle={activeApproval.title}
          approval={activeApproval.approval}
          onDone={() => {
            // Refresh docs
            setDocs(prev => prev.map(d => {
              if (d.id !== activeApproval.docId) return d
              return { ...d, approval: { ...d.approval!, status: 'approved' } as DocumentApproval }
            }))
          }}
        />
      )}

      <ConfirmDialog
        open={archiveDisc.isOpen}
        title="Archive Classified Document Entry"
        message={`Archive "${archiveDisc.payload?.title}"?`}
        confirmLabel="Archive"
        variant="primary"
        onConfirm={handleArchive}
        onCancel={archiveDisc.close}
      />
    </>
  )
}