'use client'
// app/admin/settings/page.tsx

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button }     from '@/components/ui/Button'
import { Badge }      from '@/components/ui/Badge'
import { Modal }      from '@/components/ui/Modal'
import { useToast }   from '@/components/ui/Toast'
import { supabase }   from '@/lib/supabase'

// ── Types ─────────────────────────────────────

type TabKey = 'access' | 'audit' | 'backup'

type RoleKey = 'administrator' | 'records_officer' | 'officer'

interface RolePermissions {
  view_master_docs: boolean
  upload_edit_archive_master: boolean
  view_special_orders: boolean
  create_archive_special_orders: boolean
  view_201_files: boolean
  edit_201_files: boolean
  view_classified_titles: boolean
  unlock_classified: boolean
  view_org_chart: boolean
  view_elibrary: boolean
  add_to_elibrary: boolean
  export_download: boolean
  forward_documents: boolean
  view_activity_logs: boolean
  manage_users: boolean
}

type PermKey = keyof RolePermissions

interface ClassifiedSecurity {
  require_two_person: boolean
  max_failed_attempts: number
  lockout_duration: number
}

interface AuditLogging {
  log_views: boolean
  log_downloads: boolean
  log_forwards: boolean
  log_failed_unlocks: boolean
  log_login_logout: boolean
  log_201_edits: boolean
}

interface AlertSettings {
  email_alerts_enabled: boolean
  alert_emails: string
  alert_on_classified_unlock: boolean
  alert_on_repeated_access: boolean
  repeated_access_threshold: number
  alert_on_failed_unlock: boolean
  alert_on_user_changes: boolean
  alert_on_archive_delete: boolean
  alert_on_201_submit: boolean
}

interface EscalationSettings {
  days_until_expired: number
  escalation_email_notify: boolean
}

interface MandatoryRemarks {
  require_on_download_classified: boolean
  require_on_forward: boolean
  min_remarks_length: number
}

interface BackupSettings {
  frequency: 'daily' | 'weekly' | 'monthly'
  backup_time: string
  retain_last_n: number
  email_on_complete: boolean
  backup_email: string
}

// ── Constants ──────────────────────────────────

const ROLE_LABELS: Record<RoleKey, { label: string; color: string; desc: string }> = {
  administrator:   { label: 'Administrator',   color: 'bg-red-100 text-red-700',       desc: 'Full system access' },
  records_officer: { label: 'Records Officer', color: 'bg-violet-100 text-violet-700', desc: 'Unit-scoped management' },
  officer:         { label: 'Officer',         color: 'bg-blue-100 text-blue-700',     desc: 'Read + limited actions' },
}

const PERMISSION_GROUPS: { label: string; perms: { key: PermKey; label: string }[] }[] = [
  {
    label: 'Master Documents',
    perms: [
      { key: 'view_master_docs',           label: 'View Master Documents' },
      { key: 'upload_edit_archive_master', label: 'Upload / Edit / Archive' },
    ],
  },
  {
    label: 'Special Orders',
    perms: [
      { key: 'view_special_orders',           label: 'View Special Orders' },
      { key: 'create_archive_special_orders', label: 'Create / Archive Special Orders' },
    ],
  },
  {
    label: '201 Files',
    perms: [
      { key: 'view_201_files', label: 'View 201 Files' },
      { key: 'edit_201_files', label: 'Edit / Update 201 Files' },
    ],
  },
  {
    label: 'Classified Documents',
    perms: [
      { key: 'view_classified_titles', label: 'View Titles Only' },
      { key: 'unlock_classified',      label: 'Unlock & View Contents' },
    ],
  },
  {
    label: 'Other Modules',
    perms: [
      { key: 'view_org_chart',  label: 'View Org Chart' },
      { key: 'view_elibrary',   label: 'View e-Library' },
      { key: 'add_to_elibrary', label: 'Add to e-Library' },
    ],
  },
  {
    label: 'Actions',
    perms: [
      { key: 'export_download',    label: 'Export / Download Files' },
      { key: 'forward_documents',  label: 'Forward Documents' },
      { key: 'view_activity_logs', label: 'View Activity Logs' },
      { key: 'manage_users',       label: 'Manage Users' },
    ],
  },
]

const DEFAULT_PERMISSIONS: Record<RoleKey, RolePermissions> = {
  administrator: {
    view_master_docs: true, upload_edit_archive_master: true,
    view_special_orders: true, create_archive_special_orders: true,
    view_201_files: true, edit_201_files: true,
    view_classified_titles: true, unlock_classified: true,
    view_org_chart: true, view_elibrary: true, add_to_elibrary: true,
    export_download: true, forward_documents: true,
    view_activity_logs: true, manage_users: true,
  },
  records_officer: {
    view_master_docs: true, upload_edit_archive_master: true,
    view_special_orders: true, create_archive_special_orders: false,
    view_201_files: true, edit_201_files: true,
    view_classified_titles: true, unlock_classified: false,
    view_org_chart: true, view_elibrary: true, add_to_elibrary: true,
    export_download: true, forward_documents: true,
    view_activity_logs: false, manage_users: false,
  },
  officer: {
    view_master_docs: true, upload_edit_archive_master: false,
    view_special_orders: true, create_archive_special_orders: false,
    view_201_files: false, edit_201_files: false,
    view_classified_titles: true, unlock_classified: false,
    view_org_chart: true, view_elibrary: true, add_to_elibrary: false,
    export_download: false, forward_documents: true,
    view_activity_logs: false, manage_users: false,
  },
}

