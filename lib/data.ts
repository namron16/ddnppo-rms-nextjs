// lib/data.ts
import { supabase } from './supabase'
import type {
  User, MasterDocument, SpecialOrder,
  JournalEntry, ConfidentialDoc, LibraryItem,
  ActivityLog, OrgNode
} from '@/types'

/* ════════════════════════════════════════════
   USERS — kept for authentication only
════════════════════════════════════════════ */
export const USERS: User[] = [
  { id: '1', name: 'Ramon Dela Cruz', email: 'rdelacruz@ddnppo.gov.ph', role: 'admin',   initials: 'RD', avatarColor: '#f0b429' },
  { id: '2', name: 'Ana Santos',      email: 'asantos@ddnppo.gov.ph',   role: 'officer', initials: 'AS', avatarColor: '#3b63b8' },
  { id: '3', name: 'Jose Reyes',      email: 'jreyes@ddnppo.gov.ph',    role: 'officer', initials: 'JR', avatarColor: '#8b5cf6' },
]

/* ════════════════════════════════════════════
   MASTER DOCUMENTS
════════════════════════════════════════════ */
export async function getMasterDocuments(): Promise<(MasterDocument & { fileUrl?: string })[]> {
  const { data, error } = await supabase
    .from('master_documents').select('*').order('created_at', { ascending: true })
  if (error) { console.warn('Supabase unavailable (master_documents):', error.message); return [] }
  return (data ?? []).map(d => ({
    id: d.id, title: d.title, level: d.level, type: d.type,
    date: d.date, size: d.size, tag: d.tag, fileUrl: d.file_url ?? undefined,
    taggedAdminAccess: d.tagged_admin_access ? d.tagged_admin_access.split(',').map((s: string) => s.trim()) : undefined,
  }))
}

export async function addMasterDocument(doc: MasterDocument & { fileUrl?: string }): Promise<void> {
  const { error } = await supabase.from('master_documents').insert({
    id: doc.id, title: doc.title, level: doc.level, type: doc.type,
    date: doc.date, size: doc.size, tag: doc.tag, file_url: doc.fileUrl ?? null,
    tagged_admin_access: doc.taggedAdminAccess ? doc.taggedAdminAccess.join(',') : null,
  })
  if (error) console.warn('Supabase unavailable (add master_document):', error.message)
}

export async function updateMasterDocument(doc: MasterDocument & { fileUrl?: string }): Promise<void> {
  const { error } = await supabase.from('master_documents')
    .update({
      title: doc.title, level: doc.level, type: doc.type, date: doc.date, tag: doc.tag,
      tagged_admin_access: doc.taggedAdminAccess ? doc.taggedAdminAccess.join(',') : null,
    })
    .eq('id', doc.id)
  if (error) console.warn('Supabase unavailable (update master_document):', error.message)
}

// Soft-archive master document by setting archived flag when available.
export async function archiveMasterDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from('master_documents')
    .update({ archived: true })
    .eq('id', id)
  if (error) console.warn('Supabase unavailable (archive master_document):', error.message)
}

export async function deleteMasterDocument(id: string): Promise<void> {
  const { error } = await supabase.from('master_documents').delete().eq('id', id)
  if (error) console.warn('Supabase unavailable (delete master_document):', error.message)
}

/* ════════════════════════════════════════════
   SPECIAL ORDERS
════════════════════════════════════════════ */
export async function getSpecialOrders(): Promise<(SpecialOrder & { fileUrl?: string })[]> {
  const { data, error } = await supabase
    .from('special_orders').select('*').order('created_at', { ascending: false })
  if (error) { console.warn('Supabase unavailable (special_orders):', error.message); return [] }
  return (data ?? []).map(d => ({
    id: d.id, reference: d.reference, subject: d.subject,
    date: d.date, attachments: d.attachments, status: d.status,
    fileUrl: d.file_url ?? undefined,
  }))
}

export async function addSpecialOrder(so: SpecialOrder & { fileUrl?: string }): Promise<void> {
  const { error } = await supabase.from('special_orders').insert({
    id: so.id, reference: so.reference, subject: so.subject,
    date: so.date, attachments: so.attachments, status: so.status,
    file_url: so.fileUrl ?? null,
  })
  if (error) console.warn('Supabase unavailable (add special_order):', error.message)
}

