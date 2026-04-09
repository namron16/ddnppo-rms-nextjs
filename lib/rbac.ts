// lib/rbac.ts — Tag-Based Visibility + Approval Workflow
// Backend enforcement for all document access

import { supabase } from './supabase'
import { FULL_ACCESS_ROLES, VIEWER_ROLES } from './permissions'
import type { AdminRole } from './auth'

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export type DocType = 'master' | 'special_order' | 'daily_journal' | 'library' | 'classified_document'
export type ApprovalStatus = 'pending' | 'reviewed' | 'approved' | 'rejected'

export interface DocumentApproval {
  id: string
  document_id: string
  document_type: DocType
  status: ApprovalStatus
  reviewed_by?: string
  reviewed_at?: string
  review_remarks?: string
  approved_by?: string
  approved_at?: string
  rejected_by?: string
  rejected_at?: string
  rejection_reason?: string
  created_by: string
  created_at: string
}

export interface DocumentVisibility {
  id: string
  document_id: string
  document_type: DocType
  admin_id: string
  can_view: boolean
}

export interface AdminNotification {
  id: string
  admin_id: string
  message: string
  type: 'info' | 'approval_request' | 'approved' | 'rejected'
  document_id?: string
  document_type?: string
  is_read: boolean
  created_at: string
}

const TEMP_VIEW_ACCESS_MS = 24 * 60 * 60 * 1000

function isWithin24Hours(isoDate?: string | null): boolean {
  if (!isoDate) return true
  const ts = new Date(isoDate).getTime()
  if (Number.isNaN(ts)) return false
  return Date.now() - ts <= TEMP_VIEW_ACCESS_MS
}

// ══════════════════════════════════════════════
// UPLOAD AUTHORIZATION GUARD
// ══════════════════════════════════════════════

/**
 * Backend check: only P1 may upload.
 * Call this before any document insert.
 */
export function assertCanUpload(role: AdminRole): void {
  if (role !== 'P1') {
    throw new Error(`Upload denied: role '${role}' is not authorized to upload documents. Only P1 may upload.`)
  }
}

/**
 * Safe version — returns boolean instead of throwing.
 */
export function checkCanUpload(role: AdminRole): boolean {
  return role === 'P1'
}

// ══════════════════════════════════════════════
// DOCUMENT VISIBILITY  (TAG-BASED)
// ══════════════════════════════════════════════

/**
 * P1 sets which P2–P10 roles can view a document.
 * PD/DPDA/DPDO/P1 always bypass this (full access).
 * Previous tags for this document are wiped first.
 *
 * @param documentId       - document id
 * @param documentType     - 'master' | 'special_order' | etc.
 * @param selectedAdmins   - array of P2–P10 role ids
 * @param documentTitle    - used for audit log
 * @param taggedBy         - must be 'P1'
 */
export async function setDocumentVisibility(
  documentId: string,
  documentType: DocType,
  selectedAdmins: AdminRole[],
  documentTitle = '',
  taggedBy: AdminRole = 'P1'
): Promise<boolean> {
  // Backend guard: only P1 may tag
  if (!checkCanUpload(taggedBy)) {
    console.error(`setDocumentVisibility denied for role: ${taggedBy}`)
    return false
  }

  // Filter to valid viewer roles only (P2–P10)
  const validAdmins = selectedAdmins.filter(a => VIEWER_ROLES.includes(a))

  // Master documents use tagged_admin_access as the baseline source of truth.
  if (documentType === 'master') {
    const { error } = await supabase
      .from('master_documents')
      .update({ tagged_admin_access: validAdmins.length > 0 ? validAdmins : null })
      .eq('id', documentId)

    if (error) {
      console.error('setDocumentVisibility master update error:', error.message)
      return false
    }

    await supabase.from('visibility_audit_log').insert({
      document_id: documentId,
      document_type: documentType,
      document_title: documentTitle,
      tagged_by: taggedBy,
      tagged_roles: validAdmins,
      action: 'set',
    }).then(({ error: auditError }) => {
      if (auditError) console.warn('visibility_audit_log warn:', auditError.message)
    })

    return true
  }

  // Wipe existing visibility records for this doc
  await supabase
    .from('document_visibility')
    .delete()
    .eq('document_id', documentId)
    .eq('document_type', documentType)

  // Insert new tags
  if (validAdmins.length > 0) {
    const rows = validAdmins.map(adminId => ({
      document_id:   documentId,
      document_type: documentType,
      admin_id:      adminId,
      can_view:      true,
    }))

    const { error } = await supabase
      .from('document_visibility')
      .insert(rows)

    if (error) {
      console.error('setDocumentVisibility insert error:', error.message)
      return false
    }
  }

  // Write audit log
  await supabase.from('visibility_audit_log').insert({
    document_id:    documentId,
    document_type:  documentType,
    document_title: documentTitle,
    tagged_by:      taggedBy,
    tagged_roles:   validAdmins,
    action:         'set',
  }).then(({ error }) => {
    if (error) console.warn('visibility_audit_log warn:', error.message)
  })

  return true
}

