'use client'
// components/ui/EnhancedDocumentGuard.tsx
// Drop-in replacement/enhancement for BlurredDocumentGuard.
//
// Fix: Tagged P2-P10 users now correctly see documents unblurred.
// The previous version called hasApprovedViewRequest which missed the
// tagged_admin_access baseline check. Now uses canAdminViewDocument from
// rbac.ts which correctly checks both tagged_admin_access AND document_visibility.

import { useEffect, useState, useCallback } from 'react'
import { Lock } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/Toast'
import { RequestViewModal } from '@/components/modals/RequestViewModal'
import {
  roleHasFullAccess,
  roleNeedsViewRequest,
  type DocumentViewRequest,
} from '@/lib/viewRequests'
// KEY FIX: Use canAdminViewDocument from rbac.ts instead of hasApprovedViewRequest
// canAdminViewDocument correctly checks tagged_admin_access first, then document_visibility
import { canAdminViewDocument, type DocType } from '@/lib/rbac'
import { supabase } from '@/lib/supabase'
import type { AdminRole } from '@/lib/auth'

interface EnhancedDocumentGuardProps {
  documentId: string
  documentType: string
  documentTitle: string
  children: React.ReactNode
  /** Preloaded canView state — if true, skips DB check entirely */
  canView?: boolean
  /** Compact / inline blur mode (for table cells) */
  compact?: boolean
}