export async function updateSpecialOrderAttachment(id: string, fileUrl: string, attachments = 1): Promise<void> {
  const { error } = await supabase
    .from('special_orders')
    .update({ file_url: fileUrl, attachments })
    .eq('id', id)
  if (error) console.warn('Supabase unavailable (update special_order attachment):', error.message)
}

export interface SpecialOrderAttachment {
  id: string
  special_order_id: string
  file_name: string
  file_url: string
  file_size: string
  file_type: string
  uploaded_at: string
  uploaded_by: string
  archived: boolean
}

function normaliseSpecialOrderAttachment(row: any): SpecialOrderAttachment {
  return {
    id: row.id,
    special_order_id: row.special_order_id,
    file_name: row.file_name,
    file_url: row.file_url,
    file_size: row.file_size,
    file_type: row.file_type,
    uploaded_at: row.uploaded_at,
    uploaded_by: row.uploaded_by,
    archived: row.archived === true,
  }
}

export async function getSpecialOrderAttachments(specialOrderId: string): Promise<SpecialOrderAttachment[]> {
  const { data, error } = await supabase
    .from('special_order_attachments')
    .select('*')
    .eq('special_order_id', specialOrderId)
    .order('uploaded_at', { ascending: true })

  if (error) {
    console.warn('Supabase unavailable (special_order_attachments):', error.message)
    return []
  }

  return (data ?? []).map(normaliseSpecialOrderAttachment)
}

