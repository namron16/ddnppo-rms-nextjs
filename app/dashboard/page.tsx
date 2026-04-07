'use client'
// app/dashboard/page.tsx
// Officer dashboard: topbar, hero, quick-access cards, 6 live read-only modals.

import { Fragment, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth }   from '@/lib/auth'
import { Modal }     from '@/components/ui/Modal'
import { Badge }     from '@/components/ui/Badge'
import { Button }    from '@/components/ui/Button'
import { AlertWarning } from '@/components/ui/AlertWarning'
import { OrgChart }  from '@/components/ui/OrgChart'
import { EmptyState } from '@/components/ui/EmptyState'
import { Toolbar, ToolbarSelect } from '@/components/ui/Toolbar'
import { useToast } from '@/components/ui/Toast'
import {
  getMasterDocuments,
  getSpecialOrders,
  getConfidentialDocs,
  getLibraryItems,
  getArchivedDocs,
} from '@/lib/data'
import { supabase } from '@/lib/supabase'
import {
  levelBadgeClass, statusBadgeClass,
  classificationBadgeClass, libraryBadgeClass,
} from '@/lib/utils'
import type { OrgNode } from '@/types'

// ── Quick access card definition ──────────────────
type ModalKey = 'master' | 'so' | 'journal' | 'confidential' | 'library' | 'directory' | null

const CARDS: Array<{
  key: ModalKey
  icon: string
  title: string
  desc: string
}> = [
  { key: 'master',       icon: '📁', title: 'Master Documents',       desc: 'Regional, provincial & station documents' },
  { key: 'so',           icon: '📋', title: 'Administrative Orders',  desc: 'Designation, transfer, special & letter orders' },
  { key: 'journal',      icon: '📂', title: '201 File',               desc: 'Police personnel file' },
  { key: 'confidential', icon: '🔒', title: 'Classified Documents',   desc: 'Password-protected classified documents' },
  { key: 'library',      icon: '📚', title: 'e-Library',              desc: 'Memorandum circulars, SOPs, directives, relevant laws, rules & regulations' },
  { key: 'directory',    icon: '🏛️', title: 'Organization',          desc: 'Organizational structure & directory' },
]

type MasterView = {
  id: string
  title: string
  level: 'REGIONAL' | 'PROVINCIAL' | 'STATION'
  date: string
  fileUrl?: string
}

type OrderView = {
  id: string
  reference: string
  subject: string
  date: string
  status: 'ACTIVE' | 'ARCHIVED'
  fileUrl?: string
}

type Doc201View = {
  id: string
  label: string
  status: string
  dateUpdated: string
  person: string
  fileUrl?: string
}

type ClassifiedView = {
  id: string
  title: string
  classification: 'RESTRICTED' | 'CONFIDENTIAL'
  date: string
  access: string
  fileUrl?: string
  passwordHash?: string
}

type LibraryView = {
  id: string
  title: string
  category: 'MANUAL' | 'GUIDELINE' | 'TEMPLATE'
  size: string
  dateAdded: string
  fileUrl?: string
}

type AttachmentView = {
  id: string
  parentId: string
  parentAttachmentId?: string | null
  fileName: string
  fileUrl: string
  fileSize: string
  uploadedAt: string
  uploadedBy: string
  children?: AttachmentView[]
}

type OrgMemberRow = {
  id: string
  name: string
  rank: string | null
  position: string
  unit: string | null
  initials: string
  color: string
  parent_id: string | null
}

function makeInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function buildOrgTree(rows: OrgMemberRow[]): OrgNode | null {
  if (rows.length === 0) return null

  const byId = new Map<string, OrgNode>()
  const childrenByParent = new Map<string, OrgNode[]>()

  for (const row of rows) {
    byId.set(row.id, {
      id: row.id,
      initials: row.initials || makeInitials(row.name),
      rank: row.rank ?? '',
      name: row.name,
      title: row.position,
      unit: row.unit ?? '',
      color: row.color || '#3b63b8',
      children: [],
    })
  }

  const roots: OrgNode[] = []
  for (const row of rows) {
    const node = byId.get(row.id)
    if (!node) continue
    if (!row.parent_id || !byId.has(row.parent_id)) {
      roots.push(node)
      continue
    }
    const arr = childrenByParent.get(row.parent_id) ?? []
    arr.push(node)
    childrenByParent.set(row.parent_id, arr)
  }

  for (const [parentId, kids] of childrenByParent.entries()) {
    const parent = byId.get(parentId)
    if (parent) parent.children = kids
  }

  return roots[0] ?? null
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function fileInfo(name: string) {
  if (name.match(/\.pdf$/i)) return { icon: '📕' }
  if (name.match(/\.docx?$/i)) return { icon: '📘' }
  if (name.match(/\.xlsx?$/i)) return { icon: '📗' }
  if (name.match(/\.(jpg|jpeg|png|webp|gif)$/i)) return { icon: '🖼️' }
  return { icon: '📄' }
}

function InlineFileViewerModal({
  fileUrl,
  fileName,
  open,
  onClose,
}: {
  fileUrl: string
  fileName: string
  open: boolean
  onClose: () => void
}) {
  const isPDF = !!fileUrl.match(/\.pdf(\?|$)/i)
  const isImage = !!fileUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)
  const fi = fileInfo(fileName)

  return (
    <Modal open={open} onClose={onClose} title={`Viewing: ${fileName}`} width="max-w-5xl" zIndex={3000}>
      <div className="flex flex-col" style={{ maxHeight: '85vh' }}>
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg flex-shrink-0">{fi.icon}</span>
            <p className="text-xs font-semibold text-slate-700 truncate max-w-md">{fileName}</p>
          </div>
          <div className="flex items-center gap-1.5 ml-3">
            <a href={fileUrl} download className="text-[11px] font-semibold px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition">
              ⬇ Download
            </a>
            <Button variant="outline" size="sm" onClick={onClose}>✕ Close</Button>
          </div>
        </div>
        <div className="relative flex-1 overflow-auto bg-slate-100 min-h-0" style={{ minHeight: 420 }}>
          {isPDF ? (
            <iframe
              src={fileUrl}
              title={fileName}
              className="w-full border-0"
              style={{ height: '75vh', minHeight: 420 }}
            />
          ) : isImage ? (
            <div className="flex items-center justify-center p-6 min-h-96">
              <img
                src={fileUrl}
                alt={fileName}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md border border-slate-200 bg-white"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
              <span className="text-6xl mb-4">{fi.icon}</span>
              <p className="text-sm font-semibold text-slate-700 mb-1 break-all">{fileName}</p>
              <p className="text-xs text-slate-400 mb-5 max-w-xs">Preview not available. Download to view the file.</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function ClassifiedUnlockModal({
  open,
  doc,
  onClose,
  onUnlock,
}: {
  open: boolean
  doc: ClassifiedView | null
  onClose: () => void
  onUnlock: (doc: ClassifiedView) => void
}) {
  const { toast } = useToast()
  const [password, setPassword] = useState('')
  const [checking, setChecking] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [wrongPassword, setWrongPassword] = useState(false)

  useEffect(() => {
    if (!open) {
      setPassword('')
      setChecking(false)
      setShowPassword(false)
      setWrongPassword(false)
    }
  }, [open])

  async function submit() {
    if (!doc) return
    if (!password) {
      toast.error('Please enter the document password.')
      return
    }
    if (doc.access !== 'All w/ Password') {
      toast.warning('This classified document is restricted to admin-only access.')
      return
    }

    setChecking(true)
    setWrongPassword(false)
    try {
      const inputHash = await hashPassword(password)
      if (inputHash === doc.passwordHash) {
        toast.success('Document unlocked successfully.')
        onUnlock(doc)
        onClose()
      } else {
        setWrongPassword(true)
        toast.error('Incorrect password. Access denied.')
      }
    } finally {
      setChecking(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Unlock Classified Document" width="max-w-sm" zIndex={2500}>
      <div className="p-6 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-xs text-amber-800 font-semibold mb-0.5">🔒 {doc?.title}</p>
          <p className="text-xs text-amber-700">Enter the password set by the admin to view this file.</p>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Document Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className={`w-full px-3 py-2.5 border-[1.5px] rounded-lg text-sm bg-slate-50 focus:outline-none focus:bg-white transition pr-10 ${
                wrongPassword ? 'border-red-400 focus:border-red-400' : 'border-slate-200 focus:border-blue-500'
              }`}
              placeholder="Enter password…"
              value={password}
              onChange={e => { setPassword(e.target.value); setWrongPassword(false) }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              disabled={checking}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
          {wrongPassword && <p className="text-xs text-red-500 mt-1.5 font-medium">❌ Incorrect password. Please try again.</p>}
        </div>
        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose} disabled={checking}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={checking}>{checking ? 'Verifying…' : '🔓 Unlock'}</Button>
        </div>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════
export default function DashboardPage() {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [openModal, setOpenModal] = useState<ModalKey>(null)

  const [loading, setLoading] = useState(true)
  const [masterDocs, setMasterDocs] = useState<MasterView[]>([])
  const [orders, setOrders] = useState<OrderView[]>([])
  const [files201, setFiles201] = useState<Doc201View[]>([])
  const [classifiedDocs, setClassifiedDocs] = useState<ClassifiedView[]>([])
  const [libraryItems, setLibraryItems] = useState<LibraryView[]>([])
  const [orgRoot, setOrgRoot] = useState<OrgNode | null>(null)
  const [masterAttachmentsByDoc, setMasterAttachmentsByDoc] = useState<Record<string, AttachmentView[]>>({})
  const [orderAttachmentsByOrder, setOrderAttachmentsByOrder] = useState<Record<string, AttachmentView[]>>({})
  const [viewerFile, setViewerFile] = useState<{ url: string; name: string } | null>(null)
  const [classifiedUnlockDoc, setClassifiedUnlockDoc] = useState<ClassifiedView | null>(null)
  const [expandedMasterDocId, setExpandedMasterDocId] = useState<string | null>(null)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  function openViewer(url: string | undefined | null, name: string) {
    const cleanUrl = typeof url === 'string' ? url.trim() : ''
    if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
      toast.error('Attachment link is missing or invalid.')
      return
    }
    setViewerFile({ url: cleanUrl, name })
  }

  function renderOrderAttachments(nodes: AttachmentView[], depth = 0): JSX.Element[] {
    return nodes.flatMap(att => {
      const childCount = att.children?.length ?? 0
      const hasChildren = childCount > 0
      return [
        <div
          key={att.id}
          className="flex items-center gap-3 p-2 border border-slate-200 rounded-lg bg-white transition-colors duration-150 hover:border-blue-200 cursor-pointer pointer-events-auto"
          style={{ marginLeft: depth * 16 }}
          role="button"
          tabIndex={0}
          onClick={() => openViewer(att.fileUrl, att.fileName)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openViewer(att.fileUrl, att.fileName)
            }
          }}
        >
          <span className="text-sm">{depth > 0 ? '↳' : '📄'}</span>
          <span className="text-xs font-semibold text-slate-700 flex-1 truncate">{att.fileName}</span>
          <span className="text-[11px] text-slate-400">{att.fileSize}</span>
          <button
            type="button"
            className="inline-flex items-center justify-center px-2.5 py-1.5 text-xs font-semibold rounded-md bg-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
            onClick={e => {
              e.stopPropagation()
              openViewer(att.fileUrl, att.fileName)
            }}
          >
            👁
          </button>
        </div>,
        ...(hasChildren ? renderOrderAttachments(att.children ?? [], depth + 1) : []),
      ]
    })
  }

  function countOrderAttachments(nodes: AttachmentView[]): number {
    return nodes.reduce((total, att) => total + 1 + countOrderAttachments(att.children ?? []), 0)
  }

  useEffect(() => {
    async function loadLiveData() {
      setLoading(true)
      try {
        const [master, so, conf, library, archived] = await Promise.all([
          getMasterDocuments(),
          getSpecialOrders(),
          getConfidentialDocs(),
          getLibraryItems(),
          getArchivedDocs(),
        ])

        const archivedMaster = new Set(
          (archived ?? [])
            .map((a: any) => String(a.id ?? ''))
            .filter((id: string) => id.startsWith('arc-md-'))
            .map((id: string) => id.replace('arc-md-', ''))
        )
        const archivedSO = new Set(
          (archived ?? [])
            .map((a: any) => String(a.id ?? ''))
            .filter((id: string) => id.startsWith('arc-so-'))
            .map((id: string) => id.replace('arc-so-', ''))
        )
        const archivedConf = new Set(
          (archived ?? [])
            .map((a: any) => String(a.id ?? ''))
            .filter((id: string) => id.startsWith('arc-cd-'))
            .map((id: string) => id.replace('arc-cd-', ''))
        )
        const archivedLib = new Set(
          (archived ?? [])
            .map((a: any) => String(a.id ?? ''))
            .filter((id: string) => id.startsWith('arc-lib-'))
            .map((id: string) => id.replace('arc-lib-', ''))
        )

        setMasterDocs(
          master
            .filter((d: any) => !archivedMaster.has(d.id))
            .map((d: any) => ({ id: d.id, title: d.title, level: d.level, date: d.date, fileUrl: d.fileUrl }))
        )

        setOrders(
          so
            .filter((d: any) => d.status !== 'ARCHIVED' && !archivedSO.has(d.id))
            .map((d: any) => ({ id: d.id, reference: d.reference, subject: d.subject, date: d.date, status: d.status, fileUrl: d.fileUrl }))
        )

        setClassifiedDocs(
          conf
            .filter((d: any) => !d.archived && !archivedConf.has(d.id))
            .map((d: any) => ({
              id: d.id,
              title: d.title,
              classification: d.classification,
              date: d.date,
              access: d.access,
              fileUrl: d.fileUrl,
              passwordHash: d.passwordHash,
            }))
        )

        setLibraryItems(
          library
            .filter((d: any) => !archivedLib.has(d.id))
            .map((d: any) => ({
              id: d.id,
              title: d.title,
              category: d.category,
              size: d.size,
              dateAdded: d.dateAdded,
              fileUrl: d.fileUrl,
            }))
        )

        const [{ data: people }, { data: docs }, { data: orgRows }, { data: masterAtt }, { data: orderAtt }] = await Promise.all([
          supabase.from('personnel_201').select('id,name,rank'),
          supabase
            .from('personnel_201_docs')
            .select('id,personnel_id,label,status,date_updated,file_url')
            .not('file_url', 'is', null)
            .order('date_updated', { ascending: false }),
          supabase
            .from('org_members')
            .select('id,name,rank,position,unit,initials,color,parent_id')
            .order('created_at', { ascending: true }),
          supabase
            .from('master_document_attachments')
            .select('id,document_id,file_name,file_url,file_size,uploaded_at,uploaded_by,archived')
            .order('uploaded_at', { ascending: false }),
          supabase
            .from('special_order_attachments')
            .select('id,special_order_id,parent_attachment_id,file_name,file_url,file_size,uploaded_at,uploaded_by,archived')
            .order('uploaded_at', { ascending: false }),
        ])

        const personById = new Map<string, { name: string; rank: string | null }>()
        for (const p of people ?? []) {
          personById.set((p as any).id, { name: (p as any).name, rank: (p as any).rank ?? null })
        }

        setFiles201(
          (docs ?? []).map((d: any) => {
            const person = personById.get(d.personnel_id)
            return {
              id: d.id,
              label: d.label,
              status: d.status,
              dateUpdated: d.date_updated ?? '',
              person: person ? `${person.rank ? `${person.rank} ` : ''}${person.name}` : 'Personnel',
              fileUrl: d.file_url ?? undefined,
            }
          })
        )

        const nextMasterAtt: Record<string, AttachmentView[]> = {}
        for (const att of masterAtt ?? []) {
          const row = att as any
          if (row.archived === true) continue
          const list = nextMasterAtt[row.document_id] ?? []
          list.push({
            id: row.id,
            parentId: row.document_id,
            fileName: row.file_name,
            fileUrl: row.file_url,
            fileSize: row.file_size,
            uploadedAt: row.uploaded_at,
            uploadedBy: row.uploaded_by,
          })
          nextMasterAtt[row.document_id] = list
        }
        setMasterAttachmentsByDoc(nextMasterAtt)

        const nextOrderAtt: Record<string, AttachmentView[]> = {}
        const orderAttNodes = new Map<string, AttachmentView>()
        const orderAttRows = (orderAtt ?? [])
          .map((att: any) => ({
            id: att.id,
            specialOrderId: att.special_order_id,
            parentAttachmentId: att.parent_attachment_id ?? null,
            fileName: att.file_name,
            fileUrl: att.file_url,
            fileSize: att.file_size,
            uploadedAt: att.uploaded_at,
            uploadedBy: att.uploaded_by,
            archived: att.archived === true,
          }))
          .filter((row: any) => row.archived !== true && row.fileUrl)

        for (const row of orderAttRows) {
          orderAttNodes.set(row.id, {
            id: row.id,
            parentId: row.specialOrderId,
            parentAttachmentId: row.parentAttachmentId,
            fileName: row.fileName,
            fileUrl: row.fileUrl,
            fileSize: row.fileSize,
            uploadedAt: row.uploadedAt,
            uploadedBy: row.uploadedBy,
            children: [],
          })
        }

        for (const row of orderAttRows) {
          const node = orderAttNodes.get(row.id)
          if (!node) continue
          if (row.parentAttachmentId && orderAttNodes.has(row.parentAttachmentId)) {
            const parent = orderAttNodes.get(row.parentAttachmentId)!
            parent.children = parent.children ?? []
            parent.children.push(node)
            continue
          }

          const list = nextOrderAtt[row.specialOrderId] ?? []
          list.push(node)
          nextOrderAtt[row.specialOrderId] = list
        }
        setOrderAttachmentsByOrder(nextOrderAtt)

        setOrgRoot(buildOrgTree((orgRows ?? []) as OrgMemberRow[]))
      } finally {
        setLoading(false)
      }
    }

    loadLiveData()
  }, [])

  function handleLogout() {
    logout()
    router.push('/login')
  }

  const date = new Date().toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">

      {/* ── Topbar ── */}
      <div className="bg-white border-b border-slate-200 px-7 h-[52px] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-yellow-400 rounded-md flex items-center justify-center text-sm">🛡️</div>
          <div>
            <div className="text-[13px] font-bold text-slate-800 leading-none">DDNPPO Records System</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Davao Del Norte Provincial Police Office</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
            {user?.initials ?? 'AS'}
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-slate-800">{user?.name?.split(' ')[0] ?? 'Ana'}</div>
            <div className="text-[11px] text-slate-400 capitalize">{user?.role ?? 'Officer'}</div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>⏻ Logout</Button>
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="hero-gradient px-12 pt-10 pb-12 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full border-[50px] border-white/[0.05]" />
        <div className="relative z-10">
          <h1 className="font-display text-4xl text-white mb-2">
            Good morning, {user?.name?.split(' ')[0] ?? 'Ana'}.
          </h1>
          <p className="text-white/60 text-sm flex items-center gap-1.5 mb-5">
            📅 {date}
          </p>
          <div className="flex items-center gap-2.5 bg-white/10 border border-white/20 rounded-xl px-4 py-3 max-w-md cursor-text">
            <div className="w-2 h-2 bg-yellow-400 rounded-full" />
            <span className="text-white/50 text-sm">Search documents, orders, memos…</span>
          </div>
        </div>
      </div>

      {/* ── Quick Access Grid ── */}
      <div className="max-w-5xl mx-auto w-full px-12 py-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-0.5 h-3.5 bg-blue-600 rounded" />
          <span className="text-[10.5px] font-bold uppercase tracking-widest text-slate-400">Quick Access</span>
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-[660px]">
          {CARDS.map(card => (
            <button
              key={card.key}
              onClick={() => setOpenModal(card.key)}
              className="bg-white border-[1.5px] border-slate-200 rounded-xl p-6 text-left hover:border-blue-500 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <span className="text-3xl mb-3.5 block">{card.icon}</span>
              <div className="text-[15px] font-bold text-slate-800 mb-1">{card.title}</div>
              <div className="text-[12.5px] text-slate-400 leading-snug mb-3">{card.desc}</div>
              <span className="inline-flex bg-blue-50 text-blue-600 text-[11px] font-bold px-2.5 py-1 rounded-full">VIEW</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════ */}

      {/* Master Documents */}
      <Modal open={openModal === 'master'} onClose={() => setOpenModal(null)} title="Master Documents" width="max-w-2xl">
        <Toolbar placeholder="Live records">
          <ToolbarSelect><option>Read-only View</option></ToolbarSelect>
        </Toolbar>
        {loading ? <EmptyState icon="⏳" title="Loading master documents..." /> : masterDocs.length === 0 ? <EmptyState icon="📁" title="No documents found" description="No active master documents yet." /> : <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>
              {masterDocs.map(doc => {
                const attachments = masterAttachmentsByDoc[doc.id] ?? []
                const expanded = expandedMasterDocId === doc.id
                return (
                  <Fragment key={doc.id}>
                    <tr className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3" style={{ width: 110 }}>
                        <Badge className={levelBadgeClass(doc.level)}>{doc.level}</Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold text-sm text-slate-800">{doc.title}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{doc.date}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {doc.fileUrl ? (
                            <Button variant="ghost" size="sm" onClick={() => setViewerFile({ url: doc.fileUrl!, name: doc.title })}>👁</Button>
                          ) : (
                            <Button variant="ghost" size="sm" disabled>—</Button>
                          )}
                          {attachments.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedMasterDocId(expanded ? null : doc.id)}
                            >
                              📎 {attachments.length}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {attachments.length > 0 && (
                      <tr className="bg-slate-50/70 border-b border-slate-100">
                        <td colSpan={4} className="px-4 py-0">
                          <div
                            className="grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out"
                            style={{
                              gridTemplateRows: expanded ? '1fr' : '0fr',
                              opacity: expanded ? 1 : 0,
                            }}
                          >
                            <div className="space-y-2 py-3 min-h-0">
                              {attachments.map(att => (
                                <div key={att.id} className="flex items-center gap-3 p-2 border border-slate-200 rounded-lg bg-white transition-colors duration-150 hover:border-blue-200">
                                  <span className="text-sm">📄</span>
                                  <span className="text-xs font-semibold text-slate-700 flex-1 truncate">{att.fileName}</span>
                                  <span className="text-[11px] text-slate-400">{att.fileSize}</span>
                                  <Button variant="ghost" size="sm" onClick={() => setViewerFile({ url: att.fileUrl, name: att.fileName })}>👁</Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>}
      </Modal>

      {/* Administrative Orders */}
      <Modal open={openModal === 'so'} onClose={() => setOpenModal(null)} title="Administrative Orders" width="max-w-xl">
        {loading ? <EmptyState icon="⏳" title="Loading administrative orders..." /> : orders.length === 0 ? <EmptyState icon="📋" title="No orders found" description="No active administrative orders yet." /> : <div className="p-6 space-y-3">
          {orders.map(so => {
            const attachments = orderAttachmentsByOrder[so.id] ?? []
            const attachmentCount = countOrderAttachments(attachments)
            const expanded = expandedOrderId === so.id
            return (
              <div key={so.id} className="space-y-2">
                <div className="flex items-center gap-3 px-4 py-3.5 border-[1.5px] border-slate-200 rounded-xl hover:border-blue-200 transition">
                  <Badge className={statusBadgeClass(so.status)}>{so.status}</Badge>
                  <span className="flex-1 font-semibold text-sm text-slate-800">{so.reference} — {so.subject}</span>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{so.date}</span>
                  <div className="flex gap-1">
                    {so.fileUrl ? <Button variant="ghost" size="sm" onClick={() => setViewerFile({ url: so.fileUrl!, name: `${so.reference} - ${so.subject}` })}>👁</Button> : <Button variant="ghost" size="sm" disabled>—</Button>}
                    {attachmentCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setExpandedOrderId(expanded ? null : so.id)}>
                        📎 {attachmentCount}
                      </Button>
                    )}
                  </div>
                </div>
                {attachmentCount > 0 && (
                  <div
                    className="ml-3 border-l-2 border-slate-200 pl-3 grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out"
                    style={{
                      gridTemplateRows: expanded ? '1fr' : '0fr',
                      opacity: expanded ? 1 : 0,
                    }}
                  >
                    <div className="space-y-2 pb-1 min-h-0">
                      {renderOrderAttachments(attachments)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>}
      </Modal>

      {/* 201 File */}
      <Modal open={openModal === 'journal'} onClose={() => setOpenModal(null)} title="201 File — Police Personnel File" width="max-w-xl">
        {loading ? <EmptyState icon="⏳" title="Loading 201 files..." /> : files201.length === 0 ? <EmptyState icon="📂" title="No filed 201 documents" description="No uploaded 201 file attachments yet." /> : <div className="p-6 space-y-3">
          {files201.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 px-4 py-3.5 border-[1.5px] border-slate-200 rounded-xl hover:border-blue-200 transition">
              <Badge className="bg-slate-100 text-slate-700">{entry.status}</Badge>
              <span className="flex-1 font-semibold text-sm text-slate-800">{entry.label} · {entry.person}</span>
              <span className="text-xs text-slate-400 whitespace-nowrap">{entry.dateUpdated || '—'}</span>
              <div className="flex gap-1">
                {entry.fileUrl ? <Button variant="ghost" size="sm" onClick={() => setViewerFile({ url: entry.fileUrl!, name: entry.label })}>👁</Button> : <Button variant="ghost" size="sm" disabled>—</Button>}
              </div>
            </div>
          ))}
        </div>}
      </Modal>

      {/* Classified Documents */}
      <Modal open={openModal === 'confidential'} onClose={() => setOpenModal(null)} title="Classified Documents" width="max-w-2xl">
        <div className="px-7 pt-5">
          <AlertWarning message="Confidential documents require per-document password authentication. All access is logged." />
        </div>
        {loading ? <EmptyState icon="⏳" title="Loading classified documents..." /> : classifiedDocs.length === 0 ? <EmptyState icon="🔒" title="No classified documents" description="No active classified uploads yet." /> : <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Document','Classification','Date','Access','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classifiedDocs.map(doc => (
                <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="px-4 py-3.5"><span className="mr-2">🔒</span><strong className="text-sm">{doc.title}</strong></td>
                  <td className="px-4 py-3.5"><Badge className={classificationBadgeClass(doc.classification)}>{doc.classification}</Badge></td>
                  <td className="px-4 py-3.5 text-sm text-slate-500">{doc.date}</td>
                  <td className="px-4 py-3.5 text-sm text-slate-600">{doc.access}</td>
                  <td className="px-4 py-3.5">
                    {doc.fileUrl ? (
                      <button
                        onClick={() => {
                          if (doc.access !== 'All w/ Password') {
                            toast.warning('This classified document is restricted to admin-only access.')
                            return
                          }
                          setClassifiedUnlockDoc(doc)
                        }}
                        className="bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-amber-200 transition inline-block"
                      >
                        👁 View
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">No file</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
        <div className="h-4" />
      </Modal>

      <ClassifiedUnlockModal
        open={!!classifiedUnlockDoc}
        doc={classifiedUnlockDoc}
        onClose={() => setClassifiedUnlockDoc(null)}
        onUnlock={doc => setViewerFile({ url: doc.fileUrl!, name: doc.title })}
      />

      {/* E-Library */}
      <Modal open={openModal === 'library'} onClose={() => setOpenModal(null)} title="E-Library" width="max-w-2xl">
        <Toolbar placeholder="Live records">
          <ToolbarSelect><option>Read-only View</option></ToolbarSelect>
        </Toolbar>
        {loading ? <EmptyState icon="⏳" title="Loading e-library..." /> : libraryItems.length === 0 ? <EmptyState icon="📚" title="No library items" description="No active library uploads yet." /> : <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Title','Category','Size','Date Added','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {libraryItems.map(item => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="px-4 py-3.5"><span className="mr-2">📗</span><strong className="text-sm">{item.title}</strong></td>
                  <td className="px-4 py-3.5"><Badge className={libraryBadgeClass(item.category)}>{item.category}</Badge></td>
                  <td className="px-4 py-3.5 text-sm text-slate-500">{item.size}</td>
                  <td className="px-4 py-3.5 text-sm text-slate-500">{item.dateAdded}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1">
                      {item.fileUrl ? <Button variant="ghost" size="sm" onClick={() => setViewerFile({ url: item.fileUrl!, name: item.title })}>👁</Button> : <Button variant="ghost" size="sm" disabled>—</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      </Modal>

      {/* Organization */}
      <Modal open={openModal === 'directory'} onClose={() => setOpenModal(null)} title="Organization — Organizational Structure & Directory" width="max-w-2xl">
        {loading ? <EmptyState icon="⏳" title="Loading organization chart..." /> : orgRoot ? <OrgChart root={orgRoot} /> : <EmptyState icon="🏛️" title="No organization members" description="No org chart records yet." />}
      </Modal>

      {viewerFile && (
        <InlineFileViewerModal
          fileUrl={viewerFile.url}
          fileName={viewerFile.name}
          open={!!viewerFile}
          onClose={() => setViewerFile(null)}
        />
      )}

    </div>
  )
}