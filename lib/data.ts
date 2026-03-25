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
export async function getMasterDocuments(): Promise<(MasterDocument & { fileUrl?: string; archived?: boolean })[]> {
  const { data, error } = await supabase
    .from('master_documents').select('*').order('created_at', { ascending: true })
  if (error) { console.warn('Supabase unavailable (master_documents):', error.message); return [] }
  return (data ?? []).map(d => ({
    id: d.id, title: d.title, level: d.level, type: d.type,
    date: d.date, size: d.size, tag: d.tag, fileUrl: d.file_url ?? undefined,
    archived: d.archived ?? false,
  }))
}

export async function addMasterDocument(doc: MasterDocument & { fileUrl?: string }): Promise<void> {
  try {
    // First, sync core fields (these always exist in schema)
    const { error: coreError } = await supabase.from('master_documents').upsert({
      id: doc.id, title: doc.title, level: doc.level, type: doc.type,
      date: doc.date, size: doc.size, tag: doc.tag,
    })
    if (coreError) {
      console.error('❌ Failed to sync master document:', coreError.message, coreError.code)
      throw new Error(`Sync failed: ${coreError.message}`)
    }
    
    // Then, sync optional fields if they exist
    if (doc.fileUrl) {
      const { error: optError } = await supabase
        .from('master_documents')
        .update({ file_url: doc.fileUrl })
        .eq('id', doc.id)
      
      if (optError) {
        console.warn('⚠️ Could not sync file_url:', optError.message)
      }
    }
    
    console.log('✅ Master document synced to Supabase:', doc.id)
  } catch (e) {
    console.error('❌ Failed to sync master document:', e)
    throw e
  }
}

export async function updateMasterDocument(doc: MasterDocument & { fileUrl?: string }): Promise<void> {
  const { error } = await supabase.from('master_documents')
    .update({ title: doc.title, level: doc.level, type: doc.type, date: doc.date, tag: doc.tag })
    .eq('id', doc.id)
  if (error) console.warn('Supabase unavailable (update master_document):', error.message)
}

export async function deleteMasterDocument(id: string): Promise<void> {
  const { error } = await supabase.from('master_documents').delete().eq('id', id)
  if (error) console.warn('Supabase unavailable (delete master_document):', error.message)
}

export async function archiveMasterDocument(id: string, archivedBy: string): Promise<void> {
  try {
    console.log('🔍 Starting archive for master document:', id)
    
    // Get the document first - use safe array-based query
    const { data, error: fetchError } = await supabase
      .from('master_documents')
      .select('*')
      .eq('id', id)
    
    if (fetchError) {
      console.error('❌ Failed to fetch master document - Error details:', fetchError.message, fetchError.code)
      throw new Error(`Fetch failed: ${fetchError.message}`)
    }
    
    if (!data || data.length === 0) {
      console.warn('⚠️ Master document not found:', id)
      throw new Error(`Master document with id ${id} not found`)
    }
    
    const docData = data[0]
    console.log('✅ Found master document:', docData.title)
    
    // Update archived flag
    const { error: updateError } = await supabase
      .from('master_documents')
      .update({ archived: true })
      .eq('id', id)
    
    if (updateError) {
      console.error('❌ Failed to update archived flag:', updateError.message)
      throw new Error(`Update failed: ${updateError.message}`)
    }
    
    console.log('✅ Updated archived flag')
    
    // Add to archived_docs table (use upsert to avoid duplicate key errors)
    const today = new Date().toISOString().split('T')[0]
    const archiveRecord = {
      id,
      title: docData.title,
      type: 'Master Document',
      archived_date: today,
      archived_by: archivedBy,
      source_type: 'master_documents',
    }
    
    console.log('📝 Saving to archive:', archiveRecord)
    
    const { data: upsertData, error: upsertError } = await supabase
      .from('archived_docs')
      .upsert(archiveRecord)
      .select()
    
    if (upsertError) {
      console.error('❌ Failed to upsert to archived_docs:', upsertError.message)
      throw new Error(`Archive save failed: ${upsertError.message}`)
    }
    
    console.log('✅ Successfully archived:', upsertData)
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    console.error('❌ Archive failed:', errorMsg)
    throw e
  }
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
  try {
    // First, sync core fields (these always exist in schema)
    const { error: coreError } = await supabase.from('special_orders').upsert({
      id: so.id, reference: so.reference, subject: so.subject,
      date: so.date, attachments: so.attachments, status: so.status,
    })
    if (coreError) {
      console.error('❌ Failed to sync special order:', coreError.message, coreError.code)
      throw new Error(`Sync failed: ${coreError.message}`)
    }
    
    // Then, sync optional fields if they exist
    if (so.fileUrl) {
      const { error: optError } = await supabase
        .from('special_orders')
        .update({ file_url: so.fileUrl })
        .eq('id', so.id)
      
      if (optError) {
        console.warn('⚠️ Could not sync file_url:', optError.message)
        // Don't throw - core fields synced successfully
      }
    }
    
    console.log('✅ Special order synced to Supabase:', so.id)
  } catch (e) {
    console.error('❌ Failed to sync special order:', e)
    throw e
  }
}

