'use client'
// app/dashboard/page.tsx
// Officer dashboard: topbar, hero, quick-access cards, 6 modals.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth }   from '@/lib/auth'
import { Modal }     from '@/components/ui/Modal'
import { Badge }     from '@/components/ui/Badge'
import { Button }    from '@/components/ui/Button'
import { AlertWarning } from '@/components/ui/AlertWarning'
import { OrgChart }  from '@/components/ui/OrgChart'
import { Toolbar, ToolbarSelect } from '@/components/ui/Toolbar'
import {
  MASTER_DOCUMENTS, SPECIAL_ORDERS, JOURNAL_ENTRIES,
  CONFIDENTIAL_DOCS, LIBRARY_ITEMS, ORG_CHART,
} from '@/lib/data'
import {
  levelBadgeClass, statusBadgeClass, journalBadgeClass,
  classificationBadgeClass, libraryBadgeClass,
} from '@/lib/utils'

// ── Quick access card definition ──────────────────
type ModalKey = 'master' | 'so' | 'journal' | 'confidential' | 'library' | 'directory' | null

const CARDS: Array<{
  key: ModalKey
  icon: string
  title: string
  desc: string
  badge?: string
}> = [
  { key: 'master',       icon: '📁', title: 'Master Documents',       desc: 'Regional, provincial & station documents',                       badge: '7 DOCS' },
  { key: 'so',           icon: '📋', title: 'Administrative Orders',  desc: 'Designation, transfer, special & letter orders',                 badge: '3 DOCS' },
  { key: 'journal',      icon: '📂', title: '201 File',               desc: 'Police personnel file' },
  { key: 'confidential', icon: '🔒', title: 'Classified Documents',   desc: 'Password-protected classified documents' },
  { key: 'library',      icon: '📚', title: 'E-Library',              desc: 'Memorandum circulars, SOPs, directives, relevant laws, rules & regulations' },
  { key: 'directory',    icon: '🏛️', title: 'Organization',          desc: 'Organizational structure & directory' },
]

// ── Flatten master docs for modal list ────────────
function flattenDocs(docs: typeof MASTER_DOCUMENTS): typeof MASTER_DOCUMENTS {
  const result: typeof MASTER_DOCUMENTS = []
  for (const doc of docs) {
    result.push(doc)
    if (doc.children) result.push(...flattenDocs(doc.children))
  }
  return result
}
const FLAT_DOCS = flattenDocs(MASTER_DOCUMENTS)

