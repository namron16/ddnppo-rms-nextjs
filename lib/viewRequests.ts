// lib/viewRequests.ts
// Document View Request system — P2–P10 request, P1 approves/rejects
// Real-time updates via Supabase Realtime

import { supabase } from './supabase'
import type { AdminRole } from './auth'
import type { DocType } from './rbac'

// ── Types ─────────────────────────────────────

export interface DocumentViewRequest {
  id: string
  document_id: string
  document_type: DocType | string
  document_title?: string
  requester_id: AdminRole
  purpose: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by?: string
  reviewed_at?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
}

export type ViewRequestStatus = DocumentViewRequest['status']

// ── Viewer roles that must request access ────
export const VIEWER_ROLES_NEEDING_REQUEST: AdminRole[] = [
  'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10',
]

// PD, DPDA, DPDO always have full access — no request needed
export const ALWAYS_FULL_ACCESS_ROLES: AdminRole[] = ['PD', 'DPDA', 'DPDO', 'P1']

// P1 is the sole approver
export const REQUEST_APPROVER_ROLE: AdminRole = 'P1'

/**
 * Check whether a role needs to submit a view request for restricted docs.
 */
export function roleNeedsViewRequest(role: AdminRole): boolean {
  return VIEWER_ROLES_NEEDING_REQUEST.includes(role)
}

/**
 * Check whether a role has full access without needing a request.
 */
export function roleHasFullAccess(role: AdminRole): boolean {
  return ALWAYS_FULL_ACCESS_ROLES.includes(role)
}

// ── CRUD Operations ────────────────────────────

/**
 * Submit a view request for a document (P2–P10 only).
 */
export async function submitViewRequest(
  documentId: string,
  documentType: string,
  documentTitle: string,
  requesterId: AdminRole,
  purpose: string,
  reason: string
): Promise<DocumentViewRequest | null> {
  // Guard: only viewer roles may submit
  if (!roleNeedsViewRequest(requesterId)) {
    console.warn(`submitViewRequest: role ${requesterId} does not need to request`)
    return null
  }

  // Check for existing pending/approved request
  const existing = await getViewRequestForDoc(documentId, requesterId)
  if (existing && (existing.status === 'pending' || existing.status === 'approved')) {
    return existing
  }

  const { data, error } = await supabase
    .from('document_view_requests')
    .insert({
      document_id: documentId,
      document_type: documentType,
      document_title: documentTitle,
      requester_id: requesterId,
      purpose: purpose.trim(),
      reason: reason.trim(),
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('submitViewRequest error:', error.message)
    return null
  }

  return data as DocumentViewRequest
}

/**
 * Get the latest view request for a specific user + document combination.
 */
export async function getViewRequestForDoc(
  documentId: string,
  requesterId: AdminRole
): Promise<DocumentViewRequest | null> {
  const { data, error } = await supabase
    .from('document_view_requests')
    .select('*')
    .eq('document_id', documentId)
    .eq('requester_id', requesterId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  return data as DocumentViewRequest | null
}

/**
 * Get all view requests for a document (P1 admin use).
 */
export async function getViewRequestsForDocument(
  documentId: string
): Promise<DocumentViewRequest[]> {
  const { data, error } = await supabase
    .from('document_view_requests')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getViewRequestsForDocument error:', error.message)
    return []
  }

  return (data ?? []) as DocumentViewRequest[]
}

/**
 * Get ALL pending requests (P1 admin dashboard).
 */
export async function getAllPendingViewRequests(): Promise<DocumentViewRequest[]> {
  const { data, error } = await supabase
    .from('document_view_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getAllPendingViewRequests error:', error.message)
    return []
  }

  return (data ?? []) as DocumentViewRequest[]
}

/**
 * Get all view requests regardless of status (P1 admin history view).
 */
export async function getAllViewRequests(limit = 100): Promise<DocumentViewRequest[]> {
  const { data, error } = await supabase
    .from('document_view_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getAllViewRequests error:', error.message)
    return []
  }

  return (data ?? []) as DocumentViewRequest[]
}

/**
 * Get view requests submitted by a specific user.
 */
