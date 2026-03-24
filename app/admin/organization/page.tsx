'use client'
// app/admin/organization/page.tsx

import { useState, useRef, useCallback, useEffect } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Modal }      from '@/components/ui/Modal'
import { Button }     from '@/components/ui/Button'
import { useToast }   from '@/components/ui/Toast'

// ── Types ─────────────────────────────────────
interface OrgMember {
  id: string
  name: string
  rank: string
  position: string
  unit?: string
  photoUrl?: string
  initials: string
  color: string
  x: number
  y: number
  parentId?: string
}

const COLORS = [
  '#3b63b8', '#f0b429', '#8b5cf6', '#10b981',
  '#ef4444', '#0891b2', '#f97316', '#ec4899',
]

const LOCAL_KEY = 'ddnppo_org_members'

function loadMembers(): OrgMember[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveMembers(members: OrgMember[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(members)) } catch { /* noop */ }
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
}

// ── Add/Edit Modal ────────────────────────────
function MemberModal({ open, onClose, onSave, existing }: {
  open: boolean
  onClose: () => void
  onSave: (member: Omit<OrgMember, 'id' | 'x' | 'y'>) => void
  existing?: OrgMember | null
}) {
  const { toast } = useToast()
  const fileRef   = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    name: '', rank: '', position: '', unit: '',
    photoUrl: '', color: COLORS[0],
  })
  const [preview, setPreview] = useState<string>('')

  useEffect(() => {
    if (existing) {
      setForm({
        name:     existing.name,
        rank:     existing.rank,
        position: existing.position,
        unit:     existing.unit ?? '',
        photoUrl: existing.photoUrl ?? '',
        color:    existing.color,
      })
      setPreview(existing.photoUrl ?? '')
    } else {
      setForm({ name: '', rank: '', position: '', unit: '', photoUrl: '', color: COLORS[0] })
      setPreview('')
    }
  }, [existing, open])

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      setPreview(url)
      setForm(f => ({ ...f, photoUrl: url }))
    }
    reader.readAsDataURL(file)
  }

  function submit() {
    if (!form.name.trim())     { toast.error('Name is required.'); return }
    if (!form.position.trim()) { toast.error('Position is required.'); return }
    onSave({
      name:     form.name.trim(),
      rank:     form.rank.trim(),
      position: form.position.trim(),
      unit:     form.unit.trim(),
      photoUrl: form.photoUrl || undefined,
      initials: getInitials(form.name),
      color:    form.color,
      parentId: existing?.parentId,
    })
    onClose()
  }

  const cls = 'w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition'

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit Member' : 'Add Member'} width="max-w-md">
      <div className="p-6 space-y-4">

        {/* Photo Upload */}
        <div className="flex flex-col items-center gap-3">
          <div
            onClick={() => fileRef.current?.click()}
            className="w-24 h-24 rounded-full border-4 border-dashed border-slate-300 hover:border-blue-400 cursor-pointer flex items-center justify-center overflow-hidden transition relative group"
            style={{ background: preview ? 'transparent' : form.color + '22' }}
          >
            {preview ? (
              <img src={preview} alt="preview" className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-2xl font-bold" style={{ color: form.color }}>
                {form.name ? getInitials(form.name) : '📷'}
              </span>
            )}
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
              <span className="text-white text-xs font-semibold">Change</span>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          <button
            onClick={() => fileRef.current?.click()}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            {preview ? 'Change Photo' : 'Upload Photo'}
          </button>
          {preview && (
            <button
              onClick={() => { setPreview(''); setForm(f => ({ ...f, photoUrl: '' })) }}
              className="text-xs text-red-500 hover:underline"
            >
              Remove Photo
            </button>
          )}
        </div>

        {/* Color Picker */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Avatar Color</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setForm(f => ({ ...f, color: c }))}
                className="w-7 h-7 rounded-full border-2 transition"
                style={{
                  background: c,
                  borderColor: form.color === c ? '#0f1c35' : 'transparent',
                  transform: form.color === c ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input className={cls} placeholder="e.g. Ramon Dela Cruz"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>

        {/* Rank */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Rank</label>
            <select className={cls} value={form.rank} onChange={e => setForm(f => ({ ...f, rank: e.target.value }))}>
              <option value="">None</option>
              {['P/Col.','P/Lt. Col.','P/Maj.','P/Capt.','P/Lt.','P/Insp.','PSMS','PMMS','PEMS','PNCOP'].map(r => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Position <span className="text-red-500">*</span>
            </label>
            <input className={cls} placeholder="e.g. Provincial Director"
              value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
          </div>
        </div>

        {/* Unit */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Unit / Assignment</label>
          <input className={cls} placeholder="e.g. DDNPPO HQ"
            value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
        </div>

        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            {existing ? '💾 Save Changes' : '➕ Add Member'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Member Card (canvas node) ─────────────────
function MemberCard({
  member, selected, connecting, isTarget,
  onClick, onEdit, onDelete, onStartConnect,
}: {
  member: OrgMember
  selected: boolean
  connecting: boolean
  isTarget: boolean
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
  onStartConnect: () => void
}) {
  return (
    <div
      className={`absolute select-none cursor-pointer transition-all duration-150 ${
        selected ? 'z-20' : 'z-10'
      } ${isTarget ? 'scale-105' : ''}`}
      style={{ left: member.x, top: member.y, transform: 'translate(-50%, -50%)' }}
      onClick={e => { e.stopPropagation(); onClick() }}
    >
      <div className={`
        bg-white rounded-2xl border-2 p-3 w-[148px] text-center shadow-md
        transition-all duration-150
        ${selected
          ? 'border-blue-500 shadow-blue-200 shadow-lg'
          : isTarget
          ? 'border-emerald-400 shadow-emerald-100 shadow-lg'
          : 'border-slate-200 hover:border-blue-300 hover:shadow-lg'
        }
      `}>
        {/* Avatar */}
        <div className="relative mx-auto mb-2">
          <div
            className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-lg font-bold text-white overflow-hidden border-2 border-white shadow"
            style={{ background: member.color }}
          >
            {member.photoUrl ? (
              <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
            ) : (
              member.initials
            )}
          </div>
          {selected && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white" />
          )}
        </div>

        {/* Info */}
        {member.rank && (
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{member.rank}</div>
        )}
        <div className="text-[12px] font-bold text-slate-800 leading-tight truncate">{member.name}</div>
        <div className="text-[10px] text-slate-500 mt-0.5 truncate">{member.position}</div>
        {member.unit && (
          <div className="text-[9px] text-slate-400 mt-0.5 truncate">{member.unit}</div>
        )}

        {/* Actions (visible when selected) */}
        {selected && (
          <div className="flex justify-center gap-1 mt-2.5 pt-2 border-t border-slate-100">
            <button
              onClick={e => { e.stopPropagation(); onEdit() }}
              className="text-[10px] px-2 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 font-semibold transition"
            >✏️ Edit</button>
            <button
              onClick={e => { e.stopPropagation(); onStartConnect() }}
              title="Connect to parent"
              className={`text-[10px] px-2 py-1 rounded-md font-semibold transition ${
                connecting
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >🔗</button>
            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              className="text-[10px] px-2 py-1 bg-red-50 text-red-500 rounded-md hover:bg-red-100 font-semibold transition"
            >🗑</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SVG Connection Lines ──────────────────────
function ConnectionLines({ members, draggingId, connectingFrom, mousePos }: {
  members: OrgMember[]
  draggingId: string | null
  connectingFrom: string | null
  mousePos: { x: number; y: number }
}) {
  const connections = members.filter(m => m.parentId)

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
    >
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
        </marker>
        <marker id="arrowhead-active" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#10b981" />
        </marker>
      </defs>

      {connections.map(child => {
        const parent = members.find(m => m.id === child.parentId)
        if (!parent) return null

        const x1 = parent.x
        const y1 = parent.y + 60   // bottom of parent card
        const x2 = child.x
        const y2 = child.y - 60    // top of child card

        const midY = (y1 + y2) / 2

        return (
          <path
            key={`${parent.id}-${child.id}`}
            d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="2"
            strokeDasharray="none"
            markerEnd="url(#arrowhead)"
          />
        )
      })}

      {/* Live connection line while linking */}
      {connectingFrom && (() => {
        const from = members.find(m => m.id === connectingFrom)
        if (!from) return null
        return (
          <path
            d={`M ${from.x} ${from.y} L ${mousePos.x} ${mousePos.y}`}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="6 3"
            markerEnd="url(#arrowhead-active)"
          />
        )
      })()}
    </svg>
  )
}

// ── Main Page ─────────────────────────────────
export default function OrganizationPage() {
  const { toast }  = useToast()
  const canvasRef  = useRef<HTMLDivElement>(null)

  const [members, setMembers]             = useState<OrgMember[]>([])
  const [selected, setSelected]           = useState<string | null>(null)
  const [editTarget, setEditTarget]       = useState<OrgMember | null>(null)
  const [showModal, setShowModal]         = useState(false)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [mousePos, setMousePos]           = useState({ x: 0, y: 0 })
  const [dragging, setDragging]           = useState<{ id: string; ox: number; oy: number } | null>(null)
  const [showHelp, setShowHelp]           = useState(false)

  // Load from localStorage
  useEffect(() => {
    const saved = loadMembers()
    if (saved.length > 0) {
      setMembers(saved)
    }
  }, [])

  // Save whenever members change
  useEffect(() => {
    if (members.length >= 0) saveMembers(members)
  }, [members])

  // Mouse move for dragging + connecting
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setMousePos({ x, y })

    if (dragging) {
      setMembers(prev => prev.map(m =>
        m.id === dragging.id
          ? { ...m, x: e.clientX - rect.left - dragging.ox, y: e.clientY - rect.top - dragging.oy }
          : m
      ))
    }
  }, [dragging])

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      setDragging(null)
      setMembers(prev => { saveMembers(prev); return prev })
    }
  }, [dragging])

  function handleCanvasClick() {
    setSelected(null)
    if (connectingFrom) setConnectingFrom(null)
  }

  function handleCardMouseDown(e: React.MouseEvent, member: OrgMember) {
    if (connectingFrom) return // don't drag while connecting
    e.stopPropagation()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    setDragging({
      id: member.id,
      ox: e.clientX - rect.left - member.x,
      oy: e.clientY - rect.top - member.y,
    })
  }

  function handleCardClick(member: OrgMember) {
    if (connectingFrom && connectingFrom !== member.id) {
      // Connect: set this member's parent to the connecting source
      setMembers(prev => prev.map(m =>
        m.id === member.id ? { ...m, parentId: connectingFrom } : m
      ))
      toast.success(`Connected to ${members.find(m => m.id === connectingFrom)?.name ?? ''}`)
      setConnectingFrom(null)
      setSelected(null)
    } else {
      setSelected(member.id === selected ? null : member.id)
    }
  }

  function handleAddMember() {
    setEditTarget(null)
    setShowModal(true)
  }

  function handleSaveMember(data: Omit<OrgMember, 'id' | 'x' | 'y'>) {
    if (editTarget) {
      setMembers(prev => prev.map(m =>
        m.id === editTarget.id ? { ...m, ...data } : m
      ))
      toast.success('Member updated.')
    } else {
      // Place new member in a smart position
      const baseX = 200 + (members.length % 4) * 200
      const baseY = 150 + Math.floor(members.length / 4) * 200
      const newMember: OrgMember = {
        ...data,
        id: `org-${Date.now()}`,
        x: baseX,
        y: baseY,
      }
      setMembers(prev => [...prev, newMember])
      toast.success(`${data.name} added to the org chart.`)
    }
    setEditTarget(null)
  }

  function handleDelete(id: string) {
    // Also remove children's parentId references
    setMembers(prev => prev
      .filter(m => m.id !== id)
      .map(m => m.parentId === id ? { ...m, parentId: undefined } : m)
    )
    setSelected(null)
    toast.success('Member removed.')
  }

  function handleDisconnect(id: string) {
    setMembers(prev => prev.map(m =>
      m.id === id ? { ...m, parentId: undefined } : m
    ))
    toast.info('Connection removed.')
  }

  function handleClearAll() {
    if (!confirm('Clear the entire org chart? This cannot be undone.')) return
    setMembers([])
    setSelected(null)
    toast.success('Org chart cleared.')
  }

  const selectedMember = members.find(m => m.id === selected)

  return (
    <>
      <PageHeader title="Personnel Directory" />

      {/* Toolbar */}
      <div className="flex items-center gap-2.5 px-8 py-3 bg-white border-b border-slate-200 sticky top-14 z-40">
        <Button variant="primary" size="sm" onClick={handleAddMember}>
          ✚ Add Member
        </Button>

        {connectingFrom && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-semibold animate-pulse">
            🔗 Click another member to connect as child — or&nbsp;
            <button onClick={() => setConnectingFrom(null)} className="underline hover:no-underline">Cancel</button>
          </div>
        )}

        {selected && selectedMember && (
          <div className="flex items-center gap-1.5 ml-2">
            {selectedMember.parentId && (
              <Button variant="outline" size="sm" onClick={() => handleDisconnect(selected)}>
                ✂️ Disconnect
              </Button>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowHelp(h => !h)}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded border border-slate-200 transition"
          >
            {showHelp ? 'Hide Help' : '❓ Help'}
          </button>
          {members.length > 0 && (
            <Button variant="danger" size="sm" onClick={handleClearAll}>
              🗑 Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Help Banner */}
      {showHelp && (
        <div className="mx-8 mt-4 px-5 py-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: '✚', text: 'Add Member — create a new person in the chart' },
            { icon: '🖱️', text: 'Drag cards — move members freely on the canvas' },
            { icon: '🔗', text: 'Connect — click a card → click 🔗 → click another to link parent→child' },
            { icon: '✂️', text: 'Disconnect — removes the line between parent and child' },
          ].map(h => (
            <div key={h.icon} className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">{h.icon}</span>
              <span className="text-xs leading-relaxed">{h.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Canvas */}
      <div className="p-8 flex-1">
        <div
          ref={canvasRef}
          className="relative bg-white border-[1.5px] border-slate-200 rounded-2xl overflow-hidden"
          style={{
            minHeight: 600,
            backgroundImage: `
              radial-gradient(circle, #e2e8f0 1px, transparent 1px)
            `,
            backgroundSize: '28px 28px',
            cursor: connectingFrom ? 'crosshair' : dragging ? 'grabbing' : 'default',
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleCanvasClick}
        >
          {/* Connection lines */}
          <ConnectionLines
            members={members}
            draggingId={dragging?.id ?? null}
            connectingFrom={connectingFrom}
            mousePos={mousePos}
          />

          {/* Empty state */}
          {members.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <div className="text-5xl mb-4">🏛️</div>
              <p className="text-slate-500 font-semibold text-base mb-1">No members yet</p>
              <p className="text-slate-400 text-sm">Click <strong>+ Add Member</strong> to start building your org chart</p>
            </div>
          )}

          {/* Member cards */}
          {members.map(member => (
            <div
              key={member.id}
              onMouseDown={e => handleCardMouseDown(e, member)}
            >
              <MemberCard
                member={member}
                selected={selected === member.id}
                connecting={connectingFrom === member.id}
                isTarget={!!connectingFrom && connectingFrom !== member.id}
                onClick={() => handleCardClick(member)}
                onEdit={() => { setEditTarget(member); setShowModal(true) }}
                onDelete={() => handleDelete(member.id)}
                onStartConnect={() => {
                  setConnectingFrom(member.id)
                  setSelected(member.id)
                }}
              />
            </div>
          ))}
        </div>

        {/* Legend */}
        {members.length > 0 && (
          <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <svg width="24" height="10"><path d="M0 5 C8 5, 16 5, 24 5" stroke="#cbd5e1" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" /></svg>
              Hierarchy line
            </span>
            <span>·</span>
            <span>{members.length} member{members.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{members.filter(m => m.parentId).length} connection{members.filter(m => m.parentId).length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <MemberModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditTarget(null) }}
        onSave={handleSaveMember}
        existing={editTarget}
      />
    </>
  )
}