/**
 * Backend visibility check for a single document.
 *
 * Rules:
 *   PD / DPDA / DPDO / P1 → always TRUE (full access)
 *   P2–P10 → TRUE only if row exists in document_visibility
 */
export async function canAdminViewDocument(
  adminId: AdminRole,
  documentId: string,
  documentType: DocType
): Promise<boolean> {
  if (FULL_ACCESS_ROLES.includes(adminId)) return true

  // Check if role is permanently tagged for this document (master docs only)
  if (documentType === 'master') {
    const taggedRoles = await getDocumentTaggedRoles(documentId, 'master')
    if (isRoleTaggedForDocument(adminId, taggedRoles)) return true
  }

  const { data, error } = await supabase
    .from('document_visibility')
    .select('can_view, granted_at, granted_by')
    .eq('document_id',   documentId)
    .eq('document_type', documentType)
    .eq('admin_id',      adminId)
    .maybeSingle()

  if (error || !data) return false
  if (data.can_view !== true) return false

  // Temporary grants (from request approvals) expire after 24 hours.
  const isTemporaryGrant = !!(data as any).granted_at && !!(data as any).granted_by
  if (documentType === 'master' && !isTemporaryGrant) return false
  if (!isTemporaryGrant) return true

  if (isWithin24Hours((data as any).granted_at)) return true

  await supabase
    .from('document_visibility')
    .update({ can_view: false })
    .eq('document_id', documentId)
    .eq('document_type', documentType)
    .eq('admin_id', adminId)
    .eq('can_view', true)

  return false
}

/**
 * Batch-check visibility for a list of document IDs.
 * Returns a Set of document IDs the user can view.
 */
export async function getBatchVisibility(
  adminId: AdminRole,
  documentIds: string[],
  documentType: DocType
): Promise<Set<string>> {
  // Full-access roles see everything
  if (FULL_ACCESS_ROLES.includes(adminId)) {
    return new Set(documentIds)
  }

  if (documentIds.length === 0) return new Set()

  if (documentType === 'master') {
    const allowed = new Set<string>()

    const [{ data: masters }, { data: tempRows, error: tempError }] = await Promise.all([
      supabase
        .from('master_documents')
        .select('id, tagged_admin_access')
        .in('id', documentIds),
      supabase
        .from('document_visibility')
        .select('document_id, granted_at, granted_by')
        .in('document_id', documentIds)
        .eq('document_type', 'master')
        .eq('admin_id', adminId)
        .eq('can_view', true),
    ])

    for (const row of (masters ?? []) as any[]) {
      const taggedRoles = parseTaggedAdminAccess(row.tagged_admin_access)
      if (taggedRoles.includes(adminId)) {
        allowed.add(row.id)
      }
    }

    if (!tempError) {
      for (const row of (tempRows ?? []) as any[]) {
        const isTemporaryGrant = !!row.granted_at && !!row.granted_by
        if (isTemporaryGrant && isWithin24Hours(row.granted_at)) {
          allowed.add(row.document_id)
        }
      }
    }

    return allowed
  }

  const { data, error } = await supabase
    .from('document_visibility')
    .select('document_id, granted_at, granted_by')
    .in('document_id', documentIds)
    .eq('document_type', documentType)
    .eq('admin_id', adminId)
    .eq('can_view', true)

  if (error) return new Set()

  const allowed = new Set<string>()
  for (const row of (data ?? []) as any[]) {
    const isTemporaryGrant = !!row.granted_at && !!row.granted_by
    if (!isTemporaryGrant || isWithin24Hours(row.granted_at)) {
      allowed.add(row.document_id)
    }
  }

  return allowed
}

