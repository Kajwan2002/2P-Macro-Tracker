import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  headerRight?: ReactNode
}

const CLOSE_THRESHOLD = 90 // px dragged down before it dismisses
const EXIT_MS = 260

export function Sheet({ open, onClose, title, children, headerRight }: SheetProps) {
  const [offset, setOffset] = useState(0)
  const [exiting, setExiting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const offsetRef = useRef(0)
  const startY = useRef(0)
  const active = useRef(false)

  useEffect(() => {
    if (!open) {
      setOffset(0)
      setExiting(false)
      setDragging(false)
      offsetRef.current = 0
      active.current = false
      return
    }
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

  const onPointerDown = (e: ReactPointerEvent) => {
    active.current = true
    setDragging(true)
    startY.current = e.clientY
    offsetRef.current = 0
    setOffset(0)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic pointers */
    }
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!active.current) return
    const dy = Math.max(0, e.clientY - startY.current)
    offsetRef.current = dy
    setOffset(dy)
  }
  const endDrag = () => {
    if (!active.current) return
    active.current = false
    setDragging(false)
    if (offsetRef.current > CLOSE_THRESHOLD) {
      setExiting(true)
      setTimeout(onClose, EXIT_MS)
    } else {
      offsetRef.current = 0
      setOffset(0)
    }
  }

  const panelStyle: CSSProperties = exiting
    ? { transform: 'translateY(100%)', transition: `transform ${EXIT_MS}ms ease` }
    : dragging
      ? { transform: `translateY(${offset}px)`, transition: 'none' }
      : offset > 0
        ? { transform: 'translateY(0)', transition: 'transform 0.25s ease' }
        : {}

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        style={{
          opacity: exiting ? 0 : Math.max(0, 1 - offset / 320),
          transition: dragging ? 'none' : 'opacity 0.25s ease',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="sheet-panel relative z-10 flex max-h-[92vh] flex-col rounded-t-[2rem] bg-bg shadow-soft"
        style={panelStyle}
      >
        <div
          className="shrink-0 cursor-grab touch-none select-none px-5 pt-3 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-ink-faint" />
          {(title || headerRight) && (
            <div className="mt-3 flex items-center justify-between gap-3 pb-1">
              <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>
              <div
                className="flex items-center gap-2"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {headerRight}
              </div>
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
