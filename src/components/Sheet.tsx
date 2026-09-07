import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  headerRight?: ReactNode
}

export function Sheet({ open, onClose, title, children, headerRight }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="sheet-panel relative z-10 flex max-h-[92vh] flex-col rounded-t-[2rem] bg-bg shadow-soft"
      >
        <div className="shrink-0 px-5 pt-3">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-ink-faint" />
          {(title || headerRight) && (
            <div className="mt-3 flex items-center justify-between gap-3 pb-1">
              <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>
              <div className="flex items-center gap-2">{headerRight}</div>
            </div>
          )}
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pt-2 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
