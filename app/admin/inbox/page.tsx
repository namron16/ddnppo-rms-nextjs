'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, Archive, Inbox, FileText, Paperclip } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useDisclosure } from '@/hooks'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import {
  archiveP1InboxItem,
  getP1InboxItems,
  markP1InboxItemRead,
  type P1InboxItem,
  type P1InboxItemKind,
  type P1InboxStatus,
} from '@/lib/p1Inbox'

const KIND_META: Record<P1InboxItemKind, { label: string; icon: string; className: string }> = {
  document: { label: 'Document', icon: '📄', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  attachment: { label: 'Attachment', icon: '📎', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
}

const STATUS_META: Record<P1InboxStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  read: { label: 'Read', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  archived: { label: 'Archived', className: 'bg-slate-100 text-slate-600 border-slate-200' },
}

type FilterValue = 'all' | P1InboxStatus

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function fileTypeIcon(fileName: string): string {
  if (/\.pdf$/i.test(fileName)) return '📕'
  if (/\.docx?$/i.test(fileName)) return '📘'
  if (/\.xlsx?$/i.test(fileName)) return '📗'
  if (/\.(jpg|jpeg|png|webp)$/i.test(fileName)) return '🖼️'
  return '📄'
}

export default function P1InboxPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<P1InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterValue>('all')
  const [refreshing, setRefreshing] = useState(false)
  const archiveDisc = useDisclosure<P1InboxItem>()

  const isP1 = user?.role === 'P1'

  const loadInbox = useCallback(async () => {
    if (!isP1) {
      setItems([])
      setLoading(false)
      return
    }

    setRefreshing(true)
    const data = await getP1InboxItems('P1')
    setItems(data)
    setLoading(false)
    setRefreshing(false)
  }, [isP1])

  useEffect(() => {
    void loadInbox()
  }, [loadInbox])

  useEffect(() => {
    if (!isP1) return

    const channel = supabase
      .channel('p1_inbox_items_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'p1_inbox_items', filter: 'recipient_id=eq.P1' },
        payload => {
          const next = payload.new as P1InboxItem
          setItems(prev => {
            if (prev.some(item => item.id === next.id)) return prev
            return [next, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'p1_inbox_items', filter: 'recipient_id=eq.P1' },
        payload => {
          const next = payload.new as P1InboxItem
          setItems(prev => prev.map(item => item.id === next.id ? next : item))
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isP1])

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(item => {
      const matchQuery = !q || [item.title, item.file_name, item.sender_id, item.notes ?? ''].some(value => value.toLowerCase().includes(q))
      const matchFilter = filter === 'all' || item.status === filter
      return matchQuery && matchFilter
    })
  }, [filter, items, query])

  const stats = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter(item => item.status === 'pending').length,
      read: items.filter(item => item.status === 'read').length,
      archived: items.filter(item => item.status === 'archived').length,
    }
  }, [items])

  async function handleOpen(item: P1InboxItem) {
    if (item.status === 'pending') {
      const ok = await markP1InboxItemRead(item.id)
      if (ok) {
        setItems(prev => prev.map(entry => entry.id === item.id ? { ...entry, status: 'read', read_at: new Date().toISOString() } : entry))
      }
    }
    window.open(item.file_url, '_blank', 'noopener,noreferrer')
  }

  async function handleMarkRead(item: P1InboxItem) {
    const ok = await markP1InboxItemRead(item.id)
    if (!ok) {
      toast.error('Could not mark item as read.')
      return
    }
    setItems(prev => prev.map(entry => entry.id === item.id ? { ...entry, status: 'read', read_at: new Date().toISOString() } : entry))
    toast.success('Inbox item marked as read.')
  }

  async function handleArchive() {
    const item = archiveDisc.payload
    if (!item) return

    const ok = await archiveP1InboxItem(item.id)
    if (!ok) {
      toast.error('Could not archive inbox item.')
      return
    }

    setItems(prev => prev.map(entry => entry.id === item.id ? { ...entry, status: 'archived', archived_at: new Date().toISOString() } : entry))
    toast.success('Inbox item archived.')
    archiveDisc.close()
  }

  return (
    <>
      <PageHeader title="P1 Inbox" />

      <div className="p-8 space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Total</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-black text-slate-800">{stats.total}</p>
              <Inbox className="h-6 w-6 text-slate-300" />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Pending</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-black text-amber-700">{stats.pending}</p>
              <Paperclip className="h-6 w-6 text-amber-300" />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Read</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-black text-emerald-700">{stats.read}</p>
              <Eye className="h-6 w-6 text-emerald-300" />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Archived</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-black text-slate-700">{stats.archived}</p>
              <Archive className="h-6 w-6 text-slate-300" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">Forwarded Items</h2>
              <p className="mt-1 text-sm text-slate-500">Files and attachments sent by other roles for P1 review.</p>
            </div>
            <div className="flex items-center gap-2">
              {refreshing && <span className="text-xs font-medium text-slate-400">Refreshing…</span>}
              <Button variant="outline" size="sm" onClick={loadInbox}>Refresh</Button>
            </div>
          </div>

          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SearchInput value={query} onChange={setQuery} placeholder="Search inbox…" className="w-full lg:max-w-sm" />
            <div className="flex flex-wrap items-center gap-2">
              {(['all', 'pending', 'read', 'archived'] as const).map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition ${
                    filter === value ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon="📥"
              title="Inbox is empty"
              description={query ? 'No inbox items matched your search.' : 'Forwarded files from other roles will appear here.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {['Item', 'Source', 'Status', 'Received', 'Actions'].map(header => (
                      <th key={header} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const kindMeta = KIND_META[item.item_kind]
                    const statusMeta = STATUS_META[item.status]
                    const icon = fileTypeIcon(item.file_name)

                    return (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition">
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 flex-shrink-0">{icon}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-slate-800 truncate max-w-[280px]">{item.title}</p>
                                <Badge className={kindMeta.className}>{kindMeta.icon} {kindMeta.label}</Badge>
                              </div>
                              <p className="text-xs text-slate-400 truncate max-w-[360px]">{item.file_name} · {item.file_size}</p>
                              {item.notes && <p className="mt-1 text-xs text-slate-500 max-w-[420px]">{item.notes}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top text-sm text-slate-600">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-800">{item.sender_id}</p>
                            <p className="text-xs text-slate-400">{item.source_document_id ? `Source: ${item.source_document_id}` : 'Forwarded item'}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                        </td>
                        <td className="px-5 py-4 align-top text-sm text-slate-600">
                          <div className="space-y-1">
                            <p>{new Date(item.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                            <p className="text-xs text-slate-400">{timeAgo(item.created_at)}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleOpen(item)}>
                              <Eye size={14} /> Open
                            </Button>
                            {item.status === 'pending' && (
                              <Button variant="primary" size="sm" onClick={() => void handleMarkRead(item)}>
                                Mark Read
                              </Button>
                            )}
                            {item.status !== 'archived' && (
                              <Button variant="ghost" size="sm" onClick={() => archiveDisc.open(item)}>
                                <Archive size={14} /> Archive
                              </Button>
                            )}
                            <a href={item.file_url} download target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm">
                                Download
                              </Button>
                            </a>
                          </div>
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

      <ConfirmDialog
        open={archiveDisc.isOpen}
        title="Archive Inbox Item"
        message={`Archive "${archiveDisc.payload?.title ?? 'this item'}" from the P1 inbox?`}
        confirmLabel="Archive"
        variant="danger"
        onConfirm={() => void handleArchive()}
        onCancel={archiveDisc.close}
      />
    </>
  )
}