export async function getMyViewRequests(
  requesterId: AdminRole
): Promise<DocumentViewRequest[]> {
  const { data, error } = await supabase
    .from('document_view_requests')
    .select('*')
    .eq('requester_id', requesterId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getMyViewRequests error:', error.message)
    return []
  }

  return (data ?? []) as DocumentViewRequest[]
}

/**
 * P1 approves a view request.
 * Also grants visibility in document_visibility table.
 */
export async function approveViewRequest(
  requestId: string,
  approvedBy: AdminRole = 'P1'
): Promise<boolean> {
  // Fetch the request details first
  const { data: request, error: fetchError } = await supabase
    .from('document_view_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (fetchError || !request) {
    console.error('approveViewRequest fetch error:', fetchError?.message)
    return false
  }

  const now = new Date().toISOString()

  // Update request status
  const { error: updateError } = await supabase
    .from('document_view_requests')
    .update({
      status: 'approved',
      reviewed_by: approvedBy,
      reviewed_at: now,
    })
    .eq('id', requestId)

  if (updateError) {
    console.error('approveViewRequest update error:', updateError.message)
    return false
  }

  // Grant visibility in document_visibility
  const { error: visError } = await supabase
    .from('document_visibility')
    .upsert(
      {
        document_id: request.document_id,
        document_type: request.document_type,
        admin_id: request.requester_id,
        can_view: true,
        granted_by: approvedBy,
        granted_at: now,
      },
      { onConflict: 'document_id,document_type,admin_id' }
    )

  if (visError) {
    console.warn('approveViewRequest visibility grant warn:', visError.message)
  }

  return true
}

/**
 * P1 rejects a view request.
 */
export async function rejectViewRequest(
  requestId: string,
  rejectedBy: AdminRole = 'P1',
  rejectionReason?: string
): Promise<boolean> {
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('document_view_requests')
    .update({
      status: 'rejected',
      reviewed_by: rejectedBy,
      reviewed_at: now,
      rejection_reason: rejectionReason ?? null,
    })
    .eq('id', requestId)

  if (error) {
    console.error('rejectViewRequest error:', error.message)
    return false
  }

  return true
}

/**
 * Check if a P2–P10 user has an approved view request for a document.
 */
export async function hasApprovedViewRequest(
  documentId: string,
  requesterId: AdminRole
): Promise<boolean> {
  if (roleHasFullAccess(requesterId)) return true

  // Check document_visibility table first (most authoritative)
  const { data: visData } = await supabase
    .from('document_visibility')
    .select('can_view')
    .eq('document_id', documentId)
    .eq('admin_id', requesterId)
    .eq('can_view', true)
    .maybeSingle()

  if (visData?.can_view) return true

  // Fallback: check request status
  const { data } = await supabase
    .from('document_view_requests')
    .select('status')
    .eq('document_id', documentId)
    .eq('requester_id', requesterId)
    .eq('status', 'approved')
    .maybeSingle()

  return !!data
}

/**
 * Batch-check approved view access for multiple documents at once.
 */
export async function batchCheckViewAccess(
  documentIds: string[],
  requesterId: AdminRole
): Promise<Set<string>> {
  if (roleHasFullAccess(requesterId)) {
    return new Set(documentIds)
  }

  if (documentIds.length === 0) return new Set()

  const { data, error } = await supabase
    .from('document_visibility')
    .select('document_id')
    .in('document_id', documentIds)
    .eq('admin_id', requesterId)
    .eq('can_view', true)

  if (error) return new Set()
  return new Set((data ?? []).map((r: any) => r.document_id as string))
}

// ── Permission Helpers ────────────────────────

/**
 * Can this role upload documents? Only P1.
 */
export function canUpload(role: AdminRole): boolean {
  return role === 'P1'
}

/**
 * Can this role edit documents? Only P1.
 */
export function canEdit(role: AdminRole): boolean {
  return role === 'P1'
}

/**
 * Can this role archive documents? Only P1.
 */
export function canArchive(role: AdminRole): boolean {
  return role === 'P1'
}

/**
 * Can this role approve/reject view requests? Only P1.
 */
export function canApproveViewRequests(role: AdminRole): boolean {
  return role === 'P1'
}

/**
 * Can this role view all documents without restriction?
 * PD, DPDA, DPDO, P1 = always yes.
 */
export function canViewAll(role: AdminRole): boolean {
  return roleHasFullAccess(role)
}