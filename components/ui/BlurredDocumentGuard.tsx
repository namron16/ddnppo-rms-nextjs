'use client'
// components/ui/BlurredDocumentGuard.tsx  (v2)
// Wraps document content — blurs for unauthorized P2–P10 roles
// Full access: PD, DPDA, DPDO, P1
// Tag-controlled: P2–P10

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import { canAdminViewDocument, type DocType } from '@/lib/rbac'
import { hasFullDocumentAccess, checkClientVisibility, ROLE_META } from '@/lib/permissions'
import type { AdminRole } from '@/lib/auth'

// ── Main Guard ────────────────────────────────

interface BlurredDocumentGuardProps {
  documentId: string
  documentType: DocType
  children: React.ReactNode
  /** Pre-fetched result to skip extra DB call */
  canView?: boolean
  /** Show compact overlay (for table rows) vs card overlay */
  compact?: boolean
  /** Optional: pre-computed tagged roles for tooltip */
  taggedRoles?: AdminRole[]
}

export function BlurredDocumentGuard({
  documentId,
  documentType,
  children,
  canView: preloadedCanView,
  compact = false,
  taggedRoles,
}: BlurredDocumentGuardProps) {
  const { user } = useAuth()
  const [canView, setCanView] = useState<boolean | null>(
    preloadedCanView !== undefined ? preloadedCanView : null
  )

  useEffect(() => {
    if (preloadedCanView !== undefined) {
      setCanView(preloadedCanView)
      return
    }
    if (!user) { setCanView(false); return }

    // Full-access roles: skip DB call
    if (hasFullDocumentAccess(user.role)) {
      setCanView(true)
      return
    }

    // Viewer roles: check DB
    canAdminViewDocument(user.role as AdminRole, documentId, documentType)
      .then(setCanView)
  }, [user, documentId, documentType, preloadedCanView])

  // Loading shimmer
  if (canView === null) {
    return (
      <div className="animate-pulse bg-slate-100 rounded-lg h-8 w-full" />
    )
  }

  if (canView) return <>{children}</>

  // Blurred restricted view
  return (
    <RestrictedOverlay compact={compact} taggedRoles={taggedRoles}>
      {children}
    </RestrictedOverlay>
  )
}

// ── Restricted Overlay ────────────────────────

function RestrictedOverlay({
  children,
  compact,
  taggedRoles,
}: {
  children: React.ReactNode
  compact?: boolean
  taggedRoles?: AdminRole[]
}) {
  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  if (compact) {
    // Inline table-row blur — minimal overlay
    return (
      <span
        className="relative inline-flex items-center gap-1 group"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span
          className="select-none"
          style={{
            filter: 'blur(3.5px)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {children}
        </span>

        {/* Inline lock icon */}
        <span className="flex-shrink-0 ml-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>

        {/* Tooltip */}
        {showTooltip && (
          <div
            ref={tooltipRef}
            className="absolute left-0 top-full mt-1.5 z-50 bg-slate-900 text-white text-[11px] font-medium px-3 py-2 rounded-lg shadow-xl whitespace-nowrap pointer-events-none"
            style={{ maxWidth: 220 }}
          >
            <p className="font-bold mb-1">🔒 Restricted Document</p>
            <p className="text-slate-300 text-[10px] leading-snug">
              You don't have permission to view this document. Contact P1 to request access.
            </p>
          </div>
        )}
      </span>
    )
  }

  // Full card blur overlay
  return (
    <div className="relative rounded-xl overflow-hidden group">
      {/* Blurred background content */}
      <div
        aria-hidden="true"
        style={{
          filter: 'blur(4px)',
          pointerEvents: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          opacity: 0.6,
        }}
      >
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/25 backdrop-blur-[1px] rounded-xl">
        <div className="flex flex-col items-center text-center bg-white/95 backdrop-blur-sm px-5 py-4 rounded-2xl shadow-xl border border-slate-200/80 max-w-[220px]">
          {/* Lock icon */}
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <p className="text-[13px] font-extrabold text-slate-800 leading-tight">
            Restricted Document
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
            You do not have permission to view this file.
          </p>

          <div className="mt-2.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-[10px] text-amber-700 font-medium">
              Contact P1 to request access
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Approval Status Badge ─────────────────────
// Re-exported from BlurredDocumentGuard for convenience

import type { DocumentApproval } from '@/lib/rbac'

interface ApprovalBadgeProps {
  approval: DocumentApproval | null
  compact?: boolean
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:  { label: '⏳ Pending Review',       bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400'  },
  reviewed: { label: '👁 Awaiting Final Approval', bg: 'bg-blue-50',  text: 'text-blue-700',    dot: 'bg-blue-500'   },
  approved: { label: '✅ Approved',              bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500'},
  rejected: { label: '❌ Rejected',              bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500'    },
}

export function ApprovalStatusBadge({ approval, compact = false }: ApprovalBadgeProps) {
  if (!approval) return null
  const cfg = STATUS_CONFIG[approval.status]
  if (!cfg) return null

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {approval.status.toUpperCase()}
      </span>
    )
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${cfg.bg}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
      {approval.reviewed_by && (
        <span className={`text-[11px] ${cfg.text} opacity-70 ml-auto`}>
          by {approval.reviewed_by}
        </span>
      )}
    </div>
  )
}