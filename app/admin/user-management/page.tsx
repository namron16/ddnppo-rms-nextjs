'use client'
// app/admin/user-management/page.tsx
// Enhanced: hardcoded admin accounts + real-time presence + access request queue

import { useState, useEffect, useCallback, useRef } from 'react'
import { PageHeader }    from '@/components/ui/PageHeader'
import { Badge }         from '@/components/ui/Badge'
import { Button }        from '@/components/ui/Button'
import { Avatar }        from '@/components/ui/Avatar'
import { SearchInput }   from '@/components/ui/SearchInput'
import { EmptyState }    from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal }         from '@/components/ui/Modal'
import { useSearch, useDisclosure } from '@/hooks'
import { useToast }      from '@/components/ui/Toast'
import { supabase }      from '@/lib/supabase'
import { ADMIN_ACCOUNTS } from '@/lib/auth'
import {
  getAllAdminPresence,
  getPendingAccessRequests,
  reviewAccessRequest,  
  approveAccessRequest,
  rejectAccessRequest,
  type AdminPresence,
  type DocumentAccessRequest,
} from '@/lib/accessRequests'
import type { AdminRole } from '@/lib/auth'
import { useAuth } from '@/lib/auth'

// ── Access Request row ─────────────────────────
interface AccessRequest {
  id: string
  full_name: string
  email: string
  contact_no: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  submitted_at: string
  reviewed_at?: string
  rejection_reason?: string
}