export async function deleteSpecialOrder(id: string): Promise<void> {
  const { error } = await supabase.from('special_orders').delete().eq('id', id)
  if (error) console.warn('Supabase unavailable (delete special_order):', error.message)
}

// Sets status to ARCHIVED — record is kept, not deleted
export async function archiveSpecialOrder(id: string, archivedBy: string): Promise<void> {
  try {
    console.log('🔍 Starting archive for special order:', id)
    
    // Get the document first - use general select instead of single()
    const { data, error: fetchError } = await supabase
      .from('special_orders')
      .select('*')
      .eq('id', id)
    
    if (fetchError) {
      console.error('❌ Failed to fetch order - Error details:', fetchError.message, fetchError.code)
      throw new Error(`Fetch failed: ${fetchError.message}`)
    }
    
    if (!data || data.length === 0) {
      console.warn('⚠️ Order not found:', id)
      throw new Error(`Special order with id ${id} not found`)
    }
    
    const orderData = data[0]
    console.log('✅ Found order:', orderData.reference)
    
    // Update status to ARCHIVED
    const { error: updateError } = await supabase
      .from('special_orders')
      .update({ status: 'ARCHIVED' })
      .eq('id', id)
    
    if (updateError) {
      console.error('❌ Failed to update status:', updateError.message)
      throw new Error(`Update failed: ${updateError.message}`)
    }
    
    console.log('✅ Updated status to ARCHIVED')
    
    // Add to archived_docs table (use upsert to avoid duplicate key errors)
    const today = new Date().toISOString().split('T')[0]
    const archiveRecord = {
      id,
      title: orderData.subject || orderData.reference,
      type: 'Special Order',
      archived_date: today,
      archived_by: archivedBy,
      source_type: 'special_orders',
    }
    
    console.log('📝 Saving to archive:', archiveRecord)
    
    const { data: upsertData, error: upsertError } = await supabase
      .from('archived_docs')
      .upsert(archiveRecord)
      .select()
    
    if (upsertError) {
      console.error('❌ Failed to upsert to archived_docs:', upsertError.message)
      throw new Error(`Upsert failed: ${upsertError.message}`)
    }
    
    console.log('✅ Successfully archived:', upsertData)
  } catch (e) {
    console.error('❌ Archive failed:', e)
    throw e
  }
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
  try {
    // First, sync core fields (these always exist in schema)
    const { error: coreError } = await supabase.from('confidential_docs').upsert({
      id: doc.id, title: doc.title, classification: doc.classification,
      date: doc.date, access: doc.access,
    })
    if (coreError) {
      console.error('❌ Failed to sync confidential doc:', coreError.message, coreError.code)
      throw new Error(`Sync failed: ${coreError.message}`)
    }
    
    // Then, sync optional fields if they exist
    if (doc.fileUrl || doc.passwordHash) {
      const updateData: any = {}
      if (doc.fileUrl) updateData.file_url = doc.fileUrl
      if (doc.passwordHash) updateData.password_hash = doc.passwordHash
      
      const { error: optError } = await supabase
        .from('confidential_docs')
        .update(updateData)
        .eq('id', doc.id)
      
      if (optError) {
        console.warn('⚠️ Could not sync optional fields:', optError.message)
        // Don't throw - core fields synced successfully
      }
    }
    
    console.log('✅ Confidential doc synced to Supabase:', doc.id)
  } catch (e) {
    console.error('❌ Failed to sync document:', e)
    throw e
  }
}

export async function deleteConfidentialDoc(id: string): Promise<void> {
  const { error } = await supabase.from('confidential_docs').delete().eq('id', id)
  if (error) console.warn('Supabase unavailable (delete confidential_doc):', error.message)
}

