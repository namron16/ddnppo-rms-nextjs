'use client'
// components/ui/Modal.tsx
// Shared modal wrapper: overlay + dialog box.

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: string   // Tailwind max-w class, e.g. 'max-w-2xl'
}

export function Modal({ open, onClose, title, children, width = 'max-w-2xl' }: ModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-[rgba(10,20,40,0.55)] backdrop-blur-[2px] z-[999]"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className={cn(
          'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000]',
          'bg-white rounded-2xl shadow-2xl w-[95vw] max-h-[90vh] overflow-auto',
          'animate-fade-up',
          width
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition p-1 rounded-lg hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {children}
      </div>
    </>
  )
}
