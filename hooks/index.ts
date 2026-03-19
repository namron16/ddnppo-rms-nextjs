// hooks/index.ts
// ─────────────────────────────────────────────
// Shared custom React hooks used across the app.

import { useState, useCallback, useMemo } from 'react'

// ════════════════════════════════════════════
// useSearch
// Filters an array by a search query string
// against a list of keys from each item.
//
// Usage:
//   const { query, setQuery, filtered } = useSearch(items, ['title', 'author'])
// ════════════════════════════════════════════
export function useSearch<T extends Record<string, unknown>>(
  items: T[],
  keys: (keyof T)[],
) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(item =>
      keys.some(key => {
        const val = item[key]
        return typeof val === 'string' && val.toLowerCase().includes(q)
      })
    )
  }, [items, keys, query])

  return { query, setQuery, filtered }
}

// ════════════════════════════════════════════
// useModal
// Manages open/close state for a single modal.
//
// Usage:
//   const { isOpen, open, close } = useModal()
// ════════════════════════════════════════════
export function useModal(initialOpen = false) {
  const [isOpen, setOpen] = useState(initialOpen)
  const open  = useCallback(() => setOpen(true),  [])
  const close = useCallback(() => setOpen(false), [])
  const toggle= useCallback(() => setOpen(v => !v), [])
  return { isOpen, open, close, toggle }
}

// ════════════════════════════════════════════
// useDisclosure
// Like useModal but with a generic payload.
// Useful when a modal needs to know which item
// it was opened for.
//
// Usage:
//   const { isOpen, payload, open, close } = useDisclosure<MyType>()
//   open(item) → opens modal with item as payload
// ════════════════════════════════════════════
export function useDisclosure<T = undefined>() {
  const [state, setState] = useState<{ isOpen: boolean; payload: T | undefined }>({
    isOpen: false,
    payload: undefined,
  })

  const open  = useCallback((payload?: T) => setState({ isOpen: true,  payload }), [])
  const close = useCallback(()           => setState({ isOpen: false, payload: undefined }), [])

  return { isOpen: state.isOpen, payload: state.payload, open, close }
}

// ════════════════════════════════════════════
// useActiveTab
// Simple tab state manager.
//
// Usage:
//   const { active, setActive } = useActiveTab('ALL')
// ════════════════════════════════════════════
export function useActiveTab<T extends string>(defaultTab: T) {
  const [active, setActive] = useState<T>(defaultTab)
  return { active, setActive }
}
