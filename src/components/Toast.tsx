import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

interface ToastItem {
  id: number
  message: string
}

const ToastCtx = createContext<(message: string) => void>(() => {})

export function useToast() {
  return useContext(ToastCtx)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)

  const push = useCallback((message: string) => {
    const id = ++seq.current
    setItems((cur) => [...cur, { id, message }])
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 2200)
  }, [])

  const value = useMemo(() => push, [push])

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[80] flex flex-col items-center gap-2 px-4">
          {items.map((t) => (
            <div
              key={t.id}
              className="animate-pop-in rounded-full bg-surface-2 px-4 py-2 text-sm font-bold text-ink shadow-soft"
            >
              {t.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}
