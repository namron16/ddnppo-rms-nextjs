'use client'
// app/admin/user-management/page.tsx

import { PageHeader }    from '@/components/ui/PageHeader'
import { Badge }         from '@/components/ui/Badge'
import { Button }        from '@/components/ui/Button'
import { Avatar }        from '@/components/ui/Avatar'
import { SearchInput }   from '@/components/ui/SearchInput'
import { EmptyState }    from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AddUserModal }  from '@/components/modals/AddUserModal'
import { useSearch, useModal, useDisclosure } from '@/hooks'
import { useToast }      from '@/components/ui/Toast'
import { USERS }         from '@/lib/data'

export default function UserManagementPage() {
  const { toast }   = useToast()
  const newModal    = useModal()
  const deleteDisc  = useDisclosure<string>()
  const { query, setQuery, filtered } = useSearch(USERS, ['name', 'email'])

  return (
    <>
      <PageHeader title="User Management" />

      <div className="p-8">
        <div className="bg-white border-[1.5px] border-slate-200 rounded-xl overflow-hidden">

          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50">
            <SearchInput value={query} onChange={setQuery} placeholder="Search users…" className="max-w-xs flex-1" />
            <Button variant="primary" size="sm" className="ml-auto" onClick={newModal.open}>+ Add User</Button>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="👥" title="No users found" description="Try a different search term." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(user => (
                    <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar initials={user.initials} color={user.avatarColor} textColor={user.role === 'admin' ? '#0f1c35' : '#fff'} size="sm" />
                          <span className="font-semibold text-sm text-slate-800">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">{user.email}</td>
                      <td className="px-4 py-3.5">
                        <Badge className={user.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}>
                          {user.role === 'admin' ? 'Administrator' : 'Officer'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5"><Badge className="bg-emerald-100 text-emerald-700">Active</Badge></td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm">✏️</Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteDisc.open(user.name)}>🗑</Button>
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

      <AddUserModal open={newModal.isOpen} onClose={newModal.close} />
      <ConfirmDialog
        open={deleteDisc.isOpen}
        title="Remove User"
        message={`Remove "${deleteDisc.payload}" from the system? They will lose all access.`}
        confirmLabel="Remove" variant="danger"
        onConfirm={() => { toast.success('User removed.'); deleteDisc.close() }}
        onCancel={deleteDisc.close}
      />
    </>
  )
}
