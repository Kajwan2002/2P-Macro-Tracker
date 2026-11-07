import { useState } from 'react'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import {
  DEFAULT_MODEL,
  getGeminiKey,
  getGeminiModel,
  setGeminiKey,
  setGeminiModel,
} from '@/lib/gemini'

interface GeminiKeySheetProps {
  open: boolean
  onClose: () => void
  /** called after save/remove with whether a key is now stored */
  onChanged: (hasKey: boolean) => void
}

export function GeminiKeySheet({ open, onClose, onChanged }: GeminiKeySheetProps) {
  const [key, setKey] = useState(getGeminiKey)
  const [model, setModel] = useState(getGeminiModel)

  function save() {
    setGeminiKey(key)
    setGeminiModel(model === DEFAULT_MODEL ? '' : model)
    onChanged(!!key.trim())
    onClose()
  }

  function remove() {
    setGeminiKey('')
    setKey('')
    onChanged(false)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Assistant settings">
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-ink-soft">
          Get a free key at{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="font-bold text-accent underline"
          >
            aistudio.google.com/apikey
          </a>{' '}
          and paste it here. It is stored only on this device and is never included in backups.
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] font-bold text-ink-soft">Gemini API key</span>
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="AIza…"
            className="rounded-2xl bg-surface-2 px-3 py-2.5 font-bold text-ink outline-none placeholder:text-ink-faint"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] font-bold text-ink-soft">Model</span>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-2xl bg-surface-2 px-3 py-2.5 font-bold text-ink outline-none"
          />
          <span className="px-1 text-xs text-ink-faint">
            Default is a small, free-tier model. Change it if Google renames or retires it.
          </span>
        </label>

        <p className="rounded-2xl bg-surface px-4 py-3 text-xs leading-relaxed text-ink-faint">
          Privacy: your questions, today’s macros, your ingredient list, any photo you attach
          and any voice clip are sent to Google. On the free tier Google may use them to improve its
          products. Photos and voice clips are never saved in this app — they’re gone as soon as
          they’re sent.
        </p>

        <Button full onClick={save} disabled={!key.trim()}>
          Save
        </Button>
        {getGeminiKey() && (
          <Button full variant="danger" onClick={remove}>
            Remove key from this device
          </Button>
        )}
      </div>
    </Sheet>
  )
}