function RejectModal({
  request, open, onClose, onReject,
}: {
  request: AccessRequest | null; open: boolean; onClose: () => void
  onReject: (id: string, reason: string) => Promise<void>
}) {
  const { toast } = useToast()
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => { if (!open) setReason('') }, [open])
  async function submit() {
    if (!request) return
    setLoading(true)
    await onReject(request.id, reason.trim())
    setLoading(false); onClose()
  }
  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} title="Reject Access Request" width="max-w-md">
      <div className="p-6 space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-red-800 mb-0.5">Rejecting request from:</p>
          <p className="text-sm text-red-700">{request?.full_name} — {request?.email}</p>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Reason <span className="text-slate-400">(optional)</span>
          </label>
          <textarea rows={3}
            className="w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:border-red-400 focus:bg-white transition resize-none"
            placeholder="e.g. Incomplete information…"
            value={reason} onChange={e => setReason(e.target.value)} disabled={loading} />
        </div>
        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <button onClick={submit} disabled={loading}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition disabled:opacity-60">
            {loading ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />Rejecting…</> : '🚫 Reject'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Presence dot ───────────────────────────────
function PresenceDot({ isActive }: { isActive: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
      isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}

// ── Reject doc access modal ────────────────────
function RejectDocAccessModal({
  request, open, onClose, onReject,
}: {
  request: DocumentAccessRequest | null; open: boolean; onClose: () => void
  onReject: (id: string, reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => { if (!open) setReason('') }, [open])
  async function submit() {
    if (!request) return
    setLoading(true)
    await onReject(request.id, reason.trim())
    setLoading(false); onClose()
  }
  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} title="Reject Document Access Request" width="max-w-md">
      <div className="p-6 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-700 font-semibold">Requester: <span className="text-amber-900">{request?.requester_id}</span></p>
          <p className="text-xs text-amber-600 mt-0.5">Document ID: {request?.document_id}</p>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widests text-slate-500 mb-1.5">Reason</label>
          <textarea rows={3}
            className="w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:border-red-400 focus:bg-white transition resize-none"
            placeholder="State the reason for rejection…"
            value={reason} onChange={e => setReason(e.target.value)} disabled={loading} />
        </div>
        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <button onClick={submit} disabled={loading}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition disabled:opacity-60">
            {loading ? 'Rejecting…' : '🚫 Reject'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ──────────────────────────────────
export default function UserManagementPage() {
  const { toast } = useToast()
  const { user: currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState<'accounts' | 'requests' | 'doc_access'>('accounts')

  // Admin accounts with presence
  const [presence, setPresence] = useState<Map<string, AdminPresence>>(new Map())
  const [loadingPresence, setLoadingPresence] = useState(true)
  const [realtimeConnected, setRealtimeConnected] = useState(false)

  // External access requests (from register page)
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loadingReqs, setLoadingReqs] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [newlyArrived, setNewlyArrived] = useState<Set<string>>(new Set())
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set())

  // Document access requests
  const [docAccessRequests, setDocAccessRequests] = useState<DocumentAccessRequest[]>([])
  const [loadingDocAccess, setLoadingDocAccess] = useState(true)
  const [processingDocReq, setProcessingDocReq] = useState<string | null>(null)

  const rejectDisc  = useDisclosure<AccessRequest>()
  const approveDisc = useDisclosure<AccessRequest>()
  const rejectDocDisc = useDisclosure<DocumentAccessRequest>()
  const highlightTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const { query, setQuery, filtered } = useSearch(
    ADMIN_ACCOUNTS, ['name', 'role', 'title'] as any
  )
  const { query: reqQuery, setQuery: setReqQuery, filtered: filteredReqs } = useSearch(
    requests, ['full_name', 'email'] as Array<keyof AccessRequest>
  )
  const displayReqs = filteredReqs.filter(r => statusFilter === 'ALL' || r.status === statusFilter)
  const pendingCount = requests.filter(r => r.status === 'PENDING').length
  const docAccessPendingCount = docAccessRequests.filter(r => r.status === 'pending').length

  // ── Load presence ──────────────────────────────
  const loadPresence = useCallback(async () => {
    setLoadingPresence(true)
    const data = await getAllAdminPresence()
    const map = new Map<string, AdminPresence>()
    data.forEach(p => map.set(p.admin_id, p))
    setPresence(map)
    setLoadingPresence(false)
  }, [])

  // ── Load access requests ───────────────────────
  const loadRequests = useCallback(async () => {
    setLoadingReqs(true)
    try {
      const { data, error } = await supabase
        .from('access_requests')
        .select('*')
        .order('submitted_at', { ascending: false })
      if (!error && data) setRequests(data as AccessRequest[])
    } catch {}
    setLoadingReqs(false)
  }, [])

  // ── Load document access requests ─────────────
  const loadDocAccessRequests = useCallback(async () => {
    setLoadingDocAccess(true)
    const data = await getPendingAccessRequests()
    setDocAccessRequests(data)
    setLoadingDocAccess(false)
  }, [])

  // ── Highlight helpers ──────────────────────────
  function flashRow(id: string, type: 'new' | 'updated') {
    const existing = highlightTimeouts.current.get(id)
    if (existing) clearTimeout(existing)
    if (type === 'new') setNewlyArrived(prev => new Set(prev).add(id))
    else setRecentlyUpdated(prev => new Set(prev).add(id))
    const timeout = setTimeout(() => {
      if (type === 'new') setNewlyArrived(prev => { const n = new Set(prev); n.delete(id); return n })
      else setRecentlyUpdated(prev => { const n = new Set(prev); n.delete(id); return n })
      highlightTimeouts.current.delete(id)
    }, 4000)
    highlightTimeouts.current.set(id, timeout)
  }

  useEffect(() => {
    loadPresence()
    loadRequests()
    loadDocAccessRequests()

    // Realtime: presence
    const presenceChannel = supabase
      .channel('admin_presence_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_presence' }, () => {
        loadPresence()
      })
      .subscribe((status) => setRealtimeConnected(status === 'SUBSCRIBED'))

    // Realtime: access_requests
    const reqChannel = supabase
      .channel('user_mgmt_access_requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'access_requests' }, (payload) => {
        const newReq = payload.new as AccessRequest
        setRequests(prev => prev.find(r => r.id === newReq.id) ? prev : [newReq, ...prev])
        flashRow(newReq.id, 'new')
        setUnreadCount(c => c + 1)
        toast.info(`New access request from ${newReq.full_name}`)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'access_requests' }, (payload) => {
        const updated = payload.new as AccessRequest
        setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
        flashRow(updated.id, 'updated')
      })
      .subscribe()

    // Realtime: document_access_requests
    const docReqChannel = supabase
      .channel('doc_access_requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'document_access_requests' }, () => {
        loadDocAccessRequests()
        toast.info('New document access request received.')
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'document_access_requests' }, () => {
        loadDocAccessRequests()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(presenceChannel)
      supabase.removeChannel(reqChannel)
      supabase.removeChannel(docReqChannel)
      highlightTimeouts.current.forEach(t => clearTimeout(t))
      highlightTimeouts.current.clear()
    }
  }, [loadPresence, loadRequests, loadDocAccessRequests]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (activeTab === 'requests') setUnreadCount(0) }, [activeTab])

  // ── Handle approve/reject (system access requests) ──
  async function handleApprove() {
    const req = approveDisc.payload; if (!req) return
    approveDisc.close(); setApprovingId(req.id)
    try {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('access_requests')
        .update({ status: 'APPROVED', reviewed_at: now })
        .eq('id', req.id).select().single()
      if (error || !data) { toast.error('Failed to approve request.'); return }
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'APPROVED' as const, reviewed_at: now } : r))
      flashRow(req.id, 'updated')
      toast.success(`Access approved for ${req.full_name}.`)
    } catch { toast.error('Failed to approve request.') }
    finally { setApprovingId(null) }
  }

  async function handleReject(id: string, reason: string) {
    try {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('access_requests')
        .update({ status: 'REJECTED', reviewed_at: now, rejection_reason: reason || null })
        .eq('id', id).select().single()
      if (error || !data) { toast.error('Failed to reject request.'); return }
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'REJECTED' as const, reviewed_at: now, rejection_reason: reason || undefined } : r))
      flashRow(id, 'updated')
      toast.success('Request rejected.')
    } catch { toast.error('Failed to reject request.') }
  }

  // ── Handle document access requests ───────────
  const canReviewDocAccess = currentUser && (
    currentUser.role === 'DPDA' || currentUser.role === 'DPDO' || currentUser.role === 'PD'
  )

  async function handleDocAccessReview(requestId: string) {
    if (!currentUser || !canReviewDocAccess) return
    if (currentUser.role !== 'DPDA' && currentUser.role !== 'DPDO') return
    setProcessingDocReq(requestId)
    const ok = await reviewAccessRequest(requestId, currentUser.role as 'DPDA' | 'DPDO')
    if (ok) {
      toast.success('Request marked as reviewed. PD has been notified.')
      loadDocAccessRequests()
    } else {
      toast.error('Failed to review request.')
    }
    setProcessingDocReq(null)
  }

  async function handleDocAccessApprove(requestId: string) {
    if (!currentUser || currentUser.role !== 'PD') return
    setProcessingDocReq(requestId)
    const ok = await approveAccessRequest(requestId)
    if (ok) {
      toast.success('Document access granted successfully.')
      loadDocAccessRequests()
    } else {
      toast.error('Failed to approve access.')
    }
    setProcessingDocReq(null)
  }

  async function handleDocAccessReject(requestId: string, reason: string) {
    setProcessingDocReq(requestId)
    const ok = await rejectAccessRequest(requestId, reason)
    if (ok) {
      toast.success('Access request rejected.')
      setDocAccessRequests(prev => prev.filter(r => r.id !== requestId))
    } else {
      toast.error('Failed to reject request.')
    }
    setProcessingDocReq(null)
  }

  const statusBadge = (s: AccessRequest['status']) => ({
    PENDING: 'bg-amber-100 text-amber-700 border border-amber-200',
    APPROVED: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    REJECTED: 'bg-red-100 text-red-700 border border-red-200',
  }[s])

  const statusIcon = (s: AccessRequest['status']) => ({ PENDING: '⏳', APPROVED: '✅', REJECTED: '🚫' }[s])

  // ── Role styling ──────────────────────────────
  const roleLevelColor: Record<string, string> = {
    head: 'bg-red-100 text-red-700',
    deputy: 'bg-amber-100 text-amber-700',
    super_admin: 'bg-violet-100 text-violet-700',
    viewer: 'bg-blue-100 text-blue-700',
  }

  const activeCount = [...presence.values()].filter(p => p.is_active).length

  return (
    <>
      <PageHeader title="User Management" />

      <div className="p-8 space-y-6">

        {/* Tab Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setActiveTab('accounts')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition border-[1.5px] ${
              activeTab === 'accounts' ? 'bg-white border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}>
            👥 Admin Accounts
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              {activeCount} online
            </span>
          </button>

          <button onClick={() => setActiveTab('doc_access')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition border-[1.5px] relative ${
              activeTab === 'doc_access' ? 'bg-white border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}>
            🔐 Document Access Requests
            {docAccessPendingCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-white text-[10px] font-bold rounded-full bg-orange-500">
                {docAccessPendingCount > 9 ? '9+' : docAccessPendingCount}
              </span>
            )}
          </button>

          <button onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition border-[1.5px] relative ${
              activeTab === 'requests' ? 'bg-white border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}>
            📋 Approval Queue
            {(pendingCount > 0 || unreadCount > 0) && (
              <span className={`inline-flex items-center justify-center w-5 h-5 text-white text-[10px] font-bold rounded-full ${unreadCount > 0 ? 'bg-red-500 animate-bounce' : 'bg-red-500'}`}>
                {unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : (pendingCount > 9 ? '9+' : pendingCount)}
              </span>
            )}
          </button>

          <div className="ml-auto">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${realtimeConnected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
              <span className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              {realtimeConnected ? 'Live' : 'Connecting…'}
            </div>
          </div>
        </div>

        {/* ── Tab: Admin Accounts ── */}
        {activeTab === 'accounts' && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total Accounts', value: ADMIN_ACCOUNTS.length, icon: '👥', bg: 'bg-blue-50', num: 'text-blue-700' },
                { label: 'Online Now', value: activeCount, icon: '🟢', bg: 'bg-emerald-50', num: 'text-emerald-700' },
                { label: 'Offline', value: ADMIN_ACCOUNTS.length - activeCount, icon: '⚫', bg: 'bg-slate-50', num: 'text-slate-600' },
                { label: 'Full Access', value: 4, icon: '🔓', bg: 'bg-violet-50', num: 'text-violet-700' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-3`}>
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <div className={`text-2xl font-extrabold ${s.num}`}>{s.value}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50">
                <SearchInput value={query} onChange={setQuery} placeholder="Search accounts…" className="max-w-xs flex-1" />
                <span className="text-xs text-slate-400 ml-auto">
                  {ADMIN_ACCOUNTS.length} hardcoded accounts · no public registration
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Account', 'Role', 'Level', 'Permissions', 'Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widests text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(filtered as typeof ADMIN_ACCOUNTS).map(account => {
                      const p = presence.get(account.id)
                      const isActive = p?.is_active ?? false
                      return (
                        <tr key={account.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="relative">
                                <Avatar initials={account.initials} color={account.avatarColor} size="sm" />
                                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                              </div>
                              <div>
                                <span className="font-semibold text-sm text-slate-800">{account.name}</span>
                                <p className="text-[11px] text-slate-400">{account.id.toLowerCase()}@ddnppo.gov.ph</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge className="bg-slate-100 text-slate-700 font-bold">{account.role}</Badge>
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge className={roleLevelColor[account.level] ?? 'bg-slate-100 text-slate-500'}>
                              {account.level.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1">
                              {account.permissions.canUpload && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Upload</span>}
                              {account.permissions.canApproveReview && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Review</span>}
                              {account.permissions.canApproveFinal && <span className="text-[9px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Final Approve</span>}
                              {account.permissions.canViewAll && <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Full View</span>}
                              {!account.permissions.canUpload && !account.permissions.canApproveReview && !account.permissions.canApproveFinal && (
                                <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">View Only</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <PresenceDot isActive={isActive} />
                            {p?.last_seen && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {isActive ? 'Online now' : `Last: ${new Date(p.last_seen).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`}
                              </p>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
                <p className="text-[11px] text-slate-400">
                  🔒 These are hardcoded admin accounts. No account creation or deletion is available. Passwords are managed by the system administrator.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Document Access Requests ── */}
        {activeTab === 'doc_access' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Pending', value: docAccessRequests.filter(r => r.status === 'pending').length, icon: '⏳', bg: 'bg-amber-50', num: 'text-amber-700' },
                { label: 'Approved', value: docAccessRequests.filter(r => r.status === 'approved').length, icon: '✅', bg: 'bg-emerald-50', num: 'text-emerald-700' },
                { label: 'Rejected', value: docAccessRequests.filter(r => r.status === 'rejected').length, icon: '🚫', bg: 'bg-red-50', num: 'text-red-700' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-3`}>
                  <span className="text-2xl">{s.icon}</span>
                  <div><div className={`text-2xl font-extrabold ${s.num}`}>{s.value}</div><div className="text-xs text-slate-500 mt-0.5">{s.label}</div></div>
                </div>
              ))}
            </div>

            <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">Document Access Requests</h3>
                <button onClick={loadDocAccessRequests} className="text-xs text-slate-500 hover:text-slate-700 font-medium">🔄 Refresh</button>
              </div>

              {loadingDocAccess ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : docAccessRequests.length === 0 ? (
                <EmptyState icon="🔐" title="No document access requests" description="When P2–P10 users request access to restricted documents, they'll appear here." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {['Requester', 'Document Type', 'Status', 'Reviewed By', 'Submitted', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widests text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {docAccessRequests.map(req => {
                        const account = ADMIN_ACCOUNTS.find(a => a.id === req.requester_id)
                        return (
                          <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                {account && <Avatar initials={account.initials} color={account.avatarColor} size="sm" />}
                                <div>
                                  <p className="font-semibold text-sm text-slate-800">{req.requester_id}</p>
                                  <p className="text-[11px] text-slate-400">{account?.name}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <Badge className="bg-slate-100 text-slate-600">{req.document_type}</Badge>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                                req.status === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : req.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : 'bg-red-100 text-red-700 border border-red-200'
                              }`}>
                                {req.status === 'pending' ? '⏳' : req.status === 'approved' ? '✅' : '🚫'} {req.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-sm text-slate-500">{req.reviewed_by ?? '—'}</td>
                            <td className="px-4 py-3.5 text-xs text-slate-500">
                              {new Date(req.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-4 py-3.5">
                              {req.status === 'pending' && canReviewDocAccess && (
                                <div className="flex items-center gap-1.5">
                                  {(currentUser?.role === 'DPDA' || currentUser?.role === 'DPDO') && (
                                    <button
                                      onClick={() => handleDocAccessReview(req.id)}
                                      disabled={processingDocReq === req.id}
                                      className="text-[11px] font-bold px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition disabled:opacity-50"
                                    >
                                      👁 Review
                                    </button>
                                  )}
                                  {currentUser?.role === 'PD' && (
                                    <button
                                      onClick={() => handleDocAccessApprove(req.id)}
                                      disabled={processingDocReq === req.id}
                                      className="text-[11px] font-bold px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition disabled:opacity-50"
                                    >
                                      {processingDocReq === req.id ? '…' : '✅ Approve'}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => rejectDocDisc.open(req)}
                                    disabled={processingDocReq === req.id}
                                    className="text-[11px] font-bold px-2.5 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                                  >
                                    🚫 Reject
                                  </button>
                                </div>
                              )}
                              {req.status !== 'pending' && (
                                <span className="text-xs text-slate-400">
                                  {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '—'}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: System Approval Queue ── */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Pending Review', value: requests.filter(r => r.status === 'PENDING').length, icon: '⏳', bg: 'bg-amber-50', num: 'text-amber-700' },
                { label: 'Approved', value: requests.filter(r => r.status === 'APPROVED').length, icon: '✅', bg: 'bg-emerald-50', num: 'text-emerald-700' },
                { label: 'Rejected', value: requests.filter(r => r.status === 'REJECTED').length, icon: '🚫', bg: 'bg-red-50', num: 'text-red-700' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-3`}>
                  <span className="text-2xl">{s.icon}</span>
                  <div><div className={`text-2xl font-extrabold ${s.num}`}>{s.value}</div><div className="text-xs text-slate-500">{s.label}</div></div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 px-1">
              <span className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              <span className="text-xs text-slate-500 font-medium">
                {realtimeConnected ? 'Live — updates automatically' : 'Connecting…'}
              </span>
            </div>

            <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50 flex-wrap">
                <SearchInput value={reqQuery} onChange={setReqQuery} placeholder="Search by name or email…" className="max-w-xs flex-1" />
                <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden bg-white shadow-sm">
                  {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((s, i) => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${i > 0 ? 'border-l border-slate-300' : ''} ${
                        statusFilter === s ? (s === 'PENDING' ? 'bg-amber-500 text-white' : s === 'APPROVED' ? 'bg-emerald-600 text-white' : s === 'REJECTED' ? 'bg-red-600 text-white' : 'bg-slate-700 text-white') : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}>
                      {s === 'ALL' ? 'All' : s === 'PENDING' ? '⏳ Pending' : s === 'APPROVED' ? '✅ Approved' : '🚫 Rejected'}
                    </button>
                  ))}
                </div>
                <button onClick={loadRequests} className="ml-auto text-xs text-slate-500 hover:text-slate-700 font-medium">🔄 Refresh</button>
              </div>

              {loadingReqs ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : displayReqs.length === 0 ? (
                <EmptyState icon={statusFilter === 'PENDING' ? '📋' : '📭'}
                  title={`No ${statusFilter === 'ALL' ? '' : statusFilter.toLowerCase()} requests found`}
                  description="Try adjusting your filters." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {['Applicant', 'Email', 'Contact', 'Submitted', 'Status', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widests text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayReqs.map(req => {
                        const isNew = newlyArrived.has(req.id)
                        const isUpdated = recentlyUpdated.has(req.id)
                        return (
                          <tr key={req.id} className={`border-b border-slate-100 transition-all duration-700 ${isNew ? 'bg-blue-50 border-l-4 border-l-blue-500' : isUpdated ? 'bg-amber-50 border-l-4 border-l-amber-400' : 'hover:bg-slate-50/80 border-l-4 border-l-transparent'}`}>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                                  {req.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-semibold text-sm text-slate-800">{req.full_name}</span>
                                  {isNew && <span className="ml-2 text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">New</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-sm text-slate-600">{req.email}</td>
                            <td className="px-4 py-3.5 text-sm text-slate-600">{req.contact_no}</td>
                            <td className="px-4 py-3.5 text-xs text-slate-500">
                              {new Date(req.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${statusBadge(req.status)}`}>
                                {statusIcon(req.status)} {req.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              {req.status === 'PENDING' ? (
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => approveDisc.open(req)} disabled={approvingId === req.id}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50">
                                    {approvingId === req.id ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />…</> : '✅ Approve'}
                                  </button>
                                  <button onClick={() => rejectDisc.open(req)} disabled={approvingId === req.id}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 bg-red-50 text-red-700 border border-red-300 rounded-lg hover:bg-red-100 transition disabled:opacity-50">
                                    🚫 Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  {req.reviewed_at ? `${req.status === 'APPROVED' ? 'Approved' : 'Rejected'} ${new Date(req.reviewed_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}` : '—'}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ConfirmDialog
        open={approveDisc.isOpen}
        title="Approve Access Request"
        message={`Approve access for "${approveDisc.payload?.full_name}" (${approveDisc.payload?.email})?`}
        confirmLabel="✅ Approve"
        variant="primary"
        onConfirm={handleApprove}
        onCancel={approveDisc.close}
      />

      <RejectModal
        request={rejectDisc.payload ?? null}
        open={rejectDisc.isOpen}
        onClose={rejectDisc.close}
        onReject={handleReject}
      />

      <RejectDocAccessModal
        request={rejectDocDisc.payload ?? null}
        open={rejectDocDisc.isOpen}
        onClose={rejectDocDisc.close}
        onReject={handleDocAccessReject}
      />
    </>
  )
}