/**
 * Parse tagged admin access into an AdminRole array.
 */
export function parseTaggedAdminAccess(tagged: AdminRole[] | string | null | undefined): AdminRole[] {
  if (!tagged) return []
  if (Array.isArray(tagged)) return tagged.filter(s => !!s) as AdminRole[]
  return tagged
    .split(',')
    .map(s => s.trim() as AdminRole)
    .filter(s => s.length > 0)
}

/**
 * Check if an admin role is in the tagged access list.
 */
export function isRoleTaggedForDocument(role: AdminRole, taggedRoles: AdminRole[] | string | null | undefined): boolean {
  if (!taggedRoles) return false
  const parsed = typeof taggedRoles === 'string' ? parseTaggedAdminAccess(taggedRoles) : taggedRoles
  return parsed.includes(role)
}

/**
 * Get the list of tagged admin IDs for a document (baseline access, set by P1).
 * Reads from the master_documents.tagged_admin_access field.
 */
export async function getDocumentTaggedRoles(
  documentId: string,
  documentType: DocType
): Promise<AdminRole[]> {
  // For master documents, read from the master_documents table
  if (documentType === 'master') {
    const { data, error } = await supabase
      .from('master_documents')
      .select('tagged_admin_access')
      .eq('id', documentId)
      .maybeSingle()
    
    if (error || !data) return []
    return parseTaggedAdminAccess(data.tagged_admin_access as AdminRole[] | string | null | undefined)
  }

  // For other document types, fall back to visibility table
  const { data, error } = await supabase
    .from('document_visibility')
    .select('admin_id')
    .eq('document_id',   documentId)
    .eq('document_type', documentType)
    .eq('can_view',      true)
    .is('granted_by', null)   // Only tagged, not temporary grants
    .is('granted_at', null)

  if (error) return []
  return (data ?? []).map((r: any) => r.admin_id as AdminRole)
}

/**
 * Get the list of all admin IDs with visibility for a document (tagged + temporary grants).
 * Used for batch operations; prefer getDocumentTaggedRoles for display/control logic.
 */
export async function getDocumentVisibility(
  documentId: string,
  documentType: DocType
): Promise<AdminRole[]> {
  const { data, error } = await supabase
    .from('document_visibility')
    .select('admin_id')
    .eq('document_id',   documentId)
    .eq('document_type', documentType)
    .eq('can_view',      true)

  if (error) return []
  return (data ?? []).map((r: any) => r.admin_id as AdminRole)
}

// ══════════════════════════════════════════════
// APPROVAL WORKFLOW
// ══════════════════════════════════════════════

export async function createApproval(
  documentId: string,
  documentType: DocType,
  documentTitle: string,
  createdBy: AdminRole = 'P1'
): Promise<DocumentApproval | null> {
  const { data, error } = await supabase
    .from('document_approvals')
    .insert({
      document_id:   documentId,
      document_type: documentType,
      status:        'pending',
      created_by:    createdBy,
    })
    .select()
    .single()

  if (error) { console.error('createApproval error:', error.message); return null }

  await createNotification('DPDA', `New document pending review: "${documentTitle}"`, 'approval_request', documentId, documentType)
  await createNotification('DPDO', `New document pending review: "${documentTitle}"`, 'approval_request', documentId, documentType)
  return data as DocumentApproval
}

