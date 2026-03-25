'use client'
// app/admin/settings/page.tsx

import { useState }    from 'react'
import { PageHeader }  from '@/components/ui/PageHeader'
import { Button }      from '@/components/ui/Button'
import { useToast }    from '@/components/ui/Toast'

interface SettingField {
  key: string
  label: string
  type: 'text' | 'email' | 'number' | 'select'
  defaultValue: string
  options?: string[]
}

const FIELDS: SettingField[] = [
  { key: 'systemName',  label: 'System Name',              type: 'text',   defaultValue: 'DDNPPO Records Management System' },
  { key: 'org',         label: 'Organization',             type: 'text',   defaultValue: 'Davao Del Norte Provincial Police Office' },
  { key: 'adminEmail',  label: 'Admin Email',              type: 'email',  defaultValue: 'admin@ddnppo.gov.ph' },
  { key: 'timeout',     label: 'Session Timeout (minutes)',type: 'number', defaultValue: '30' },
  { key: 'logRetention',label: 'Log Retention (days)',     type: 'number', defaultValue: '365' },
  { key: 'timezone',    label: 'Timezone',                 type: 'select', defaultValue: 'Asia/Manila',
    options: ['Asia/Manila', 'UTC', 'Asia/Singapore'] },
]

export default function SettingsPage() {
  const { toast } = useToast()
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map(f => [f.key, f.defaultValue]))
  )

  const cls = 'w-full px-4 py-3 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white transition'

  return (
    <>
      <PageHeader title="Settings" />

      <div className="p-8">
        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl p-8 max-w-xl">

          <h2 className="text-base font-bold text-slate-800 mb-1">System Settings</h2>
          <p className="text-sm text-slate-400 mb-7">
            Configure general system information for the DDNPPO Records Management System.
          </p>

          <div className="space-y-5">
            {FIELDS.map(field => (
              <div key={field.key}>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                  {field.label}
                </label>
                {field.type === 'select' ? (
                  <select
                    className={cls}
                    value={values[field.key]}
                    onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                  >
                    {field.options!.map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    className={cls}
                    value={values[field.key]}
                    onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-3">
            <Button variant="primary" onClick={() => toast.success('Settings saved successfully.')}>
              💾 Save Changes
            </Button>
            <Button variant="outline" onClick={() => {
              setValues(Object.fromEntries(FIELDS.map(f => [f.key, f.defaultValue])))
              toast.info('Settings reset to defaults.')
            }}>
              Reset Defaults
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
