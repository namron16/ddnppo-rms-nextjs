// components/ui/OrgChart.tsx
// Recursive org chart renderer used on Directory pages.

import type { OrgNode } from '@/types'

function OrgCard({ node, isTop = false }: { node: OrgNode; isTop?: boolean }) {
  return (
    <div
      className={`bg-white rounded-xl text-center min-w-[148px] px-5 py-4 border-[1.5px] ${
        isTop ? 'border-yellow-400' : 'border-slate-200'
      }`}
    >
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-[15px] font-bold text-white mx-auto mb-2.5"
        style={{ background: node.color }}
      >
        {node.initials}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">{node.rank}</div>
      <div className="text-[13px] font-bold text-slate-800">{node.name}</div>
      <div className="text-[11.5px] text-slate-500 mt-0.5">{node.title}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">{node.unit}</div>
    </div>
  )
}

function OrgBranch({ node, isTop = false }: { node: OrgNode; isTop?: boolean }) {
  const hasChildren = node.children && node.children.length > 0

  return (
    <div className="flex flex-col items-center">
      <OrgCard node={node} isTop={isTop} />
      {hasChildren && (
        <>
          <div className="org-connector-v" />
          <div className="flex gap-6 items-start">
            {node.children!.map(child => (
              <OrgBranch key={child.id} node={child} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function OrgChart({ root }: { root: OrgNode }) {
  return (
    <div className="overflow-auto p-8 flex justify-center">
      <OrgBranch node={root} isTop />
    </div>
  )
}