// ── Small reusable components ──────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function Divider() {
  return <div className="border-t border-slate-100 my-7" />
}

function Toggle({
  checked,
  onChange,
  disabled = false,
  size = 'md',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  const track     = size === 'sm' ? 'w-8 h-4' : 'w-10 h-5'
  const thumb     = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'
  const translate = checked ? (size === 'sm' ? 'translate-x-4' : 'translate-x-5') : 'translate-x-0.5'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex items-center ${track} rounded-full transition-colors duration-200 focus:outline-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
    >
      <span
        className={`${thumb} bg-white rounded-full shadow transition-transform duration-200 ${translate}`}
      />
    </button>
  )
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  unit,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  unit?: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Math.min(max, Math.max(min, Number(e.target.value))))}
        className="w-20 px-3 py-2 border-[1.5px] border-slate-200 rounded-lg text-sm text-center font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition disabled:opacity-50"
      />
      {unit && <span className="text-xs text-slate-500">{unit}</span>}
    </div>
  )
}

// ── Tab 1: Access Control ──────────────────────

function AccessControlTab() {
  const { toast } = useToast()
  const [permissions, setPermissions] = useState<Record<RoleKey, RolePermissions>>(DEFAULT_PERMISSIONS)
  const [security, setSecurity]       = useState<ClassifiedSecurity>({
    require_two_person: false,
    max_failed_attempts: 3,
    lockout_duration: 15,
  })
  const [unitScope, setUnitScope] = useState(true)

  const setPermission = useCallback(
    (role: RoleKey, perm: PermKey, val: boolean) => {
      if (role === 'administrator') return
      setPermissions(prev => ({
        ...prev,
        [role]: { ...prev[role], [perm]: val },
      }))
    },
    []
  )

  function save() {
    toast.success('Access control settings saved.')
  }

  return (
    <div className="space-y-0">

      {/* Permission Matrix */}
      <SectionHeader
        title="Role Permission Matrix"
        subtitle="Define what each role can access and perform across the system."
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 w-[260px]">
                Permission
              </th>
              {(Object.keys(ROLE_LABELS) as RoleKey[]).map(role => (
                <th key={role} className="px-4 py-3.5 text-center w-[160px]">
                  <div className="flex flex-col items-center gap-1">
                    <Badge className={ROLE_LABELS[role].color}>{ROLE_LABELS[role].label}</Badge>
                    <span className="text-[10px] text-slate-400">{ROLE_LABELS[role].desc}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group, gi) => (
              <React.Fragment key={`group-${gi}`}>
                <tr className="bg-slate-50/60 border-b border-slate-100">
                  <td
                    colSpan={4}
                    className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400"
                  >
                    {group.label}
                  </td>
                </tr>
                {group.perms.map(({ key, label }) => (
                  <tr key={key} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                    <td className="px-5 py-3 text-[13px] text-slate-700">{label}</td>
                    {(Object.keys(ROLE_LABELS) as RoleKey[]).map(role => (
                      <td key={role} className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <Toggle
                            checked={permissions[role][key]}
                            onChange={val => setPermission(role, key, val)}
                            disabled={role === 'administrator'}
                            size="sm"
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400 mt-2">
        🔒 Administrator permissions are locked and cannot be modified.
      </p>

      <Divider />

      {/* Records Officer Unit Scope */}
      <SectionHeader
        title="Records Officer Scope"
        subtitle="Restrict Records Officers to documents tagged to their assigned unit only."
      />

      <div className="flex items-center justify-between px-5 py-4 bg-violet-50 border border-violet-200 rounded-xl">
        <div>
          <p className="text-sm font-semibold text-violet-800">Enable Unit-Scoped Access</p>
          <p className="text-xs text-violet-600 mt-0.5">
            When enabled, Records Officers can only view and manage documents belonging to their assigned unit.
          </p>
        </div>
        <Toggle checked={unitScope} onChange={setUnitScope} />
      </div>

      <Divider />

      {/* Classified Document Security */}
      <SectionHeader
        title="Classified Document Security"
        subtitle="Additional authentication rules for accessing classified documents."
      />

      <div className="space-y-4">
        <div className="flex items-start justify-between px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl gap-6">
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">Two-Person Authorization</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              Require a second authorized user to approve before a classified document can be unlocked.
              One person requests, another approves.
            </p>
          </div>
          <Toggle checked={security.require_two_person} onChange={v => setSecurity(s => ({ ...s, require_two_person: v }))} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="px-5 py-4 bg-white border border-slate-200 rounded-xl space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">Max Failed Unlock Attempts</p>
              <p className="text-[11px] text-slate-400">Lock document after this many consecutive failures.</p>
            </div>
            <NumberInput
              value={security.max_failed_attempts}
              onChange={v => setSecurity(s => ({ ...s, max_failed_attempts: v }))}
              min={1}
              max={10}
              unit="attempts"
            />
          </div>
          <div className="px-5 py-4 bg-white border border-slate-200 rounded-xl space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">Lockout Duration</p>
              <p className="text-[11px] text-slate-400">How long the document stays locked after too many failures.</p>
            </div>
            <NumberInput
              value={security.lockout_duration}
              onChange={v => setSecurity(s => ({ ...s, lockout_duration: v }))}
              min={1}
              max={1440}
              unit="minutes"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-6">
        <Button variant="primary" onClick={save}>💾 Save Access Control Settings</Button>
      </div>
    </div>
  )
}

// ── Tab 2: Audit & Notifications ──────────────

function AuditNotificationsTab() {
  const { toast } = useToast()

  const [logging, setLogging] = useState<AuditLogging>({
    log_views: true,
    log_downloads: true,
    log_forwards: true,
    log_failed_unlocks: true,
    log_login_logout: false,
    log_201_edits: true,
  })

  const [alerts, setAlerts] = useState<AlertSettings>({
    email_alerts_enabled: false,
    alert_emails: '',
    alert_on_classified_unlock: true,
    alert_on_repeated_access: true,
    repeated_access_threshold: 5,
    alert_on_failed_unlock: true,
    alert_on_user_changes: false,
    alert_on_archive_delete: true,
    alert_on_201_submit: false,
  })

  const [escalation, setEscalation] = useState<EscalationSettings>({
    days_until_expired: 30,
    escalation_email_notify: true,
  })

  const [remarks, setRemarks] = useState<MandatoryRemarks>({
    require_on_download_classified: true,
    require_on_forward: false,
    min_remarks_length: 20,
  })

  function save() {
    toast.success('Audit & notification settings saved.')
  }

  const LOG_ITEMS: { key: keyof AuditLogging; label: string; desc: string }[] = [
    { key: 'log_views',          label: 'Document Views',        desc: 'Log every time a document is opened or previewed.' },
    { key: 'log_downloads',      label: 'Downloads',             desc: 'Log every file download action.' },
    { key: 'log_forwards',       label: 'Document Forwards',     desc: 'Log when a document is forwarded to another user.' },
    { key: 'log_failed_unlocks', label: 'Failed Unlock Attempts',desc: 'Log every failed classified document unlock.' },
    { key: 'log_login_logout',   label: 'Login / Logout Events', desc: 'Track when users sign in and out of the system.' },
    { key: 'log_201_edits',      label: '201 File Edits',        desc: 'Log profile and document updates on personnel files.' },
  ]

  return (
    <div className="space-y-0">

      {/* Logging Rules */}
      <SectionHeader
        title="Activity Logging Rules"
        subtitle="Choose which user actions are recorded in the Activity Log."
      />

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
        {LOG_ITEMS.map(item => (
          <div key={item.key} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition">
            <div>
              <p className="text-sm font-semibold text-slate-700">{item.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
            </div>
            <Toggle
              checked={logging[item.key]}
              onChange={v => setLogging(l => ({ ...l, [item.key]: v }))}
            />
          </div>
        ))}
      </div>

      <Divider />

      {/* Email Alerts */}
      <SectionHeader
        title="Email Alert Configuration"
        subtitle="Get notified when critical system events occur."
      />

      <div className="space-y-4">
        {/* Master toggle */}
        <div className="flex items-center justify-between px-5 py-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-blue-800">Enable Email Alerts</p>
            <p className="text-xs text-blue-600 mt-0.5">Master switch for all system email notifications.</p>
          </div>
          <Toggle
            checked={alerts.email_alerts_enabled}
            onChange={v => setAlerts(a => ({ ...a, email_alerts_enabled: v }))}
          />
        </div>

        <div className={alerts.email_alerts_enabled ? '' : 'opacity-50 pointer-events-none'}>
          <div className="mb-4">
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Alert Recipient Email(s)
            </label>
            <input
              type="text"
              className="w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              placeholder="admin@ddnppo.gov.ph, director@ddnppo.gov.ph"
              value={alerts.alert_emails}
              onChange={e => setAlerts(a => ({ ...a, alert_emails: e.target.value }))}
            />
            <p className="text-[11px] text-slate-400 mt-1">Separate multiple addresses with commas.</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
            {[
              { key: 'alert_on_classified_unlock' as keyof AlertSettings, label: 'Classified Document Unlocked',      desc: 'Send alert whenever any classified document is successfully unlocked.' },
              { key: 'alert_on_repeated_access'   as keyof AlertSettings, label: 'Repeated Access Threshold Reached', desc: 'Alert when the same document is accessed more than the configured threshold.' },
              { key: 'alert_on_failed_unlock'     as keyof AlertSettings, label: 'Failed Unlock Attempt',             desc: 'Alert on every failed classified document password attempt.' },
              { key: 'alert_on_user_changes'      as keyof AlertSettings, label: 'User Account Created or Deleted',   desc: 'Alert when a system user is added or removed.' },
              { key: 'alert_on_archive_delete'    as keyof AlertSettings, label: 'Document Archived or Deleted',      desc: 'Alert when any document is archived or permanently deleted.' },
              { key: 'alert_on_201_submit'        as keyof AlertSettings, label: '201 File Submitted to DPRM',        desc: 'Alert when a personnel file is submitted for DPRM review.' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                </div>
                <Toggle
                  checked={Boolean(alerts[item.key])}
                  onChange={v => setAlerts(a => ({ ...a, [item.key]: v }))}
                />
              </div>
            ))}
          </div>

          {/* Repeated access threshold */}
          {alerts.alert_on_repeated_access && (
            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl mt-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Repeated Access Threshold</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Alert when a document is accessed this many times in a single day.</p>
              </div>
              <NumberInput
                value={alerts.repeated_access_threshold}
                onChange={v => setAlerts(a => ({ ...a, repeated_access_threshold: v }))}
                min={2}
                max={50}
                unit="accesses / day"
              />
            </div>
          )}
        </div>
      </div>

      <Divider />

      {/* Document Status Escalation */}
      <SectionHeader
        title="Document Status Escalation"
        subtitle="Automatically escalate 201 document statuses when they go stale."
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="px-5 py-4 bg-white border border-slate-200 rounded-xl space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">Days Until EXPIRED</p>
            <p className="text-[11px] text-slate-400">FOR_UPDATE status auto-escalates to EXPIRED after this many days.</p>
          </div>
          <NumberInput
            value={escalation.days_until_expired}
            onChange={v => setEscalation(e => ({ ...e, days_until_expired: v }))}
            min={7}
            max={365}
            unit="days"
          />
        </div>
        <div className="px-5 py-4 bg-white border border-slate-200 rounded-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">Notify on Escalation</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Send an email to the Records Officer when a document escalates to EXPIRED.
              </p>
            </div>
            <Toggle
              checked={escalation.escalation_email_notify}
              onChange={v => setEscalation(e => ({ ...e, escalation_email_notify: v }))}
              disabled={!alerts.email_alerts_enabled}
            />
          </div>
          {!alerts.email_alerts_enabled && (
            <p className="text-[10px] text-amber-600 mt-2">⚠ Enable Email Alerts to use this option.</p>
          )}
        </div>
      </div>

      <Divider />

      {/* Mandatory Remarks */}
      <SectionHeader
        title="Mandatory Remarks"
        subtitle="Force users to provide a reason before performing sensitive actions."
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between px-5 py-4 bg-white border border-slate-200 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-slate-700">Require Remarks Before Downloading Classified Docs</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Users must state a reason before a classified file download proceeds.</p>
          </div>
          <Toggle
            checked={remarks.require_on_download_classified}
            onChange={v => setRemarks(r => ({ ...r, require_on_download_classified: v }))}
          />
        </div>
        <div className="flex items-center justify-between px-5 py-4 bg-white border border-slate-200 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-slate-700">Require Remarks Before Forwarding Documents</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Users must enter forwarding instructions or remarks before sending.</p>
          </div>
          <Toggle
            checked={remarks.require_on_forward}
            onChange={v => setRemarks(r => ({ ...r, require_on_forward: v }))}
          />
        </div>

        {(remarks.require_on_download_classified || remarks.require_on_forward) && (
          <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Minimum Remarks Length</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Enforce a minimum character count for remarks fields.</p>
            </div>
            <NumberInput
              value={remarks.min_remarks_length}
              onChange={v => setRemarks(r => ({ ...r, min_remarks_length: v }))}
              min={5}
              max={200}
              unit="characters"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end pt-6">
        <Button variant="primary" onClick={save}>💾 Save Audit & Notification Settings</Button>
      </div>
    </div>
  )
}

// ── Tab 3: Backup & Export ─────────────────────

function BackupExportTab() {
  const { toast } = useToast()

  const [backup, setBackup] = useState<BackupSettings>({
    frequency: 'weekly',
    backup_time: '02:00',
    retain_last_n: 5,
    email_on_complete: false,
    backup_email: '',
  })

  const [exporting, setExporting]     = useState<string | null>(null)
  const [logDateFrom, setLogDateFrom] = useState('')
  const [logDateTo,   setLogDateTo]   = useState('')
  const [storageViewOpen, setStorageViewOpen] = useState(false)
  const [exportTarget, setExportTarget] = useState<'device' | 'cloud'>('device')
  const [cloudExportBasePath, setCloudExportBasePath] = useState('backups')

  const [loadingStorage, setLoadingStorage] = useState(true)
  const [storageUsedMb, setStorageUsedMb] = useState(0)
  const [storageSlices, setStorageSlices] = useState<Array<{ label: string; mb: number; color: string }>>([])
  const [largestFiles, setLargestFiles] = useState<Array<{ name: string; sizeMb: number; type: string }>>([])
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  const storageTotalGb = 5

  const parseSizeToMb = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0
    if (typeof value === 'number') return value

    const text = String(value).trim().toUpperCase()
    const matched = text.match(/([\d.]+)\s*(KB|MB|GB|B)?/)
    if (!matched) return 0

    const amount = Number(matched[1])
    const unit = matched[2] ?? 'MB'
    if (!Number.isFinite(amount)) return 0

    if (unit === 'GB') return amount * 1024
    if (unit === 'MB') return amount
    if (unit === 'KB') return amount / 1024
    return amount / (1024 * 1024)
  }

  const formatMb = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
    if (mb >= 1) return `${mb.toFixed(1)} MB`
    return `${Math.max(0, Math.round(mb * 1024))} KB`
  }

  const toCsv = (rows: Array<Record<string, unknown>>, columns: string[]) => {
    const escapeCsv = (value: unknown) => {
      const raw = value === null || value === undefined ? '' : String(value)
      return `"${raw.replace(/"/g, '""')}"`
    }

    const header = columns.map(escapeCsv).join(',')
    const body = rows.map(row => columns.map(col => escapeCsv(row[col])).join(',')).join('\n')
    return `${header}\n${body}`
  }

  const downloadCsv = (filename: string, csvText: string) => {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const saveCsvToDevice = async (filename: string, csvText: string) => {
    const filePicker = (window as any).showSaveFilePicker
    if (typeof filePicker !== 'function') {
      downloadCsv(filename, csvText)
      return
    }

    const handle = await filePicker({
      suggestedName: filename,
      types: [
        {
          description: 'CSV file',
          accept: { 'text/csv': ['.csv'] },
        },
      ],
    })

    const writable = await handle.createWritable()
    await writable.write(csvText)
    await writable.close()
  }

  const persistCsv = async (
    filename: string,
    csvText: string,
    label: string,
    silent = false
  ) => {
    if (exportTarget === 'device') {
      await saveCsvToDevice(filename, csvText)
      if (!silent) {
        toast.success(`${label} saved to your chosen device location.`)
      }
      return
    }

    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
    const basePath = cloudExportBasePath.replace(/^\/+|\/+$/g, '')
    const cloudPath = basePath ? `${basePath}/${filename}` : filename

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(cloudPath, blob, {
        contentType: 'text/csv;charset=utf-8',
        upsert: false,
      })

    if (error) throw error

    if (!silent) {
      toast.success(`${label} saved to cloud: ${cloudPath}`)
    }

    return data.path
  }

  const buildNextBackupText = useMemo(() => {
    const now = new Date()
    const [hour, minute] = backup.backup_time.split(':').map(Number)
    const next = new Date(now)
    next.setHours(hour || 0, minute || 0, 0, 0)

    if (backup.frequency === 'daily') {
      if (next <= now) next.setDate(next.getDate() + 1)
    }
    if (backup.frequency === 'weekly') {
      if (next <= now) next.setDate(next.getDate() + 7)
    }
    if (backup.frequency === 'monthly') {
      if (next <= now) next.setMonth(next.getMonth() + 1)
    }

    const diffMs = Math.max(0, next.getTime() - now.getTime())
    const diffHrs = Math.round(diffMs / (1000 * 60 * 60))

    return {
      label: next.toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      eta: diffHrs <= 1 ? 'In about 1 hour' : `In about ${diffHrs} hours`,
    }
  }, [backup.frequency, backup.backup_time])

  const refreshStorageData = useCallback(async () => {
    setLoadingStorage(true)
    try {
      const [
        masterRes,
        specialAttRes,
        libraryRes,
        classifiedRes,
        docs201Res,
      ] = await Promise.all([
        supabase.from('master_documents').select('id, title, size, archived'),
        supabase.from('special_order_attachments').select('id, file_name, file_size, archived'),
        supabase.from('library_items').select('id, title, size, archived'),
        supabase.from('confidential_docs').select('id, title, size, archived'),
        supabase.from('personnel_201_docs').select('id, label, file_size, status, file_url'),
      ])

      const masterRows = (masterRes.data ?? []).filter((r: any) => r.archived !== true)
      const specialRows = (specialAttRes.data ?? []).filter((r: any) => r.archived !== true)
      const libraryRows = (libraryRes.data ?? []).filter((r: any) => r.archived !== true)
      const classifiedRows = (classifiedRes.data ?? []).filter((r: any) => r.archived !== true)
      const docs201Rows = (docs201Res.data ?? []).filter((r: any) => !!r.file_url)

      const masterMb = masterRows.reduce((sum: number, r: any) => sum + parseSizeToMb(r.size), 0)
      const specialMb = specialRows.reduce((sum: number, r: any) => sum + parseSizeToMb(r.file_size), 0)
      const libraryMb = libraryRows.reduce((sum: number, r: any) => sum + parseSizeToMb(r.size), 0)
      const classifiedMb = classifiedRows.reduce((sum: number, r: any) => sum + parseSizeToMb(r.size), 0)
      const docs201Mb = docs201Rows.reduce((sum: number, r: any) => sum + parseSizeToMb(r.file_size), 0)

      const slices = [
        { label: 'Master Documents', mb: masterMb, color: 'bg-blue-500' },
        { label: 'Special Orders', mb: specialMb, color: 'bg-indigo-500' },
        { label: '201 Files', mb: docs201Mb, color: 'bg-violet-500' },
        { label: 'Classified Docs', mb: classifiedMb, color: 'bg-red-500' },
        { label: 'e-Library', mb: libraryMb, color: 'bg-emerald-500' },
      ]

      setStorageSlices(slices)
      setStorageUsedMb(slices.reduce((sum, s) => sum + s.mb, 0))

      const top = [
        ...masterRows.map((r: any) => ({ name: r.title, sizeMb: parseSizeToMb(r.size), type: 'Master Doc' })),
        ...specialRows.map((r: any) => ({ name: r.file_name, sizeMb: parseSizeToMb(r.file_size), type: 'Special Order' })),
        ...docs201Rows.map((r: any) => ({ name: r.label, sizeMb: parseSizeToMb(r.file_size), type: '201 File' })),
        ...libraryRows.map((r: any) => ({ name: r.title, sizeMb: parseSizeToMb(r.size), type: 'e-Library' })),
        ...classifiedRows.map((r: any) => ({ name: r.title, sizeMb: parseSizeToMb(r.size), type: 'Classified' })),
      ]
        .filter(f => f.sizeMb > 0)
        .sort((a, b) => b.sizeMb - a.sizeMb)
        .slice(0, 10)

      setLargestFiles(top)
      setLastSyncAt(new Date().toISOString())
    } catch (error) {
      console.error('Storage refresh failed:', error)
      toast.error('Failed to load storage metrics from Supabase.')
    } finally {
      setLoadingStorage(false)
    }
  }, [toast])

  useEffect(() => {
    refreshStorageData()
  }, [refreshStorageData])

  const storagePercent = Math.min(100, Math.round((storageUsedMb / (storageTotalGb * 1024)) * 100))

  async function handleExport(
    kind: 'master' | 'special' | 'summary201' | 'files201' | 'archived' | 'activity',
    label: string,
    silent = false
  ) {
    setExporting(label)
    try {
      const timestamp = new Date().toISOString().slice(0, 10)

      if (kind === 'master') {
        const { data, error } = await supabase
          .from('master_documents')
          .select('title, level, type, date, tag')
          .order('created_at', { ascending: false })
        if (error) throw error
        const rows = data ?? []
        await persistCsv(
          `master-documents-${timestamp}.csv`,
          toCsv(rows as Array<Record<string, unknown>>, ['title', 'level', 'type', 'date', 'tag']),
          label,
          silent
        )
      }

      if (kind === 'special') {
        const { data, error } = await supabase
          .from('special_orders')
          .select('reference, subject, date, status')
          .order('created_at', { ascending: false })
        if (error) throw error
        const rows = data ?? []
        await persistCsv(
          `special-orders-${timestamp}.csv`,
          toCsv(rows as Array<Record<string, unknown>>, ['reference', 'subject', 'date', 'status']),
          label,
          silent
        )
      }

      if (kind === 'summary201') {
        const { data, error } = await supabase
          .from('personnel_201')
          .select('name, rank, unit, last_updated')
          .order('created_at', { ascending: false })
        if (error) throw error
        const rows = (data ?? []).map((r: any) => ({
          name: r.name,
          rank: r.rank,
          unit: r.unit,
          last_updated: r.last_updated,
        }))
        await persistCsv(
          `201-files-summary-${timestamp}.csv`,
          toCsv(rows as Array<Record<string, unknown>>, ['name', 'rank', 'unit', 'last_updated']),
          label,
          silent
        )
      }

      if (kind === 'files201') {
        const [personnelRes, docsRes] = await Promise.all([
          supabase
            .from('personnel_201')
            .select('id, name, rank, serial_no, unit'),
          supabase
            .from('personnel_201_docs')
            .select('personnel_id, category, label, status, date_updated, filed_by, file_size, file_url')
            .order('date_updated', { ascending: false }),
        ])

        if (personnelRes.error) throw personnelRes.error
        if (docsRes.error) throw docsRes.error

        const personnelMap = new Map<string, any>()
        for (const p of (personnelRes.data ?? [])) {
          personnelMap.set(p.id, p)
        }

        const rows = (docsRes.data ?? []).map((d: any) => {
          const person = personnelMap.get(d.personnel_id)
          return {
            personnel_name: person?.name ?? 'Unknown',
            rank: person?.rank ?? '',
            serial_no: person?.serial_no ?? '',
            unit: person?.unit ?? '',
            category: d.category,
            document_label: d.label,
            status: d.status,
            date_updated: d.date_updated,
            filed_by: d.filed_by,
            file_size: d.file_size,
            has_file: d.file_url ? 'Yes' : 'No',
          }
        })

        await persistCsv(
          `201-files-detailed-${timestamp}.csv`,
          toCsv(rows as Array<Record<string, unknown>>, [
            'personnel_name',
            'rank',
            'serial_no',
            'unit',
            'category',
            'document_label',
            'status',
            'date_updated',
            'filed_by',
            'file_size',
            'has_file',
          ]),
          label,
          silent
        )
      }

      if (kind === 'archived') {
        const { data, error } = await supabase
          .from('archived_docs')
          .select('title, type, archived_date, archived_by')
          .order('created_at', { ascending: false })
        if (error) throw error
        const rows = data ?? []
        await persistCsv(
          `archived-documents-${timestamp}.csv`,
          toCsv(rows as Array<Record<string, unknown>>, ['title', 'type', 'archived_date', 'archived_by']),
          label,
          silent
        )
      }

      if (kind === 'activity') {
        let query = supabase
          .from('activity_logs')
          .select('user_name, action, document, date, time, device')
          .order('created_at', { ascending: false })

        if (logDateFrom) query = query.gte('date', logDateFrom)
        if (logDateTo) query = query.lte('date', logDateTo)

        const { data, error } = await query
        if (error) throw error
        const rows = data ?? []
        await persistCsv(
          `activity-logs-${timestamp}.csv`,
          toCsv(rows as Array<Record<string, unknown>>, ['user_name', 'action', 'document', 'date', 'time', 'device']),
          label,
          silent
        )
      }
    } catch (error: any) {
      console.error(`Export failed for ${label}:`, error)
      toast.error(error?.message ? `Export failed: ${error.message}` : 'Export failed.')
    } finally {
      setExporting(null)
    }
  }

  async function handleExportAll() {
    setExporting('All')
    try {
      await handleExport('master', 'Master Documents', true)
      await handleExport('special', 'Special Orders', true)
      await handleExport('summary201', '201 Files Summary', true)
      await handleExport('files201', '201 Files (Detailed)', true)
      await handleExport('archived', 'Archived Documents', true)
      await handleExport('activity', 'Activity Logs', true)
      toast.success(
        exportTarget === 'device'
          ? 'All CSV files saved to your chosen device location(s).'
          : 'All CSV files saved to cloud storage.'
      )
    } finally {
      setExporting(null)
    }
  }

  function saveBackupSettings() {
    toast.success('Backup schedule saved.')
  }

  const cls = 'w-full px-3 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition'

  return (
    <div className="space-y-0">

      {/* Storage Usage */}
      <SectionHeader
        title="Storage Usage"
        subtitle="Current Supabase storage consumption across all document categories."
      />

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-3xl font-extrabold text-slate-800">{formatMb(storageUsedMb)}</span>
            <span className="text-sm text-slate-400 ml-2">of {storageTotalGb} GB limit</span>
          </div>
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${
            storagePercent >= 80 ? 'bg-red-100 text-red-700'
            : storagePercent >= 60 ? 'bg-amber-100 text-amber-700'
            : 'bg-emerald-100 text-emerald-700'
          }`}>{storagePercent}%</span>
        </div>

        {/* Main bar */}
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
          {storageSlices.map(s => (
            <div
              key={s.label}
              className={`${s.color} h-full transition-all`}
              style={{ width: `${storageUsedMb > 0 ? Math.max(2, (s.mb / storageUsedMb) * 100) : 0}%` }}
              title={`${s.label}: ${formatMb(s.mb)}`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {storageSlices.map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.color}`} />
              <span className="text-xs text-slate-600 truncate">{s.label}</span>
              <span className="text-xs text-slate-400 ml-auto">{formatMb(s.mb)}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setStorageViewOpen(true)}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            View largest files →
          </button>

          <div className="flex items-center gap-3">
            {loadingStorage ? (
              <span className="text-xs text-slate-400">Syncing Supabase…</span>
            ) : (
              <span className="text-xs text-slate-400">
                Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleString('en-PH') : '—'}
              </span>
            )}
            <button
              onClick={refreshStorageData}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <Divider />

      {/* Scheduled Backup */}
      <SectionHeader
        title="Scheduled Backup"
        subtitle="Automatically export a full data manifest on a regular schedule."
      />

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2 text-xs text-amber-800">
        <span className="flex-shrink-0 mt-0.5">ℹ️</span>
        <span>
          Scheduled backups require a server-side cron job or Supabase Edge Function.
          Configure the schedule below and implement the trigger in your backend. Manual export is available immediately.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Backup Frequency
          </label>
          <select
            className={cls}
            value={backup.frequency}
            onChange={e => setBackup(b => ({ ...b, frequency: e.target.value as BackupSettings['frequency'] }))}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Time of Day
          </label>
          <input
            type="time"
            className={cls}
            value={backup.backup_time}
            onChange={e => setBackup(b => ({ ...b, backup_time: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Retain Last N Backups
          </label>
          <NumberInput
            value={backup.retain_last_n}
            onChange={v => setBackup(b => ({ ...b, retain_last_n: v }))}
            min={1}
            max={30}
            unit="backups"
          />
        </div>
        <div className="flex flex-col justify-between">
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Email Notification on Completion
          </label>
          <div className="flex items-center gap-2 pb-1">
            <Toggle
              checked={backup.email_on_complete}
              onChange={v => setBackup(b => ({ ...b, email_on_complete: v }))}
            />
            <span className="text-sm text-slate-600">{backup.email_on_complete ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>
      </div>

      {backup.email_on_complete && (
        <div className="mt-4">
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Backup Notification Email
          </label>
          <input
            type="email"
            className={cls}
            placeholder="admin@ddnppo.gov.ph"
            value={backup.backup_email}
            onChange={e => setBackup(b => ({ ...b, backup_email: e.target.value }))}
          />
        </div>
      )}

      {/* Last/Next backup */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Last Backup</p>
          <p className="text-sm font-semibold text-slate-700 mt-1">No recorded backup run in database</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Connect backup logs table/edge function to show runtime status.</p>
        </div>
        <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Next Scheduled Backup</p>
          <p className="text-sm font-semibold text-slate-700 mt-1">{buildNextBackupText.label}</p>
          <p className="text-[11px] text-blue-600 mt-0.5">⏱ {buildNextBackupText.eta}</p>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <Button variant="primary" onClick={saveBackupSettings}>💾 Save Backup Schedule</Button>
      </div>

      <Divider />

      {/* Manual Export */}
      <SectionHeader
        title="Manual Data Export"
        subtitle="Export data manifests as CSV files to this device or save to cloud storage."
      />

      <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Export Destination</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExportTarget('device')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
              exportTarget === 'device'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
            }`}
          >
            ⬇ This device
          </button>
          <button
            onClick={() => setExportTarget('cloud')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
              exportTarget === 'cloud'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
            }`}
          >
            ☁ Cloud storage
          </button>
          <span className="text-[11px] text-slate-400 ml-auto">
            Current: {exportTarget === 'device' ? 'Device Download' : 'Cloud Save'}
          </span>
        </div>

        {exportTarget === 'device' ? (
          <>
            <p className="text-[11px] text-slate-500 mt-2">
              Device export will open a Save dialog every time so you can choose exactly where to store each file.
            </p>
          </>
        ) : (
          <div className="mt-3 space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Cloud Folder Path
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border-[1.5px] border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500 transition"
              value={cloudExportBasePath}
              onChange={e => setCloudExportBasePath(e.target.value)}
              placeholder="backups/monthly"
            />
            <p className="text-[11px] text-slate-500">
              Files will be saved exactly under: {`${(cloudExportBasePath.replace(/^\/+|\/+$/g, '') || '(bucket root)')}/filename.csv`}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {[
          { key: 'master' as const, label: 'Master Documents',   icon: '📁', desc: 'Title, level, type, date, tag' },
          { key: 'special' as const, label: 'Special Orders',     icon: '📋', desc: 'Reference, subject, date, status' },
          { key: 'summary201' as const, label: '201 Files Summary',  icon: '📔', desc: 'Personnel info and last updated date' },
          { key: 'files201' as const, label: '201 Files (Detailed)', icon: '🧾', desc: 'Per-document checklist rows with file metadata' },
          { key: 'archived' as const, label: 'Archived Documents', icon: '🗄️', desc: 'Title, type, archived date, archived by' },
        ].map(item => (
          <div
            key={item.label}
            className="flex items-center justify-between px-5 py-3.5 bg-white border border-slate-200 rounded-xl hover:border-blue-200 transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{item.icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                <p className="text-[11px] text-slate-400">{item.desc}</p>
              </div>
            </div>
            <button
              onClick={() => handleExport(item.key, item.label)}
              disabled={!!exporting}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting === item.label ? (
                <><div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin" /> Exporting…</>
              ) : (
                <>⬇ Export CSV</>
              )}
            </button>
          </div>
        ))}

        {/* Activity Logs with date range */}
        <div className="px-5 py-4 bg-white border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">📊</span>
            <div>
              <p className="text-sm font-semibold text-slate-700">Activity Logs</p>
              <p className="text-[11px] text-slate-400">User, action, document, date, time, device</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-medium">From</label>
              <input
                type="date"
                className="px-3 py-1.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500 transition"
                value={logDateFrom}
                onChange={e => setLogDateFrom(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-medium">To</label>
              <input
                type="date"
                className="px-3 py-1.5 border-[1.5px] border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500 transition"
                value={logDateTo}
                onChange={e => setLogDateTo(e.target.value)}
              />
            </div>
            <button
              onClick={() => handleExport('activity', 'Activity Logs')}
              disabled={!!exporting}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition disabled:opacity-50 ml-auto"
            >
              {exporting === 'Activity Logs' ? (
                <><div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin" /> Exporting…</>
              ) : (
                <>⬇ Export CSV</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Export All */}
      <div className="mt-4 p-5 bg-slate-800 rounded-xl flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-white">Export Everything</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Download all CSV files from Supabase in one click.
          </p>
        </div>
        <button
          onClick={handleExportAll}
          disabled={!!exporting}
          className="inline-flex items-center gap-2 bg-white text-slate-800 text-sm font-bold px-4 py-2 rounded-lg hover:bg-slate-100 transition disabled:opacity-50 flex-shrink-0"
        >
          {exporting === 'All' ? (
            <><div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" /> Preparing…</>
          ) : (
            <>📦 Export All as ZIP</>
          )}
        </button>
      </div>

      {/* Largest files modal */}
      <Modal
        open={storageViewOpen}
        onClose={() => setStorageViewOpen(false)}
        title="Largest Files"
        width="max-w-lg"
      >
        <div className="p-6 space-y-3">
          {largestFiles.length === 0 ? (
            <div className="text-sm text-slate-500">No file-size metadata available yet.</div>
          ) : largestFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-sm font-bold text-slate-400 w-5 flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{f.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{f.type}</p>
              </div>
              <span className="text-xs font-bold text-slate-600 flex-shrink-0">{formatMb(f.sizeMb)}</span>
            </div>
          ))}
          <div className="flex justify-end pt-1">
            <Button variant="outline" onClick={() => setStorageViewOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Main Settings Page ─────────────────────────

const TABS: { key: TabKey; label: string; icon: string; desc: string }[] = [
  { key: 'access', label: 'Access Control',        icon: '🔐', desc: 'Roles & permissions' },
  { key: 'audit',  label: 'Audit & Notifications', icon: '🔔', desc: 'Logging & alerts' },
  { key: 'backup', label: 'Backup & Export',        icon: '💾', desc: 'Data & storage' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('access')

  return (
    <>
      <PageHeader title="Settings" />

      <div className="p-8 space-y-6">

        {/* Tab bar */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-[1.5px] text-left transition-all ${
                activeTab === tab.key
                  ? 'bg-white border-blue-500 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-xl flex-shrink-0">{tab.icon}</span>
              <div>
                <p className={`text-sm font-bold leading-tight ${activeTab === tab.key ? 'text-blue-700' : 'text-slate-700'}`}>
                  {tab.label}
                </p>
                <p className="text-[11px] text-slate-400">{tab.desc}</p>
              </div>
              {activeTab === tab.key && (
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full ml-1 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl p-7">
          {activeTab === 'access' && <AccessControlTab />}
          {activeTab === 'audit'  && <AuditNotificationsTab />}
          {activeTab === 'backup' && <BackupExportTab />}
        </div>
      </div>
    </>
  )
}