// ════════════════════════════════════════════════
export default function DashboardPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [openModal, setOpenModal] = useState<ModalKey>(null)

  function handleLogout() {
    logout()
    router.push('/login')
  }

  const date = new Date().toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">

      {/* ── Topbar ── */}
      <div className="bg-white border-b border-slate-200 px-7 h-[52px] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-yellow-400 rounded-md flex items-center justify-center text-sm">🛡️</div>
          <div>
            <div className="text-[13px] font-bold text-slate-800 leading-none">DDNPPO Records System</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Davao Del Norte Provincial Police Office</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
            {user?.initials ?? 'AS'}
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-slate-800">{user?.name?.split(' ')[0] ?? 'Ana'}</div>
            <div className="text-[11px] text-slate-400 capitalize">{user?.role ?? 'Officer'}</div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>⏻ Logout</Button>
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="hero-gradient px-12 pt-10 pb-12 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full border-[50px] border-white/[0.05]" />
        <div className="relative z-10">
          <h1 className="font-display text-4xl text-white mb-2">
            Good morning, {user?.name?.split(' ')[0] ?? 'Ana'}.
          </h1>
          <p className="text-white/60 text-sm flex items-center gap-1.5 mb-5">
            📅 {date}
          </p>
          <div className="flex items-center gap-2.5 bg-white/10 border border-white/20 rounded-xl px-4 py-3 max-w-md cursor-text">
            <div className="w-2 h-2 bg-yellow-400 rounded-full" />
            <span className="text-white/50 text-sm">Search documents, orders, memos…</span>
          </div>
        </div>
      </div>

      {/* ── Quick Access Grid ── */}
      <div className="max-w-5xl mx-auto w-full px-12 py-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-0.5 h-3.5 bg-blue-600 rounded" />
          <span className="text-[10.5px] font-bold uppercase tracking-widest text-slate-400">Quick Access</span>
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-[660px]">
          {CARDS.map(card => (
            <button
              key={card.key}
              onClick={() => setOpenModal(card.key)}
              className="bg-white border-[1.5px] border-slate-200 rounded-xl p-6 text-left hover:border-blue-500 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <span className="text-3xl mb-3.5 block">{card.icon}</span>
              <div className="text-[15px] font-bold text-slate-800 mb-1">{card.title}</div>
              <div className="text-[12.5px] text-slate-400 leading-snug mb-3">{card.desc}</div>
              {card.badge && (
                <span className="inline-flex bg-blue-50 text-blue-600 text-[11px] font-bold px-2.5 py-1 rounded-full">
                  {card.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════ */}

      {/* Master Documents */}
      <Modal open={openModal === 'master'} onClose={() => setOpenModal(null)} title="Master Documents" width="max-w-2xl">
        <Toolbar placeholder="Search documents…">
          <ToolbarSelect><option>All Levels</option><option>Regional</option><option>Provincial</option><option>Station</option></ToolbarSelect>
        </Toolbar>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>
              {FLAT_DOCS.map(doc => (
                <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="px-4 py-3" style={{ width: 110 }}>
                    <Badge className={levelBadgeClass(doc.level)}>{doc.level}</Badge>
                  </td>
                  <td className="px-4 py-3 font-semibold text-sm text-slate-800">{doc.title}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{doc.date}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm">👁</Button>
                      <Button variant="ghost" size="sm">⋯</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Administrative Orders */}
      <Modal open={openModal === 'so'} onClose={() => setOpenModal(null)} title="Administrative Orders" width="max-w-xl">
        <div className="p-6 space-y-3">
          {SPECIAL_ORDERS.map(so => (
            <div key={so.id} className="flex items-center gap-3 px-4 py-3.5 border-[1.5px] border-slate-200 rounded-xl hover:border-blue-200 transition">
              <Badge className={statusBadgeClass(so.status)}>{so.status}</Badge>
              <span className="flex-1 font-semibold text-sm text-slate-800">{so.reference} — {so.subject}</span>
              <span className="text-xs text-slate-400 whitespace-nowrap">{so.date}</span>
              <div className="flex gap-1"><Button variant="ghost" size="sm">👁</Button><Button variant="ghost" size="sm">⋯</Button></div>
            </div>
          ))}
        </div>
      </Modal>

      {/* 201 File */}
      <Modal open={openModal === 'journal'} onClose={() => setOpenModal(null)} title="201 File — Police Personnel File" width="max-w-xl">
        <div className="p-6 space-y-3">
          {JOURNAL_ENTRIES.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 px-4 py-3.5 border-[1.5px] border-slate-200 rounded-xl hover:border-blue-200 transition">
              <Badge className={journalBadgeClass(entry.type)}>{entry.type}</Badge>
              <span className="flex-1 font-semibold text-sm text-slate-800">{entry.title}</span>
              <span className="text-xs text-slate-400 whitespace-nowrap">{entry.date}</span>
              <div className="flex gap-1"><Button variant="ghost" size="sm">👁</Button><Button variant="ghost" size="sm">⋯</Button></div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Classified Documents */}
      <Modal open={openModal === 'confidential'} onClose={() => setOpenModal(null)} title="Classified Documents" width="max-w-2xl">
        <div className="px-7 pt-5">
          <AlertWarning message="Confidential documents require per-document password authentication. All access is logged." />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Document','Classification','Date','Access','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CONFIDENTIAL_DOCS.map(doc => (
                <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="px-4 py-3.5"><span className="mr-2">🔒</span><strong className="text-sm">{doc.title}</strong></td>
                  <td className="px-4 py-3.5"><Badge className={classificationBadgeClass(doc.classification)}>{doc.classification}</Badge></td>
                  <td className="px-4 py-3.5 text-sm text-slate-500">{doc.date}</td>
                  <td className="px-4 py-3.5 text-sm text-slate-600">{doc.access}</td>
                  <td className="px-4 py-3.5">
                    <button className="bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-amber-200 transition">
                      🔓 Unlock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="h-4" />
      </Modal>

      {/* E-Library */}
      <Modal open={openModal === 'library'} onClose={() => setOpenModal(null)} title="E-Library" width="max-w-2xl">
        <Toolbar placeholder="Search library…">
          <ToolbarSelect>
            <option>All Categories</option>
            <option>Memorandum Circulars</option>
            <option>SOPs</option>
            <option>Directives</option>
            <option>Relevant Laws</option>
            <option>Rules &amp; Regulations</option>
          </ToolbarSelect>
        </Toolbar>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Title','Category','Size','Date Added','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LIBRARY_ITEMS.map(item => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="px-4 py-3.5"><span className="mr-2">📗</span><strong className="text-sm">{item.title}</strong></td>
                  <td className="px-4 py-3.5"><Badge className={libraryBadgeClass(item.category)}>{item.category}</Badge></td>
                  <td className="px-4 py-3.5 text-sm text-slate-500">{item.size}</td>
                  <td className="px-4 py-3.5 text-sm text-slate-500">{item.dateAdded}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1"><Button variant="ghost" size="sm">👁</Button><Button variant="ghost" size="sm">⬇</Button><Button variant="ghost" size="sm">⋯</Button></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Organization */}
      <Modal open={openModal === 'directory'} onClose={() => setOpenModal(null)} title="Organization — Organizational Structure & Directory" width="max-w-2xl">
        <OrgChart root={ORG_CHART} />
      </Modal>

    </div>
  )
}