// Sets archived to true — record is kept, not deleted
export async function archiveConfidentialDoc(id: string, archivedBy: string): Promise<void> {
  try {
    console.log('🔍 Starting archive for confidential doc:', id)
    
    // Get the document first - use general select instead of single()
    const { data, error: fetchError } = await supabase
      .from('confidential_docs')
      .select('*')
      .eq('id', id)
    
    if (fetchError) {
      console.error('❌ Failed to fetch doc - Error details:', fetchError.message, fetchError.code)
      throw new Error(`Fetch failed: ${fetchError.message}`)
    }
    
    if (!data || data.length === 0) {
      console.warn('⚠️ Document not found:', id)
      throw new Error(`Document with id ${id} not found`)
    }
    
    const docData = data[0]
    console.log('✅ Found document:', docData.title)
    
    // Update archived flag
    const { error: updateError } = await supabase
      .from('confidential_docs')
      .update({ archived: true })
      .eq('id', id)
    
    if (updateError) {
      console.error('❌ Failed to update archived flag:', updateError.message)
      throw new Error(`Update failed: ${updateError.message}`)
    }
    
    console.log('✅ Updated archived flag')
    
    // Add to archived_docs table (use upsert to avoid duplicate key errors)
    const today = new Date().toISOString().split('T')[0]
    const archiveRecord = {
      id,
      title: docData.title,
      type: 'Confidential Document',
      archived_date: today,
      archived_by: archivedBy,
      source_type: 'confidential_docs',
    }
    
    console.log('📝 Saving to archive:', archiveRecord)
    
    const { data: upsertData, error: upsertError } = await supabase
      .from('archived_docs')
      .upsert(archiveRecord)
      .select()
    
    if (upsertError) {
      console.error('❌ Failed to upsert to archived_docs:', upsertError.message)
      throw new Error(`Archive save failed: ${upsertError.message}`)
    }
    
    console.log('✅ Successfully archived:', upsertData)
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    console.error('❌ Archive failed:', errorMsg)
    throw e
  }
}

/* ════════════════════════════════════════════
   LIBRARY ITEMS
════════════════════════════════════════════ */
export async function getLibraryItems(): Promise<(LibraryItem & { fileUrl?: string; description?: string; archived?: boolean })[]> {
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
    archived:    d.archived     ?? false,
  }))
}

export async function addLibraryItem(
  item: LibraryItem & { fileUrl?: string; description?: string }
): Promise<void> {
  try {
    // First, sync core fields (these always exist in schema)
    const { error: coreError } = await supabase.from('library_items').upsert({
      id:          item.id,
      title:       item.title,
      category:    item.category,
      size:        item.size,
      date_added:  item.dateAdded,
    })
    if (coreError) {
      console.error('❌ Failed to sync library item:', coreError.message, coreError.code)
      throw new Error(`Sync failed: ${coreError.message}`)
    }
    
    // Then, sync optional fields if they exist
    if (item.fileUrl || item.description) {
      const updateData: any = {}
      if (item.fileUrl) updateData.file_url = item.fileUrl
      if (item.description) updateData.description = item.description
      
      const { error: optError } = await supabase
        .from('library_items')
        .update(updateData)
        .eq('id', item.id)
      
      if (optError) {
        console.warn('⚠️ Could not sync optional fields:', optError.message)
      }
    }
    
    console.log('✅ Library item synced to Supabase:', item.id)
  } catch (e) {
    console.error('❌ Failed to sync library item:', e)
    throw e
  }
}

export async function archiveLibraryItem(id: string, archivedBy: string): Promise<void> {
  try {
    console.log('🔍 Starting archive for library item:', id)
    
    // Get the document first - use safe array-based query
    const { data, error: fetchError } = await supabase
      .from('library_items')
      .select('*')
      .eq('id', id)
    
    if (fetchError) {
      console.error('❌ Failed to fetch library item - Error details:', fetchError.message, fetchError.code)
      throw new Error(`Fetch failed: ${fetchError.message}`)
    }
    
    if (!data || data.length === 0) {
      console.warn('⚠️ Library item not found:', id)
      throw new Error(`Library item with id ${id} not found`)
    }
    
    const itemData = data[0]
    console.log('✅ Found library item:', itemData.title)
    
    // Update archived flag
    const { error: updateError } = await supabase
      .from('library_items')
      .update({ archived: true })
      .eq('id', id)
    
    if (updateError) {
      console.error('❌ Failed to update archived flag:', updateError.message)
      throw new Error(`Update failed: ${updateError.message}`)
    }
    
    console.log('✅ Updated archived flag')
    
    // Add to archived_docs table (use upsert to avoid duplicate key errors)
    const today = new Date().toISOString().split('T')[0]
    const archiveRecord = {
      id,
      title: itemData.title,
      type: 'Library Item',
      archived_date: today,
      archived_by: archivedBy,
      source_type: 'library_items',
    }
    
    console.log('📝 Saving to archive:', archiveRecord)
    
    const { data: upsertData, error: upsertError } = await supabase
      .from('archived_docs')
      .upsert(archiveRecord)
      .select()
    
    if (upsertError) {
      console.error('❌ Failed to upsert to archived_docs:', upsertError.message)
      throw new Error(`Archive save failed: ${upsertError.message}`)
    }
    
    console.log('✅ Successfully archived:', upsertData)
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    console.error('❌ Archive failed:', errorMsg)
    throw e
  }
}

