// app/admin/directory/page.tsx

import { PageHeader } from '@/components/ui/PageHeader'
import { Button }     from '@/components/ui/Button'
import { OrgChart }   from '@/components/ui/OrgChart'
import { ORG_CHART }  from '@/lib/data'

export default function DirectoryPage() {
  return (
    <>
      <PageHeader title="Personnel Directory" />

      <div className="p-8">
        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">

          {/* Card header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
            <div>
              <span className="text-base font-bold text-slate-800">DDNPPO Organizational Chart</span>
              <span className="ml-2 text-xs text-slate-400 font-normal">As of 2024</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">📤 Upload / Replace Chart</Button>
              <Button variant="primary" size="sm">✏️ Add/Edit Entry</Button>
            </div>
          </div>

          {/* Org chart */}
          <OrgChart root={ORG_CHART} />

        </div>
      </div>
    </>
  )
}