export async function addSpecialOrderAttachment(
  attachment: Omit<SpecialOrderAttachment, 'uploaded_at'>
): Promise<SpecialOrderAttachment | null> {
  const { data, error } = await supabase
    .from('special_order_attachments')
    .insert({ ...attachment, uploaded_at: new Date().toISOString() })
    .select()
    .single()

  if (error) {
    console.error('Failed to add special_order_attachment:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    return null
  }

  return normaliseSpecialOrderAttachment(data)
}

export async function archiveSpecialOrderAttachment(attachmentId: string): Promise<void> {
  const { error } = await supabase
    .from('special_order_attachments')
    .update({ archived: true })
    .eq('id', attachmentId)

  if (error) console.warn('Supabase unavailable (archive special_order_attachment):', error.message)
}

export async function renameSpecialOrderAttachment(attachmentId: string, fileName: string): Promise<boolean> {
  const nextName = fileName.trim()
  if (!nextName) return false

  const { error } = await supabase
    .from('special_order_attachments')
    .update({ file_name: nextName })
    .eq('id', attachmentId)

  if (error) {
    console.warn('Supabase unavailable (rename special_order_attachment):', error.message)
    return false
  }

  return true
}

export async function syncSpecialOrderAttachmentMeta(specialOrderId: string): Promise<{ attachments: number; fileUrl?: string }> {
  const { data, error } = await supabase
    .from('special_order_attachments')
    .select('*')
    .eq('special_order_id', specialOrderId)
    .eq('archived', false)
    .order('uploaded_at', { ascending: false })

  if (error) {
    console.warn('Supabase unavailable (sync special_order meta):', error.message)
    return { attachments: 0 }
  }

  const active = (data ?? []).map(normaliseSpecialOrderAttachment)
  const latestUrl = active.length > 0 ? active[0].file_url : null

  const { error: updateError } = await supabase
    .from('special_orders')
    .update({ attachments: active.length, file_url: latestUrl })
    .eq('id', specialOrderId)

  if (updateError) {
    console.warn('Supabase unavailable (update special_order meta):', updateError.message)
  }

  return {
    attachments: active.length,
    fileUrl: latestUrl ?? undefined,
  }
}

export async function deleteSpecialOrder(id: string): Promise<void> {
  const { error } = await supabase.from('special_orders').delete().eq('id', id)
  if (error) console.warn('Supabase unavailable (delete special_order):', error.message)
}

// Sets status to ARCHIVED — record is kept, not deleted
export async function archiveSpecialOrder(id: string): Promise<void> {
  const { error } = await supabase
    .from('special_orders').update({ status: 'ARCHIVED' }).eq('id', id)
  if (error) console.warn('Supabase unavailable (archive special_order):', error.message)
}

/* ════════════════════════════════════════════
   CONFIDENTIAL DOCUMENTS
════════════════════════════════════════════ */
export async function getConfidentialDocs(): Promise<(ConfidentialDoc & { fileUrl?: string; passwordHash?: string; archived?: boolean })[]> {
  const { data, error } = await supabase
    .from('confidential_docs').select('*').order('created_at', { ascending: false })
  if (error) { console.warn('Supabase unavailable (confidential_docs):', error.message); return [] }
  return (data ?? []).map(d => ({
    id: d.id, title: d.title, classification: d.classification,
    date: d.date, access: d.access,
    fileUrl:      d.file_url      ?? undefined,
    passwordHash: d.password_hash ?? undefined,
    archived:     d.archived      ?? false,
  }))
}

export async function addConfidentialDoc(
  doc: ConfidentialDoc & { fileUrl?: string; passwordHash?: string }
): Promise<void> {
  const { error } = await supabase.from('confidential_docs').insert({
    id: doc.id, title: doc.title, classification: doc.classification,
    date: doc.date, access: doc.access,
    file_url:      doc.fileUrl      ?? null,
    password_hash: doc.passwordHash ?? null,
  })
  if (error) console.warn('Supabase unavailable (add confidential_doc):', error.message)
}

export async function deleteConfidentialDoc(id: string): Promise<void> {
  const { error } = await supabase.from('confidential_docs').delete().eq('id', id)
  if (error) console.warn('Supabase unavailable (delete confidential_doc):', error.message)
}

// Sets archived to true — record is kept, not deleted
export async function archiveConfidentialDoc(id: string): Promise<void> {
  const { error } = await supabase
    .from('confidential_docs').update({ archived: true }).eq('id', id)
  if (error) console.warn('Supabase unavailable (archive confidential_doc):', error.message)
}

/* ════════════════════════════════════════════
   LIBRARY ITEMS
════════════════════════════════════════════ */
export async function getLibraryItems(): Promise<(LibraryItem & { fileUrl?: string; description?: string })[]> {
  const { data, error } = await supabase
    .from('library_items').select('*').order('created_at', { ascending: false })
  if (error) { console.warn('Supabase unavailable (library_items):', error.message); return [] }
  return (data ?? []).map(d => ({
    id:          d.id,
    title:       d.title,
    category:    d.category,
    size:        d.size,
    dateAdded:   d.date_added,
    fileUrl:     d.file_url     ?? undefined,
    description: d.description  ?? undefined,
  }))
}

export async function addLibraryItem(
  item: LibraryItem & { fileUrl?: string; description?: string }
): Promise<void> {
  const { error } = await supabase.from('library_items').insert({
    id:          item.id,
    title:       item.title,
    category:    item.category,
    size:        item.size,
    date_added:  item.dateAdded,
    file_url:    item.fileUrl    ?? null,
    description: item.description ?? null,
  })
  if (error) console.warn('Supabase unavailable (add library_item):', error.message)
}

export async function deleteLibraryItem(id: string): Promise<void> {
  const { error } = await supabase.from('library_items').delete().eq('id', id)
  if (error) console.warn('Supabase unavailable (delete library_item):', error.message)
}

// Soft-archive library item by setting archived flag when available.
export async function archiveLibraryItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('library_items')
    .update({ archived: true })
    .eq('id', id)
  if (error) console.warn('Supabase unavailable (archive library_item):', error.message)
}

/* ════════════════════════════════════════════
   ACTIVITY LOGS
════════════════════════════════════════════ */
export async function getActivityLogs(): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs').select('*').order('created_at', { ascending: false })
  if (error) { console.warn('Supabase unavailable (activity_logs):', error.message); return [] }
  return (data ?? []).map(d => ({
    id: d.id, user: d.user_name, userInitials: d.user_initials, userColor: d.user_color,
    action: d.action, document: d.document, date: d.date, time: d.time, device: d.device,
  }))
}

export async function addActivityLog(log: ActivityLog): Promise<void> {
  const { error } = await supabase.from('activity_logs').insert({
    id: log.id, user_name: log.user, user_initials: log.userInitials,
    user_color: log.userColor, action: log.action, document: log.document,
    date: log.date, time: log.time, device: log.device,
  })
  if (error) console.warn('Supabase unavailable (add activity_log):', error.message)
}