export function EnhancedDocumentGuard({
  documentId,
  documentType,
  documentTitle,
  children,
  canView: preloadedCanView,
  compact = false,
}: EnhancedDocumentGuardProps) {
  const { user } = useAuth()
  const [canView, setCanView] = useState<boolean | null>(
    preloadedCanView === true ? true : null
  )
  const [existingRequest, setExistingRequest] = useState<DocumentViewRequest | null>(null)
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(canView === null)

  const checkAccess = useCallback(async () => {
    if (!user) { setCanView(false); setCheckingAccess(false); return }

    // Full access roles bypass everything
    if (roleHasFullAccess(user.role as AdminRole)) {
      setCanView(true)
      setCheckingAccess(false)
      return
    }

    // KEY FIX: Use canAdminViewDocument which checks tagged_admin_access FIRST
    // This ensures P2-P10 tagged by P1 see documents clearly without needing
    // to submit a separate view request.
    const hasAccess = await canAdminViewDocument(
      user.role as AdminRole,
      documentId,
      documentType as DocType
    )
    setCanView(hasAccess)

    // For users without access, load their existing request status for UI display
    if (!hasAccess && roleNeedsViewRequest(user.role as AdminRole)) {
      try {
        const { data } = await supabase
          .from('document_view_requests')
          .select('*')
          .eq('document_id', documentId)
          .eq('requester_id', user.role)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        // Only show non-approved requests (approved ones should have granted access above)
        if (data && data.status !== 'approved') {
          setExistingRequest(data as DocumentViewRequest)
        }
      } catch {
        // ignore
      }
    }

    setCheckingAccess(false)
  }, [user, documentId, documentType])

  useEffect(() => {
    // If preloaded as true, trust it — no DB call needed
    if (preloadedCanView === true) {
      setCanView(true)
      setCheckingAccess(false)
      return
    }
    checkAccess()
  }, [preloadedCanView, checkAccess])

  // Real-time: update canView when a visibility row is inserted/updated
  useEffect(() => {
    if (!user || roleHasFullAccess(user.role as AdminRole)) return
    if (canView) return // already has access

    const channel = supabase
      .channel(`doc_guard_${documentId}_${user.role}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'document_view_requests',
          filter: `document_id=eq.${documentId}`,
        },
        (payload) => {
          const updated = payload.new as DocumentViewRequest
          if (updated.requester_id === user.role && updated.status === 'approved') {
            // Re-run full access check (the visibility row should now exist)
            checkAccess()
          } else if (updated.requester_id === user.role) {
            setExistingRequest(updated)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'document_visibility',
          filter: `document_id=eq.${documentId}`,
        },
        (payload) => {
          const row = payload.new as any
          if (row.admin_id === user.role && row.can_view) {
            setCanView(true)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'master_documents',
          filter: `id=eq.${documentId}`,
        },
        () => {
          // tagged_admin_access may have changed — re-check
          checkAccess()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, documentId, canView, checkAccess])

  // Loading state
  if (checkingAccess) {
    if (compact) {
      return <span className="animate-pulse bg-slate-200 rounded h-4 w-24 inline-block" />
    }
    return (
      <div className="animate-pulse bg-slate-100 rounded-lg h-20 w-full" />
    )
  }

  // Has access → show content normally
  if (canView) return <>{children}</>

  // No access: compact inline blur
  if (compact) {
    return (
      <CompactBlurredGuard
        documentId={documentId}
        documentType={documentType}
        documentTitle={documentTitle}
        existingRequest={existingRequest}
        onRequestClick={() => setRequestModalOpen(true)}
        onRequestSubmitted={req => {
          setExistingRequest(req)
          setRequestModalOpen(false)
        }}
        requestModalOpen={requestModalOpen}
        onRequestModalClose={() => setRequestModalOpen(false)}
        needsRequest={!!(user && roleNeedsViewRequest(user.role as AdminRole))}
      >
        {children}
      </CompactBlurredGuard>
    )
  }

  // No access: full blurred overlay
  return (
    <FullBlurredGuard
      documentId={documentId}
      documentType={documentType}
      documentTitle={documentTitle}
      existingRequest={existingRequest}
      onRequestClick={() => setRequestModalOpen(true)}
      onRequestSubmitted={req => {
        setExistingRequest(req)
        setRequestModalOpen(false)
      }}
      requestModalOpen={requestModalOpen}
      onRequestModalClose={() => setRequestModalOpen(false)}
      needsRequest={!!(user && roleNeedsViewRequest(user.role as AdminRole))}
    >
      {children}
    </FullBlurredGuard>
  )
}

// ── Shared props for both guard variants ───────
interface GuardVariantProps {
  documentId: string
  documentType: string
  documentTitle: string
  existingRequest: DocumentViewRequest | null
  onRequestClick: () => void
  onRequestSubmitted: (req: DocumentViewRequest) => void
  requestModalOpen: boolean
  onRequestModalClose: () => void
  needsRequest: boolean
  children: React.ReactNode
}

// ── Compact (inline table cell) blur ──────────
function CompactBlurredGuard({
  documentId,
  documentType,
  documentTitle,
  existingRequest,
  onRequestClick,
  onRequestSubmitted,
  requestModalOpen,
  onRequestModalClose,
  needsRequest,
  children,
}: GuardVariantProps) {
  return (
    <>
      <span className="relative inline-flex items-center gap-1.5 group">
        <span
          style={{ filter: 'blur(3.5px)', pointerEvents: 'none', userSelect: 'none' }}
        >
          {children}
        </span>
        <Lock size={11} className="text-slate-400 flex-shrink-0" />

        {needsRequest && (!existingRequest || existingRequest.status === 'rejected') && (
          <button
            type="button"
            onClick={onRequestClick}
            className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            Request
          </button>
        )}

        {existingRequest?.status === 'pending' && (
          <button
            type="button"
            onClick={onRequestClick}
            className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition"
          >
            Pending
          </button>
        )}

        {/* Hover tooltip */}
        <div className="absolute left-0 top-full mt-1.5 z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150">
          <div className="bg-slate-900 text-white text-[11px] font-medium px-3 py-2 rounded-lg shadow-xl whitespace-nowrap max-w-[220px]">
            {existingRequest?.status === 'pending' ? (
              '⏳ Request pending P1 review'
            ) : existingRequest?.status === 'rejected' ? (
              '❌ Access denied — submit new request'
            ) : needsRequest ? (
              'Click Request to ask P1 for access'
            ) : (
              '🔒 You don\'t have access to this document'
            )}
          </div>
        </div>
      </span>

      {needsRequest && (
        <RequestViewModal
          open={requestModalOpen}
          onClose={onRequestModalClose}
          documentId={documentId}
          documentType={documentType}
          documentTitle={documentTitle}
          onRequestSubmitted={onRequestSubmitted}
        />
      )}
    </>
  )
}

// ── Full card blur with overlay ────────────────
function FullBlurredGuard({
  documentId,
  documentType,
  documentTitle,
  existingRequest,
  onRequestClick,
  onRequestSubmitted,
  requestModalOpen,
  onRequestModalClose,
  needsRequest,
  children,
}: GuardVariantProps) {
  const requestStatusConfig = existingRequest ? {
    pending: {
      icon: '⏳',
      label: 'Request Pending',
      sublabel: 'P1 is reviewing your request',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
    approved: {
      icon: '✅',
      label: 'Access Approved',
      sublabel: 'Refreshing access…',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
    rejected: {
      icon: '❌',
      label: 'Request Rejected',
      sublabel: existingRequest.rejection_reason ?? 'Contact P1 for details',
      bg: 'bg-red-50',
      border: 'border-red-200',
    },
  }[existingRequest.status] : null

  return (
    <>
      <div className="relative rounded-xl overflow-hidden group">
        {/* Blurred content */}
        <div
          aria-hidden="true"
          style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none', opacity: 0.5 }}
        >
          {children}
        </div>

        {/* Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20 backdrop-blur-[1px] rounded-xl">
          <div className="flex flex-col items-center text-center bg-white/96 backdrop-blur-sm px-5 py-4 rounded-2xl shadow-xl border border-slate-200/80 max-w-[260px] gap-2.5">

            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
              <Lock size={18} className="text-slate-500" />
            </div>

            <div>
              <p className="text-[13px] font-extrabold text-slate-800">Restricted Document</p>
              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                {requestStatusConfig
                  ? requestStatusConfig.sublabel
                  : 'You don\'t have permission to view this file.'}
              </p>
            </div>

            {requestStatusConfig ? (
              <div className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left ${requestStatusConfig.bg} ${requestStatusConfig.border}`}>
                <span className="text-base">{requestStatusConfig.icon}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800">{requestStatusConfig.label}</p>
                  {existingRequest?.rejection_reason && (
                    <p className="text-[10px] text-red-600 truncate">{existingRequest.rejection_reason}</p>
                  )}
                </div>
              </div>
            ) : null}

            {needsRequest && (!existingRequest || existingRequest.status === 'rejected') && (
              <button
                onClick={onRequestClick}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-sm w-full justify-center"
              >
                👁 Request View Access
              </button>
            )}

            {existingRequest?.status === 'pending' && (
              <button
                onClick={onRequestClick}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:underline transition"
              >
                View request details →
              </button>
            )}

            {!needsRequest && !requestStatusConfig && (
              <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[10px] text-slate-500 font-medium">Contact P1 Records Officer</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {needsRequest && (
        <RequestViewModal
          open={requestModalOpen}
          onClose={onRequestModalClose}
          documentId={documentId}
          documentType={documentType}
          documentTitle={documentTitle}
          onRequestSubmitted={onRequestSubmitted}
        />
      )}
    </>
  )
}