'use client'
// app/admin/log-history/page.tsx

import { useState }      from 'react'
import { PageHeader }    from '@/components/ui/PageHeader'
import { Avatar }        from '@/components/ui/Avatar'
import { Button }        from '@/components/ui/Button'
import { SearchInput }   from '@/components/ui/SearchInput'
import { EmptyState }    from '@/components/ui/EmptyState'
import { ToolbarSelect } from '@/components/ui/Toolbar'
import { useSearch }     from '@/hooks'
import { useToast }      from '@/components/ui/Toast'
import { ACTIVITY_LOGS } from '@/lib/data'
import { logActionClass } from '@/lib/utils'
import type { LogAction } from '@/types'

export default function LogHistoryPage() {
  const { toast }      = useToast()
  const [actionFilter, setAction] = useState<LogAction | 'ALL'>('ALL')
  const { query, setQuery, filtered: searched } = useSearch(ACTIVITY_LOGS, ['user', 'document'])
  const filtered = searched.filter(l => actionFilter === 'ALL' || l.action === actionFilter)

  return (
    <>
      <PageHeader title="Activity Log History" />

      <div className="p-8">
        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">

          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50 flex-wrap">
            <SearchInput value={query} onChange={setQuery} placeholder="Search logs…" className="max-w-xs flex-1" />
            <ToolbarSelect onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAction(e.target.value as LogAction | 'ALL')}>
              <option value="ALL">All Actions</option>
              <option value="Viewed">Viewed</option>
              <option value="Downloaded">Downloaded</option>
              <option value="Forwarded">Forwarded</option>
            </ToolbarSelect>
            <ToolbarSelect>
              <option>All Users</option>
              <option>P/Maj. Ana Santos</option>
              <option>P/Insp. Jose Reyes</option>
            </ToolbarSelect>
            <input type="date" className="px-3 py-2 border-[1.5px] border-slate-200 rounded-lg text-sm bg-white focus:outline-none" />
            <button
              onClick={() => toast.success('Log exported as CSV.')}
              className="ml-auto inline-flex items-center gap-2 bg-blue-50 text-blue-600 border-[1.5px] border-blue-200 hover:bg-blue-100 transition font-semibold text-sm px-3 py-2 rounded-lg"
            >
              📥 Export CSV
            </button>
          </div>

          <div className="px-6 py-3 text-xs text-slate-400 border-b border-slate-100">
            Activity Log History &nbsp;·&nbsp; <strong className="text-slate-700">{filtered.length} entries</strong>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="📊" title="No log entries found" description="Try adjusting your filters." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['User', 'Action', 'Document', 'Date', 'Time', 'Device'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(log => (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar initials={log.userInitials} color={log.userColor} size="sm" />
                          <span className="text-sm text-slate-700">{log.user}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5"><span className={`text-sm ${logActionClass(log.action)}`}>{log.action}</span></td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">📄 {log.document}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-500">{log.date}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-500">{log.time}</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-medium px-2 py-1 rounded-full">🖥 {log.device}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
