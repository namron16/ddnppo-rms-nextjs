'use client'
// app/admin/user-management/page.tsx
// Enhanced with Supabase Realtime — live approval queue with connection status,
// per-row live indicators, and animated incoming request notifications.

import { useState, useEffect, useCallback, useRef } from 'react'
import { PageHeader }    from '@/components/ui/PageHeader'
import { Badge }         from '@/components/ui/Badge'
import { Button }        from '@/components/ui/Button'
import { Avatar }        from '@/components/ui/Avatar'
import { SearchInput }   from '@/components/ui/SearchInput'
import { EmptyState }    from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AddUserModal }  from '@/components/modals/AddUserModal'
import { Modal }         from '@/components/ui/Modal'
import { useSearch, useModal, useDisclosure } from '@/hooks'
import { useToast }      from '@/components/ui/Toast'
import { USERS }         from '@/lib/data'
import { supabase }      from '@/lib/supabase'

// ── Types ──────────────────────────────────────
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

// Rows that just arrived via realtime (for highlight animation)
type NewlyArrivedSet = Set<string>

// ── Reject Reason Modal ────────────────────────
function RejectModal({
  request,
  open,
  onClose,
  onReject,
}: {
  request: AccessRequest | null
  open: boolean
  onClose: () => void
  onReject: (id: string, reason: string) => Promise<void>
}) {
  const { toast } = useToast()
  const [reason, setReason]   = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (!open) setReason('') }, [open])

  async function submit() {
    if (!request) return
    setLoading(true)
    await onReject(request.id, reason.trim())
    setLoading(false)
    onClose()
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
            Reason for Rejection <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            rows={3}
            className="w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:border-red-400 focus:bg-white transition resize-none"
            placeholder="e.g. Incomplete information, not eligible for access…"
            value={reason}
            onChange={e => setReason(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <button
            onClick={submit}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition disabled:opacity-60"
          >
            {loading ? (
              <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Rejecting…</>
            ) : '🚫 Reject Request'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Realtime connection badge ──────────────────
function RealtimeBadge({ connected, requestCount }: { connected: boolean; requestCount: number }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
      connected
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
        : 'bg-slate-50 border-slate-200 text-slate-400'
    }`}>
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
      {connected
        ? `Live · ${requestCount} total request${requestCount !== 1 ? 's' : ''}`
        : 'Connecting to live feed…'}
    </div>
  )
}

// ── Main Page ──────────────────────────────────
export default function UserManagementPage() {
  const { toast }     = useToast()
  const [activeTab, setActiveTab] = useState<'users' | 'requests'>('users')
  const [requests, setRequests]   = useState<AccessRequest[]>([])
  const [loadingReqs, setLoadingReqs] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
  const [approvingId, setApprovingId]  = useState<string | null>(null)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [newlyArrived, setNewlyArrived] = useState<NewlyArrivedSet>(new Set())
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set())
  const [unreadCount, setUnreadCount] = useState(0)

  const newModal    = useModal()
  const deleteDisc  = useDisclosure<string>()
  const rejectDisc  = useDisclosure<AccessRequest>()
  const approveDisc = useDisclosure<AccessRequest>()

  const highlightTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const { query, setQuery, filtered } = useSearch(USERS, ['name', 'email'])
  const { query: reqQuery, setQuery: setReqQuery, filtered: filteredReqs } = useSearch(
    requests, ['full_name', 'email'] as Array<keyof AccessRequest>
  )

  const displayReqs = filteredReqs.filter(r =>
    statusFilter === 'ALL' || r.status === statusFilter
  )

  const pendingCount = requests.filter(r => r.status === 'PENDING').length

  // ── Highlight helpers ──────────────────────────────────────────────────────
  function flashRow(id: string, type: 'new' | 'updated') {
    // Clear existing timeout for this id
    const existing = highlightTimeouts.current.get(id)
    if (existing) clearTimeout(existing)

    if (type === 'new') {
      setNewlyArrived(prev => new Set(prev).add(id))
    } else {
      setRecentlyUpdated(prev => new Set(prev).add(id))
    }

    const timeout = setTimeout(() => {
      if (type === 'new') {
        setNewlyArrived(prev => { const next = new Set(prev); next.delete(id); return next })
      } else {
        setRecentlyUpdated(prev => { const next = new Set(prev); next.delete(id); return next })
      }
      highlightTimeouts.current.delete(id)
    }, 4000)

    highlightTimeouts.current.set(id, timeout)
  }

  // ── Load requests ──────────────────────────────
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

  // ── Realtime subscription ──────────────────────
  useEffect(() => {
    loadRequests()

    const channel = supabase
      .channel('user_mgmt_access_requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'access_requests' },
        (payload) => {
          const newReq = payload.new as AccessRequest
          setRequests(prev => {
            if (prev.find(r => r.id === newReq.id)) return prev
            return [newReq, ...prev]
          })
          flashRow(newReq.id, 'new')

          // Increment unread badge if not on requests tab
          setUnreadCount(c => c + 1)

          toast.info(`New access request from ${newReq.full_name}`)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'access_requests' },
        (payload) => {
          const updated = payload.new as AccessRequest
          setRequests(prev =>
            prev.map(r => r.id === updated.id ? updated : r)
          )
          flashRow(updated.id, 'updated')
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'access_requests' },
        (payload) => {
          const deleted = payload.old as AccessRequest
          setRequests(prev => prev.filter(r => r.id !== deleted.id))
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
      // Clear all flash timeouts
      highlightTimeouts.current.forEach(t => clearTimeout(t))
      highlightTimeouts.current.clear()
    }
  }, [loadRequests]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear unread count when user switches to requests tab
  useEffect(() => {
    if (activeTab === 'requests') setUnreadCount(0)
  }, [activeTab])

  // ── Approve ────────────────────────────────────
  async function handleApprove() {
    const req = approveDisc.payload
    if (!req) return
    setApprovingId(req.id)

    try {
      const { error } = await supabase
        .from('access_requests')
        .update({ status: 'APPROVED', reviewed_at: new Date().toISOString() })
        .eq('id', req.id)

      if (error) throw error

      setRequests(prev => prev.map(r =>
        r.id === req.id ? { ...r, status: 'APPROVED', reviewed_at: new Date().toISOString() } : r
      ))
      flashRow(req.id, 'updated')
      toast.success(`Access approved for ${req.full_name}.`)
    } catch {
      toast.error('Failed to approve request. Please try again.')
    }

    setApprovingId(null)
    approveDisc.close()
  }

  // ── Reject ─────────────────────────────────────
  async function handleReject(id: string, reason: string) {
    try {
      const { error } = await supabase
        .from('access_requests')
        .update({
          status: 'REJECTED',
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason || null,
        })
        .eq('id', id)

      if (error) throw error

      setRequests(prev => prev.map(r =>
        r.id === id
          ? { ...r, status: 'REJECTED', reviewed_at: new Date().toISOString(), rejection_reason: reason || undefined }
          : r
      ))
      flashRow(id, 'updated')
      toast.success('Request rejected.')
    } catch {
      toast.error('Failed to reject request. Please try again.')
    }
  }

  const statusBadge = (s: AccessRequest['status']) => {
    if (s === 'PENDING')  return 'bg-amber-100 text-amber-700 border border-amber-200'
    if (s === 'APPROVED') return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    return 'bg-red-100 text-red-700 border border-red-200'
  }

  const statusIcon = (s: AccessRequest['status']) => {
    if (s === 'PENDING')  return '⏳'
    if (s === 'APPROVED') return '✅'
    return '🚫'
  }

  return (
    <>
      <PageHeader title="User Management" />

      <div className="p-8 space-y-6">

        {/* Tab Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition border-[1.5px] ${
              activeTab === 'users'
                ? 'bg-white border-blue-500 text-blue-700 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            👥 System Users
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition border-[1.5px] relative ${
              activeTab === 'requests'
                ? 'bg-white border-blue-500 text-blue-700 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            📋 Approval Queue
            {/* Combined pending + unread badge */}
            {(pendingCount > 0 || unreadCount > 0) && (
              <span className={`inline-flex items-center justify-center w-5 h-5 text-white text-[10px] font-bold rounded-full ${
                unreadCount > 0 ? 'bg-red-500 animate-bounce' : 'bg-red-500'
              }`}>
                {unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : (pendingCount > 9 ? '9+' : pendingCount)}
              </span>
            )}
          </button>

          {/* Realtime status */}
          <div className="ml-auto">
            <RealtimeBadge connected={realtimeConnected} requestCount={requests.length} />
          </div>
        </div>

        {/* ── Tab: System Users ── */}
        {activeTab === 'users' && (
          <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50">
              <SearchInput value={query} onChange={setQuery} placeholder="Search users…" className="max-w-xs flex-1" />
              <Button variant="primary" size="sm" className="ml-auto" onClick={newModal.open}>+ Add User</Button>
            </div>

            {filtered.length === 0 ? (
              <EmptyState icon="👥" title="No users found" description="Try a different search term." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(user => (
                      <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar initials={user.initials} color={user.avatarColor} textColor={user.role === 'admin' ? '#0f1c35' : '#fff'} size="sm" />
                            <span className="font-semibold text-sm text-slate-800">{user.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-600">{user.email}</td>
                        <td className="px-4 py-3.5">
                          <Badge className={user.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}>
                            {user.role === 'admin' ? 'Administrator' : 'Officer'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5"><Badge className="bg-emerald-100 text-emerald-700">Active</Badge></td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm">✏️</Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteDisc.open(user.name)}>🗑</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Approval Queue ── */}
        {activeTab === 'requests' && (
          <div className="space-y-4">

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Pending Review', value: requests.filter(r => r.status === 'PENDING').length,  icon: '⏳', bg: 'bg-amber-50',   num: 'text-amber-700'   },
                { label: 'Approved',        value: requests.filter(r => r.status === 'APPROVED').length, icon: '✅', bg: 'bg-emerald-50', num: 'text-emerald-700' },
                { label: 'Rejected',        value: requests.filter(r => r.status === 'REJECTED').length, icon: '🚫', bg: 'bg-red-50',     num: 'text-red-700'     },
              ].map(s => (
                <div key={s.label} className={`${s.bg} border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-3`}>
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <div className={`text-2xl font-extrabold ${s.num}`}>{s.value}</div>
                    <div className="text-xs text-slate-500">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Realtime indicator row */}
            <div className="flex items-center gap-3 px-1">
              <span className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              <span className="text-xs text-slate-500 font-medium">
                {realtimeConnected
                  ? 'Live — this queue updates automatically as new requests come in'
                  : 'Connecting to live feed…'}
              </span>
              {!realtimeConnected && (
                <div className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50 flex-wrap">
                <SearchInput
                  value={reqQuery}
                  onChange={setReqQuery}
                  placeholder="Search by name or email…"
                  className="max-w-xs flex-1"
                />
                <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden bg-white shadow-sm">
                  {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((s, i) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                        i > 0 ? 'border-l border-slate-300' : ''
                      } ${
                        statusFilter === s
                          ? s === 'PENDING'   ? 'bg-amber-500 text-white'
                          : s === 'APPROVED'  ? 'bg-emerald-600 text-white'
                          : s === 'REJECTED'  ? 'bg-red-600 text-white'
                          : 'bg-slate-700 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {s === 'ALL' ? 'All' : s === 'PENDING' ? '⏳ Pending' : s === 'APPROVED' ? '✅ Approved' : '🚫 Rejected'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={loadRequests}
                  className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition font-medium"
                  title="Refresh"
                >
                  🔄 Refresh
                </button>
              </div>

              {loadingReqs ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : displayReqs.length === 0 ? (
                <EmptyState
                  icon={statusFilter === 'PENDING' ? '📋' : statusFilter === 'APPROVED' ? '✅' : '📭'}
                  title={`No ${statusFilter === 'ALL' ? '' : statusFilter.toLowerCase() + ' '}requests found`}
                  description={
                    statusFilter === 'PENDING'
                      ? 'No pending access requests at this time.'
                      : 'Try adjusting your filters.'
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {['Applicant', 'Email', 'Contact No.', 'Submitted', 'Status', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayReqs.map(req => {
                        const isNew     = newlyArrived.has(req.id)
                        const isUpdated = recentlyUpdated.has(req.id)

                        return (
                          <tr
                            key={req.id}
                            className={`border-b border-slate-100 transition-all duration-700 ${
                              isNew     ? 'bg-blue-50 border-l-4 border-l-blue-500'
                              : isUpdated ? 'bg-amber-50 border-l-4 border-l-amber-400'
                              : 'hover:bg-slate-50/80 border-l-4 border-l-transparent'
                            }`}
                          >
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="relative">
                                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                                    {req.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                  </div>
                                  {/* Live dot for new requests */}
                                  {isNew && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white animate-ping" />
                                  )}
                                </div>
                                <div>
                                  <span className="font-semibold text-sm text-slate-800">{req.full_name}</span>
                                  {isNew && (
                                    <span className="ml-2 inline-flex items-center text-[9px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                                      New
                                    </span>
                                  )}
                                  {isUpdated && (
                                    <span className="ml-2 inline-flex items-center text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                      Updated
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-sm text-slate-600">{req.email}</td>
                            <td className="px-4 py-3.5 text-sm text-slate-600">{req.contact_no}</td>
                            <td className="px-4 py-3.5">
                              <span className="text-xs text-slate-500">
                                {new Date(req.submitted_at).toLocaleDateString('en-PH', {
                                  year: 'numeric', month: 'short', day: 'numeric',
                                })}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${statusBadge(req.status)}`}>
                                {statusIcon(req.status)} {req.status}
                              </span>
                              {req.status === 'REJECTED' && req.rejection_reason && (
                                <p className="text-[10px] text-slate-400 mt-0.5 max-w-[140px] truncate" title={req.rejection_reason}>
                                  Reason: {req.rejection_reason}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              {req.status === 'PENDING' ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => approveDisc.open(req)}
                                    disabled={approvingId === req.id}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:bg-emerald-800 transition disabled:opacity-50 whitespace-nowrap shadow-sm"
                                  >
                                    {approvingId === req.id ? (
                                      <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Approving…</>
                                    ) : '✅ Approve'}
                                  </button>
                                  <button
                                    onClick={() => rejectDisc.open(req)}
                                    disabled={approvingId === req.id}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 bg-red-50 text-red-700 border border-red-300 rounded-lg hover:bg-red-100 active:bg-red-200 transition disabled:opacity-50 whitespace-nowrap shadow-sm"
                                  >
                                    🚫 Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  {req.reviewed_at
                                    ? `${req.status === 'APPROVED' ? 'Approved' : 'Rejected'} ${new Date(req.reviewed_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`
                                    : '—'}
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
      <AddUserModal open={newModal.isOpen} onClose={newModal.close} />

      <ConfirmDialog
        open={deleteDisc.isOpen}
        title="Remove User"
        message={`Remove "${deleteDisc.payload}" from the system? They will lose all access.`}
        confirmLabel="Remove" variant="danger"
        onConfirm={() => { toast.success('User removed.'); deleteDisc.close() }}
        onCancel={deleteDisc.close}
      />

      <ConfirmDialog
        open={approveDisc.isOpen}
        title="Approve Access Request"
        message={`Approve access for "${approveDisc.payload?.full_name}" (${approveDisc.payload?.email})? They will be granted system access.`}
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
    </>
  )
}