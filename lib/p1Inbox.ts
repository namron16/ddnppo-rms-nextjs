import { supabase } from './supabase'
import type { AdminRole } from './auth'

export type P1InboxItemKind = 'document' | 'attachment'
export type P1InboxStatus = 'pending' | 'read' | 'archived'

export interface P1InboxItem {
  id: string
  recipient_id: AdminRole
  sender_id: AdminRole
  item_kind: P1InboxItemKind
  title: string
  file_name: string
  file_url: string
  file_size: string
  file_type: string
  source_document_id: string | null
  source_attachment_id: string | null
  notes: string | null
  status: P1InboxStatus
  created_at: string
  read_at: string | null
  archived_at: string | null
}

function normalizeInboxItem(row: any): P1InboxItem {
  return {
    id: row.id,
    recipient_id: row.recipient_id ?? 'P1',
    sender_id: row.sender_id,
    item_kind: row.item_kind,
    title: row.title,
    file_name: row.file_name,
    file_url: row.file_url,
    file_size: row.file_size,
    file_type: row.file_type,
    source_document_id: row.source_document_id ?? null,
    source_attachment_id: row.source_attachment_id ?? null,
    notes: row.notes ?? null,
    status: row.status ?? 'pending',
    created_at: row.created_at,
    read_at: row.read_at ?? null,
    archived_at: row.archived_at ?? null,
  }
}

export async function getP1InboxItems(recipientId: AdminRole = 'P1'): Promise<P1InboxItem[]> {
  const { data, error } = await supabase
    .from('p1_inbox_items')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('Supabase unavailable (p1_inbox_items):', error.message)
    return []
  }

  return (data ?? []).map(normalizeInboxItem)
}

export async function addP1InboxItem(
  item: Omit<P1InboxItem, 'created_at' | 'status' | 'read_at' | 'archived_at'>
): Promise<P1InboxItem | null> {
  const { data, error } = await supabase
    .from('p1_inbox_items')
    .insert({
      ...item,
      created_at: new Date().toISOString(),
      status: 'pending',
      read_at: null,
      archived_at: null,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to add p1_inbox_item:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    return null
  }

  return normalizeInboxItem(data)
}

export async function forwardToP1Inbox(
  item: {
    senderId: AdminRole
    itemKind: P1InboxItemKind
    title: string
    fileName: string
    fileUrl: string
    fileSize: string
    fileType: string
    sourceDocumentId?: string | null
    sourceAttachmentId?: string | null
    notes?: string | null
  }
): Promise<P1InboxItem | null> {
  return addP1InboxItem({
    id: `inbox-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    recipient_id: 'P1',
    sender_id: item.senderId,
    item_kind: item.itemKind,
    title: item.title,
    file_name: item.fileName,
    file_url: item.fileUrl,
    file_size: item.fileSize,
    file_type: item.fileType,
    source_document_id: item.sourceDocumentId ?? null,
    source_attachment_id: item.sourceAttachmentId ?? null,
    notes: item.notes ?? null,
  })
}

export async function markP1InboxItemRead(itemId: string): Promise<boolean> {
  const { error } = await supabase
    .from('p1_inbox_items')
    .update({
      status: 'read',
      read_at: new Date().toISOString(),
    })
    .eq('id', itemId)

  if (error) {
    console.warn('Failed to mark inbox item as read:', error.message)
    return false
  }

  return true
}

export async function archiveP1InboxItem(itemId: string): Promise<boolean> {
  const { error } = await supabase
    .from('p1_inbox_items')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
    })
    .eq('id', itemId)

  if (error) {
    console.warn('Failed to archive inbox item:', error.message)
    return false
  }

  return true
}