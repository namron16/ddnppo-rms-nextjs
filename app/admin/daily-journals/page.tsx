'use client'

import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { ToolbarSelect } from '@/components/ui/Toolbar'
import { AddJournalEntryModal } from '@/components/modals/AddJournalEntryModal'
import { useDisclosure, useModal, useSearch } from '@/hooks'
import type { AddJournalEntryInput } from '@/lib/validations'
import type { JournalEntry } from '@/types'

type JournalStatus = 'Draft' | 'Filed' | 'Reviewed'

type JournalRecord = JournalEntry & {
  content: string
  status: JournalStatus
  attachments: number
  summary: string
}

const JOURNAL_TEMPLATES: JournalRecord[] = [
  {
    id: 'jrnl-1001',
    title: 'Morning Command Briefing',
    type: 'MEMO',
    author: 'PCol. Ramon Dela Cruz',
    date: '2026-04-13',
    content: 'Reviewed overnight incident reports, visitor logs, and pending inter-office coordination items before rollout.',
    status: 'Reviewed',
    attachments: 2,
    summary: 'Shift coordination and priority checks for the first watch.',
  },
  {
    id: 'jrnl-1002',
    title: 'Field Inspection Notes',
    type: 'REPORT',
    author: 'Maj. Ana Santos',
    date: '2026-04-12',
    content: 'Inspected perimeter lighting, access control points, and document turnover procedures across three sectors.',
    status: 'Filed',
    attachments: 4,
    summary: 'Operational review of perimeter and records handling.',
  },
  {
    id: 'jrnl-1003',
    title: 'Duty Post Log',
    type: 'LOG',
    author: 'Cpt. Jose Reyes',
    date: '2026-04-12',
    content: 'All posts accounted for at 1800H. No unusual movement observed during evening inventory and sign-off.',
    status: 'Filed',
    attachments: 1,
    summary: 'End-of-shift sign-off and accountability check.',
  },
  {
    id: 'jrnl-1004',
    title: 'Administrative Memo',
    type: 'MEMO',
    author: 'Lt. Maria Lopez',
    date: '2026-04-11',
    content: 'Issued a reminder on document naming conventions and the updated routing sequence for approvals.',
    status: 'Draft',
    attachments: 0,
    summary: 'Reminder on filing discipline and approval routing.',
  },
  {
    id: 'jrnl-1005',
    title: 'Operations Summary',
    type: 'REPORT',
    author: 'PSSg. Mark Villanueva',
    date: '2026-04-10',
    content: 'Summarized service calls, request counts, and follow-up items captured during the last 24-hour cycle.',
    status: 'Reviewed',
    attachments: 3,
    summary: 'Daily operational roll-up for desk review.',
  },
  {
    id: 'jrnl-1006',
    title: 'Night Watch Log',
    type: 'LOG',
    author: 'Sgt. Paul Torres',
    date: '2026-04-09',
    content: 'Weather remained fair throughout the shift. Gate inspections and radio checks were completed on schedule.',
    status: 'Filed',
    attachments: 0,
    summary: 'Quiet watch with completed security checks.',
  },
]

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
  const addModal = useModal()
  const viewDisc = useDisclosure<JournalRecord>()
  const [entries, setEntries] = useState<JournalRecord[]>([])
  const [activeType, setActiveType] = useState<'ALL' | JournalEntry['type']>('ALL')

  const { query, setQuery, filtered: searched } = useSearch(entries, ['title', 'author', 'content'] as Array<keyof JournalRecord>) 

  const filteredEntries = useMemo(() => {
    return searched.filter(entry => activeType === 'ALL' || entry.type === activeType)
  }, [activeType, searched])

  const journalStats = useMemo(() => ({
    all: entries?.length,
    memo: entries?.filter(entry => entry.type === 'MEMO').length,
    report: entries?.filter(entry => entry.type === 'REPORT').length,
    log: entries?.filter(entry => entry.type === 'LOG').length,
  }), [entries])

  function handleCreate(input: AddJournalEntryInput) {
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

    setEntries(prev => [nextEntry, ...prev])
    addModal.close()
    viewDisc.close()
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

          {filteredEntries.length === 0 ? (
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
                          <Button variant="outline" size="sm" onClick={() => viewDisc.open(entry)}>View</Button>
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

      <AddJournalEntryModal open={addModal.isOpen} onClose={addModal.close} onCreate={handleCreate} />
      <ViewJournalModal entry={viewDisc.payload ?? null} open={viewDisc.isOpen} onClose={viewDisc.close} />
    </>
  )
}