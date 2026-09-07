import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'Cancel',
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center p-6">
      <button
        aria-label="Cancel"
        onClick={onCancel}
        className="animate-fade-in absolute inset-0 bg-black/50"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className="animate-pop-in relative z-10 w-full max-w-xs rounded-3xl bg-surface p-6 text-center shadow-soft"
      >
        <h3 className="text-lg font-extrabold text-ink">{title}</h3>
        {message && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{message}</p>}
        <div className="mt-5 flex flex-col gap-2">
          <Button variant={danger ? 'danger' : 'primary'} full onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button variant="ghost" full onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
