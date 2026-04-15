'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { ToolbarSelect } from '@/components/ui/Toolbar'
import { useToast } from '@/components/ui/Toast'
import { AddJournalEntryModal } from '@/components/modals/AddJournalEntryModal'
import { useDisclosure, useModal, useSearch } from '@/hooks'
import { useRealtimeDailyJournals } from '@/hooks/useRealtimeCollections'
import { logViewDocument } from '@/lib/adminLogger'
import type { AddJournalEntryInput } from '@/lib/validations'
import type { JournalEntry } from '@/types'
import { addArchivedDoc, addDailyJournal, archiveDailyJournal, getDailyJournals, updateDailyJournal, type DailyJournalRecord } from '@/lib/data'

type JournalStatus = 'Draft' | 'Filed' | 'Reviewed'

type JournalRecord = DailyJournalRecord & {
  content: string
  summary: string
  status: JournalStatus
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

function typeBadgeClass(type: JournalEntry['type']) {
  switch (type) {
    case 'MEMO': return 'bg-blue-50 text-blue-700 border border-blue-200'
    case 'REPORT': return 'bg-amber-50 text-amber-700 border border-amber-200'
    case 'LOG': return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    default: return 'bg-slate-50 text-slate-700 border border-slate-200'
  }
}

function statusBadgeClass(status: JournalStatus) {
  switch (status) {
    case 'Draft': return 'bg-slate-100 text-slate-600 border border-slate-200'
    case 'Filed': return 'bg-sky-50 text-sky-700 border border-sky-200'
    case 'Reviewed': return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    default: return 'bg-slate-100 text-slate-600 border border-slate-200'
  }
}

function ViewJournalModal({
  entry,
  open,
  onClose,
}: {
  entry: JournalRecord | null
  open: boolean
  onClose: () => void
}) {
  if (!entry) return null

  return (
    <Modal open={open} onClose={onClose} title="Journal Entry" width="max-w-4xl">
      <div className="p-6 space-y-4">
        <div className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Title</p>
            <p className="text-sm font-bold text-slate-800">{entry.title}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{entry.summary}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Type</p>
              <Badge className={typeBadgeClass(entry.type)}>{entry.type}</Badge>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Status</p>
              <Badge className={statusBadgeClass(entry.status)}>{entry.status}</Badge>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Author</p>
              <p className="font-semibold text-slate-700">{entry.author}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Date</p>
              <p className="font-semibold text-slate-700">{formatDate(entry.date)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entry Content</span>
            <span className="text-xs text-slate-400">{entry.attachments} attachment{entry.attachments === 1 ? '' : 's'}</span>
          </div>
          <div className="p-4 bg-white">
            <p className="text-sm leading-7 text-slate-600 whitespace-pre-wrap">{entry.content}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

export default function DailyJournalsPage() {
  const { toast } = useToast()
  const addModal = useModal()
  const editDisc = useDisclosure<JournalRecord>()
  const viewDisc = useDisclosure<JournalRecord>()
  const archiveDisc = useDisclosure<JournalRecord>()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<JournalRecord[]>([])
  useRealtimeDailyJournals(setEntries)
  const [activeType, setActiveType] = useState<'ALL' | JournalEntry['type']>('ALL')

  const { query, setQuery, filtered: searched } = useSearch(entries, ['title', 'author', 'content'] as Array<keyof JournalRecord>) 

  const filteredEntries = useMemo(() => {
    return searched.filter(entry => activeType === 'ALL' || entry.type === activeType)
  }, [activeType, searched])

  const journalStats = useMemo(() => ({
    all: entries.length,
    memo: entries.filter(entry => entry.type === 'MEMO').length,
    report: entries.filter(entry => entry.type === 'REPORT').length,
    log: entries.filter(entry => entry.type === 'LOG').length,
  }), [entries])

  useEffect(() => {
    let isMounted = true

    async function loadDailyJournals() {
      const data = await getDailyJournals()
      if (!isMounted) return

      const normalised: JournalRecord[] = data.map(entry => ({
        ...entry,
        content: entry.content ?? 'No content was provided for this entry.',
        summary: entry.summary ?? (entry.content?.slice(0, 120) || 'No summary available.'),
        status: (entry.status ?? 'Draft') as JournalStatus,
      }))

      setEntries(normalised)
      setLoading(false)
    }

    loadDailyJournals()

    return () => {
      isMounted = false
    }
  }, [])

  async function handleCreate(input: AddJournalEntryInput) {
    const now = new Date()
    const status: JournalStatus = input.type === 'MEMO' ? 'Draft' : input.type === 'REPORT' ? 'Reviewed' : 'Filed'

    const nextEntry: JournalRecord = {
      id: `jrnl-${Date.now()}`,
      title: input.title.trim(),
      type: input.type,
      author: input.author.trim(),
      date: input.date || now.toISOString().split('T')[0],
      content: input.content?.trim() || 'No content was provided for this entry.',
      status,
      attachments: 0,
      summary: input.content?.trim()
        ? input.content.trim().slice(0, 120)
        : 'Newly created entry waiting for final review.',
    }

    await addDailyJournal(nextEntry)
    setEntries(prev => [nextEntry, ...prev])
    addModal.close()
    viewDisc.close()
  }

    async function handleEdit(input: AddJournalEntryInput) {
      const existing = editDisc.payload
      if (!existing) return

      const updatedEntry: JournalRecord = {
        ...existing,
        title: input.title.trim(),
        type: input.type,
        author: input.author.trim(),
        date: input.date,
        content: input.content?.trim() || 'No content was provided for this entry.',
        summary: input.content?.trim()
          ? input.content.trim().slice(0, 120)
          : 'Updated journal entry.',
        status: input.type === 'MEMO' ? 'Draft' : input.type === 'REPORT' ? 'Reviewed' : 'Filed',
      }

      await updateDailyJournal(updatedEntry)
      setEntries(prev => prev.map(entry => entry.id === updatedEntry.id ? updatedEntry : entry))
      if (viewDisc.payload?.id === updatedEntry.id) {
        viewDisc.open(updatedEntry)
      }
      editDisc.close()
    }

    async function handleArchive() {
      const item = archiveDisc.payload
      if (!item) return

      const today = new Date().toISOString().split('T')[0]

      await archiveDailyJournal(item.id)
      await addArchivedDoc({
        id: `arc-dj-${item.id}`,
        title: item.title,
        type: 'Daily Journal',
        archivedDate: today,
        archivedBy: 'Admin',
      })

      setEntries(prev => prev.filter(entry => entry.id !== item.id))
      if (viewDisc.payload?.id === item.id) {
        viewDisc.close()
      }
      archiveDisc.close()
      toast.success(`"${item.title}" has been archived.`)
    }

  return (
    <>
      <PageHeader title="Daily Journals" />

      <div className="p-8 space-y-6">
        <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.02),rgba(14,165,233,0.06))]" />
          <div className="relative grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr] lg:p-7">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Operations logbook</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Daily Journal Register</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Review daily memos, reports, and logs in a clean register styled after the e-Library page.
                Use the filters to narrow the list and open any entry for a detailed view.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Searchable register</span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Tabbed entry types</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Quick add modal</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 self-start">
              {[
                { label: 'Total Entries', value: journalStats.all, icon: '📒', bg: 'bg-blue-50', text: 'text-blue-700' },
                { label: 'Memos', value: journalStats.memo, icon: '📝', bg: 'bg-amber-50', text: 'text-amber-700' },
                { label: 'Reports', value: journalStats.report, icon: '📋', bg: 'bg-violet-50', text: 'text-violet-700' },
                { label: 'Logs', value: journalStats.log, icon: '🗂️', bg: 'bg-emerald-50', text: 'text-emerald-700' },
              ].map(card => (
                <div key={card.label} className={`${card.bg} rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3`}>
                  <span className="text-2xl">{card.icon}</span>
                  <div>
                    <div className={`text-2xl font-extrabold ${card.text}`}>{card.value}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{card.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50 flex-wrap">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search journal entries…"
              className="max-w-xs flex-1"
            />
            <ToolbarSelect value={activeType} onChange={e => setActiveType(e.target.value as 'ALL' | JournalEntry['type'])}>
              <option value="ALL">All Types</option>
              <option value="MEMO">Memo</option>
              <option value="REPORT">Report</option>
              <option value="LOG">Log</option>
            </ToolbarSelect>
            <Button variant="primary" size="sm" className="ml-auto" onClick={addModal.open}>
              + Add Entry
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <EmptyState
              icon="📒"
              title="No journal entries found"
              description={
                query || activeType !== 'ALL'
                  ? 'Try adjusting your search or type filter.'
                  : 'Create the first journal entry to populate this register.'
              }
              action={!query && activeType === 'ALL' ? (
                <Button variant="primary" size="sm" onClick={addModal.open}>+ Add Entry</Button>
              ) : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Entry', 'Type', 'Author', 'Date', 'Status', 'Attachments', 'Actions'].map(header => (
                      <th key={header} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map(entry => (
                    <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3.5 align-top">
                        <div className="space-y-1.5">
                          <div className="font-semibold text-sm text-slate-800">{entry.title}</div>
                          <div className="text-xs text-slate-500 leading-relaxed max-w-lg">{entry.summary}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <Badge className={typeBadgeClass(entry.type)}>{entry.type}</Badge>
                      </td>
                      <td className="px-4 py-3.5 align-top text-sm text-slate-600">{entry.author}</td>
                      <td className="px-4 py-3.5 align-top text-sm text-slate-600">{formatDate(entry.date)}</td>
                      <td className="px-4 py-3.5 align-top">
                        <Badge className={statusBadgeClass(entry.status)}>{entry.status}</Badge>
                      </td>
                      <td className="px-4 py-3.5 align-top text-sm text-slate-600">{entry.attachments}</td>
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              viewDisc.open(entry)
                              logViewDocument(entry.title).catch(() => {})
                            }}
                          >
                            View
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => editDisc.open(entry)}>Edit</Button>
                          <Button variant="danger" size="sm" onClick={() => archiveDisc.open(entry)}>Archive</Button>
                          <Button variant="ghost" size="sm" onClick={() => navigator.clipboard?.writeText(entry.title)}>Copy title</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AddJournalEntryModal
        open={addModal.isOpen}
        onClose={addModal.close}
        title="New Journal Entry"
        submitLabel="✅ Create Entry"
        onSubmit={handleCreate}
      />
      <AddJournalEntryModal
        open={editDisc.isOpen}
        onClose={editDisc.close}
        title="Edit Journal Entry"
        submitLabel="💾 Save Changes"
        initialValue={editDisc.payload ?? undefined}
        onSubmit={handleEdit}
      />
      <ViewJournalModal entry={viewDisc.payload ?? null} open={viewDisc.isOpen} onClose={viewDisc.close} />
      <ConfirmDialog
        open={archiveDisc.isOpen}
        title="Archive Journal Entry"
        message={`Move "${archiveDisc.payload?.title}" to the Archive? This will transfer it to archived documents.`}
        confirmLabel="Archive"
        variant="danger"
        onConfirm={handleArchive}
        onCancel={archiveDisc.close}
      />
    </>
  )
}