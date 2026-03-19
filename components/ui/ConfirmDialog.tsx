'use client'
// components/ui/ConfirmDialog.tsx
// ─────────────────────────────────────────────
// Reusable confirmation dialog for destructive
// actions (delete, archive, restore).
//
// Usage:
//   const { isOpen, payload, open, close } = useDisclosure<string>()
//   <ConfirmDialog
//     open={isOpen}
//     title="Archive Document"
//     message={`Archive "${payload}"? This can be undone from the Archive page.`}
//     confirmLabel="Archive"
//     variant="danger"
//     onConfirm={() => { handleArchive(payload); close() }}
//     onCancel={close}
//   />

import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1100]" onClick={onCancel} />

      {/* Dialog */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1200] bg-white rounded-2xl shadow-2xl w-[420px] max-w-[95vw] p-7 animate-fade-up">
        <h3 className="text-base font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2.5">
          <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={variant}  onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </>
  )
}