export async function reviewByDPDAorDPDO(
  documentId: string,
  documentType: DocType,
  reviewerRole: 'DPDA' | 'DPDO',
  remarks?: string
): Promise<boolean> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('document_approvals')
    .update({ status: 'reviewed', reviewed_by: reviewerRole, reviewed_at: now, review_remarks: remarks ?? null })
    .eq('document_id',   documentId)
    .eq('document_type', documentType)
    .eq('status',        'pending')

  if (error) { console.error('reviewByDPDAorDPDO error:', error.message); return false }
  await createNotification('PD', `Document reviewed by ${reviewerRole}, awaiting final approval.`, 'approval_request', documentId, documentType)
  await createNotification('P1', `Your document has been reviewed by ${reviewerRole}.`, 'info', documentId, documentType)
  return true
}

export async function finalApproveByPD(
  documentId: string,
  documentType: DocType
): Promise<boolean> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('document_approvals')
    .update({ status: 'approved', approved_by: 'PD', approved_at: now })
    .eq('document_id',   documentId)
    .eq('document_type', documentType)

  if (error) { console.error('finalApproveByPD error:', error.message); return false }
  for (const role of ['P1', 'DPDA', 'DPDO'] as AdminRole[]) {
    await createNotification(role, `Document approved by PD.`, 'approved', documentId, documentType)
  }
  return true
}

export async function rejectDocument(
  documentId: string,
  documentType: DocType,
  rejectedBy: AdminRole,
  reason: string
): Promise<boolean> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('document_approvals')
    .update({ status: 'rejected', rejected_by: rejectedBy, rejected_at: now, rejection_reason: reason })
    .eq('document_id',   documentId)
    .eq('document_type', documentType)

  if (error) { console.error('rejectDocument error:', error.message); return false }
  await createNotification('P1', `Document rejected by ${rejectedBy}. Reason: ${reason}`, 'rejected', documentId, documentType)
  return true
}

export async function getApproval(
  documentId: string,
  documentType: DocType
): Promise<DocumentApproval | null> {
  const { data, error } = await supabase
    .from('document_approvals')
    .select('*')
    .eq('document_id',   documentId)
    .eq('document_type', documentType)
    .maybeSingle()

  if (error) return null
  return data as DocumentApproval | null
}

export async function getPendingApprovals(forRole: AdminRole): Promise<DocumentApproval[]> {
  let query = supabase.from('document_approvals').select('*')
  if (forRole === 'DPDA' || forRole === 'DPDO') query = query.eq('status', 'pending')
  else if (forRole === 'PD') query = query.in('status', ['pending', 'reviewed'])

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as DocumentApproval[]
}

// ══════════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════════

export async function createNotification(
  adminId: AdminRole, message: string,
  type: AdminNotification['type'] = 'info',
  documentId?: string, documentType?: string
): Promise<void> {
  const { error } = await supabase.from('admin_notifications').insert({
    admin_id:      adminId,
    message,
    type,
    document_id:   documentId ?? null,
    document_type: documentType ?? null,
    is_read:       false,
  })
  if (error) console.warn('createNotification warn:', error.message)
}

export async function getNotifications(adminId: AdminRole): Promise<AdminNotification[]> {
  const { data, error } = await supabase
    .from('admin_notifications')
    .select('*')
    .eq('admin_id', adminId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return []
  return (data ?? []) as AdminNotification[]
}

export async function markAsRead(notificationId: string): Promise<void> {
  await supabase.from('admin_notifications').update({ is_read: true }).eq('id', notificationId)
}

export async function markAllAsRead(adminId: AdminRole): Promise<void> {
  await supabase.from('admin_notifications').update({ is_read: true }).eq('admin_id', adminId).eq('is_read', false)
}

export async function getUnreadCount(adminId: AdminRole): Promise<number> {
  const { count, error } = await supabase
    .from('admin_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('admin_id', adminId)
    .eq('is_read', false)
  if (error) return 0
  return count ?? 0
}