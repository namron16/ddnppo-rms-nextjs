'use client'
// app/admin/settings/page.tsx

import { useState }    from 'react'
import { PageHeader }  from '@/components/ui/PageHeader'
import { Button }      from '@/components/ui/Button'
import { useToast }    from '@/components/ui/Toast'

interface SettingGroup {
  title: string
  description: string
  fields: SettingField[]
}

interface SettingField {
  key: string
  label: string
  type: 'text' | 'email' | 'number' | 'select' | 'toggle'
  defaultValue: string | boolean
  options?: string[]
  help?: string
}

const SETTING_GROUPS: SettingGroup[] = [
  {
    title: 'Organization',
    description: 'Basic information about your organization',
    fields: [
      { key: 'orgName',     label: 'Organization Name',     type: 'text',   defaultValue: 'Davao Del Norte Provincial Police Office', help: 'Used in reports and documents' },
      { key: 'adminEmail',  label: 'Admin Email Address',   type: 'email',  defaultValue: 'admin@ddnppo.gov.ph', help: 'For system notifications and alerts' },
    ]
  },
  {
    title: 'Security',
    description: 'Control system access and security settings',
    fields: [
      { key: 'sessionTimeout',  label: 'Session Timeout (minutes)',  type: 'number', defaultValue: '30', help: 'Auto-logout after inactivity' },
      { key: 'maxUploadSize',   label: 'Max File Upload (MB)',       type: 'number', defaultValue: '50', help: 'Maximum file size for uploads' },
      { key: 'enableAuditLog',  label: 'Enable Activity Logging',    type: 'toggle', defaultValue: true, help: 'Log all user actions for compliance' },
    ]
  },
  {
    title: 'Notifications',
    description: 'System alerts and email preferences',
    fields: [
      { key: 'enableEmails',    label: 'Enable Email Notifications',  type: 'toggle', defaultValue: true, help: 'Send alerts for important events' },
      { key: 'emailOnArchive',  label: 'Email when Documents Archived', type: 'toggle', defaultValue: false, help: 'Notify admins of archive actions' },
    ]
  },
]

export default function SettingsPage() {
  const { toast } = useToast()
  const [values, setValues] = useState<Record<string, string | boolean>>(
    Object.fromEntries(
      SETTING_GROUPS.flatMap(g => g.fields).map(f => [f.key, f.defaultValue])
    )
  )

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition'
  const toggleCls = 'relative inline-flex h-6 w-11 items-center rounded-full transition'

  return (
    <>
      <PageHeader title="Settings" />

      <div className="p-8 max-w-4xl">
        <div className="space-y-8">
          {SETTING_GROUPS.map(group => (
            <div key={group.title} className="bg-white border-[1.5px] border-slate-200 rounded-xl p-8">
              <h2 className="text-lg font-bold text-slate-800 mb-1">{group.title}</h2>
              <p className="text-sm text-slate-500 mb-6">{group.description}</p>

              <div className="space-y-5">
                {group.fields.map(field => (
                  <div key={field.key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-semibold text-slate-700">{field.label}</label>
                      {field.help && <span className="text-xs text-slate-400">?</span>}
                    </div>
                    {field.help && (
                      <p className="text-xs text-slate-500 mb-2">{field.help}</p>
                    )}
                    
                    {field.type === 'toggle' ? (
                      <button
                        onClick={() => setValues(v => ({ ...v, [field.key]: !v[field.key] }))}
                        className={`${toggleCls} ${values[field.key] ? 'bg-blue-600' : 'bg-slate-300'}`}
                      >
                        <span
                          className={`${
                            values[field.key] ? 'translate-x-6' : 'translate-x-1'
                          } inline-block h-4 w-4 transform rounded-full bg-white transition`}
                        />
                      </button>
                    ) : field.type === 'select' ? (
                      <select
                        className={inputCls}
                        value={values[field.key] as string}
                        onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                      >
                        {field.options!.map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        className={inputCls}
                        value={values[field.key] as string}
                        onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center gap-3">
          <Button variant="primary" onClick={() => toast.success('✅ Settings saved successfully.')}>
            💾 Save All Changes
          </Button>
          <Button variant="outline" onClick={() => {
            setValues(
              Object.fromEntries(
                SETTING_GROUPS.flatMap(g => g.fields).map(f => [f.key, f.defaultValue])
              )
            )
            toast.info('↺ Settings reset to defaults.')
          }}>
            Reset to Defaults
          </Button>
        </div>
      </div>
    </>
  )
}