/* ════════════════════════════════════════════
   ARCHIVED DOCUMENTS
════════════════════════════════════════════ */
export async function getArchivedDocs() {
  const { data, error } = await supabase
    .from('archived_docs').select('*').order('created_at', { ascending: false })
  if (error) { console.warn('Supabase unavailable (archived_docs):', error.message); return [] }
  return data ?? []
}

export async function addArchivedDoc(item: {
  id: string; title: string; type: string; archivedDate: string; archivedBy: string
}): Promise<void> {
  const { error } = await supabase.from('archived_docs').insert({
    id: item.id, title: item.title, type: item.type,
    archived_date: item.archivedDate, archived_by: item.archivedBy,
  })
  if (error) console.warn('Supabase unavailable (add archived_doc):', error.message)
}

export async function deleteArchivedDoc(id: string): Promise<void> {
  const { error } = await supabase.from('archived_docs').delete().eq('id', id)
  if (error) console.warn('Supabase unavailable (delete archived_doc):', error.message)
}

export async function restoreArchivedDoc(id: string): Promise<void> {
  const { data: archived, error: fetchError } = await supabase
    .from('archived_docs')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    console.warn('Supabase unavailable (fetch archived_doc):', fetchError.message)
  }

  const archiveType = String(archived?.type ?? '').toLowerCase()

  if (id.startsWith('arc-so-') || archiveType === 'special order') {
    const sourceId = id.startsWith('arc-so-') ? id.replace('arc-so-', '') : undefined
    if (sourceId) {
      const { error } = await supabase
        .from('special_orders')
        .update({ status: 'ACTIVE' })
        .eq('id', sourceId)
      if (error) console.warn('Supabase unavailable (restore special_order):', error.message)
    }
  }

  if (id.startsWith('arc-cd-') || archiveType === 'classified document') {
    const sourceId = id.startsWith('arc-cd-') ? id.replace('arc-cd-', '') : undefined
    if (sourceId) {
      const { error } = await supabase
        .from('confidential_docs')
        .update({ archived: false })
        .eq('id', sourceId)
      if (error) console.warn('Supabase unavailable (restore confidential_doc):', error.message)
    }
  }

  if (id.startsWith('arc-md-') || archiveType === 'master document') {
    const sourceId = id.startsWith('arc-md-') ? id.replace('arc-md-', '') : undefined
    if (sourceId) {
      const { error } = await supabase
        .from('master_documents')
        .update({ archived: false })
        .eq('id', sourceId)
      if (error) console.warn('Supabase unavailable (restore master_document):', error.message)
    }
  }

  if (id.startsWith('arc-lib-') || archiveType === 'library item') {
    const sourceId = id.startsWith('arc-lib-') ? id.replace('arc-lib-', '') : undefined
    if (sourceId) {
      const { error } = await supabase
        .from('library_items')
        .update({ archived: false })
        .eq('id', sourceId)
      if (error) console.warn('Supabase unavailable (restore library_item):', error.message)
    }
  }

  const { error } = await supabase.from('archived_docs').delete().eq('id', id)
  if (error) console.warn('Supabase unavailable (delete archived_doc on restore):', error.message)
}

/* ════════════════════════════════════════════
   ORG CHART — placeholder
════════════════════════════════════════════ */
export const ORG_CHART: OrgNode = {
  id: 'org-root', initials: '--', rank: '', name: 'No Data',
  title: 'Add personnel to populate the org chart', unit: '', color: '#94a3b8', children: [],
}

/* ════════════════════════════════════════════
   LEGACY EXPORTS
════════════════════════════════════════════ */
export const MASTER_DOCUMENTS:  MasterDocument[]  = []
export const SPECIAL_ORDERS:    SpecialOrder[]    = []
export const JOURNAL_ENTRIES:   JournalEntry[]    = []
export const CONFIDENTIAL_DOCS: ConfidentialDoc[] = []
export const LIBRARY_ITEMS:     LibraryItem[]     = []
export const ACTIVITY_LOGS:     ActivityLog[]     = []