export async function deleteLibraryItem(id: string): Promise<void> {
  const { error } = await supabase.from('library_items').delete().eq('id', id)
  if (error) console.warn('Supabase unavailable (delete library_item):', error.message)
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
  try {
    console.log('📂 Fetching archived docs from database...')
    const { data, error } = await supabase
      .from('archived_docs')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('❌ Error fetching archived_docs:', error)
      return []
    }
    
    console.log('✅ Fetched archived docs:', data?.length || 0, 'items')
    return data ?? []
  } catch (e) {
    console.error('❌ Exception in getArchivedDocs:', e)
    return []
  }
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
  try {
    // Get the archived doc metadata - use safe array-based query
    const { data, error: fetchError } = await supabase.from('archived_docs').select('*').eq('id', id)
    if (fetchError) {
      console.error('❌ Failed to fetch archived doc - Error details:', fetchError.message, fetchError.code)
      throw new Error(`Fetch failed: ${fetchError.message}`)
    }
    if (!data || data.length === 0) {
      console.warn('⚠️ Archived document not found')
      return
    }
    
    const archivedData = data[0]
    const sourceType = archivedData.source_type
    
    // Restore based on source type
    if (sourceType === 'special_orders') {
      const { error: updateError } = await supabase.from('special_orders').update({ status: 'ACTIVE' }).eq('id', id)
      if (updateError) throw updateError
    } else if (sourceType === 'confidential_docs') {
      const { error: updateError } = await supabase.from('confidential_docs').update({ archived: false }).eq('id', id)
      if (updateError) throw updateError
    } else if (sourceType === 'library_items') {
      const { error: updateError } = await supabase.from('library_items').update({ archived: false }).eq('id', id)
      if (updateError) throw updateError
    } else if (sourceType === 'master_documents') {
      const { error: updateError } = await supabase.from('master_documents').update({ archived: false }).eq('id', id)
      if (updateError) throw updateError
    }
    
    // Delete from archived_docs
    const { error } = await supabase.from('archived_docs').delete().eq('id', id)
    if (error) throw error
  } catch (e) {
    console.warn('Supabase unavailable (restore archived_doc):', e)
  }
}

/* ════════════════════════════════════════════
   ORG CHART — placeholder
════════════════════════════════════════════ */
export const ORG_CHART: OrgNode = {
  id: 'org-root', initials: '--', rank: '', name: 'No Data',
  title: 'Add personnel to populate the org chart', unit: '', color: '#94a3b8', children: [],
}

/* ════════════════════════════════════════════
   DASHBOARD COUNTS
════════════════════════════════════════════ */
export async function getDashboardCounts(): Promise<{
  masterDocs: number
  specialOrders: number
  confidentialDocs: number
  personnelRecords: number
}> {
  try {
    const { data, error } = await supabase
      .from('dashboard_counts').select('*')
    if (error) {
      console.warn('Supabase unavailable (dashboard_counts):', error.message, error.code)
      return { masterDocs: 0, specialOrders: 0, confidentialDocs: 0, personnelRecords: 0 }
    }
    if (!data || data.length === 0) {
      console.warn('⚠️ Dashboard counts not found - returning fallback')
      return { masterDocs: 0, specialOrders: 0, confidentialDocs: 0, personnelRecords: 0 }
    }
    const countsData = data[0]
    return {
      masterDocs: countsData.master_docs ?? 0,
      specialOrders: countsData.special_orders ?? 0,
      confidentialDocs: countsData.confidential_docs ?? 0,
      personnelRecords: countsData.personnel_records ?? 0,
    }
  } catch (e) {
    console.warn('Supabase unavailable, using fallback counts:', e)
    return { masterDocs: 0, specialOrders: 0, confidentialDocs: 0, personnelRecords: 0 }
  }
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