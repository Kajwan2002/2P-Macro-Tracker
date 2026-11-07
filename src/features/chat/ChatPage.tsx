import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Screen } from '@/components/Screen'
import { useToast } from '@/components/Toast'
import { useChat } from '@/db/queries'
import { addChatMessage, clearChat } from '@/db/repo'
import type { ChatMessage } from '@/db/types'
import { cn } from '@/lib/cn'
import {
  askGemini,
  transcribeAudio,
  friendlyError,
  getGeminiKey,
  prepareImage,
  type ChatImage,
  type Content,
} from '@/lib/gemini'
import { blobToBase64, canRecord, startRecording, type Recording } from '@/lib/recorder'
import { canSpeak, speak, stopSpeaking } from '@/lib/speech'
import { buildSystemPrompt, buildTools, runTool } from './assistant'
import { GeminiKeySheet } from './GeminiKeySheet'

const HISTORY_LIMIT = 20

const SUGGESTIONS = [
  'What could I eat with the calories and protein I have left?',
  'Add chicken thigh, raw to my ingredients',
]

/**
 * Drop the app's "✅ …" confirmation lines from what the model sees of its own
 * past replies. Otherwise it learns to imitate them and write "✅ Deleted"
 * itself without ever calling a tool.
 */
function withoutConfirmations(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('✅'))
    .join('\n')
    .trim()
}

function toHistory(messages: ChatMessage[]): Content[] {
  const turns: Content[] = messages.slice(-HISTORY_LIMIT).map((m) => ({
    role: m.role,
    parts: [
      {
        text:
          (m.hadImage ? '[sent a photo] ' : '') +
          ((m.role === 'model' ? withoutConfirmations(m.text) : m.text) || '…'),
      },
    ],
  }))
  while (turns.length && turns[0].role === 'model') turns.shift()
  return turns
}

export function ChatPage() {
  const toast = useToast()
  const messages = useChat()
  const [hasKey, setHasKey] = useState(() => !!getGeminiKey())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [input, setInput] = useState('')
  const [image, setImage] = useState<(ChatImage & { preview: string }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [mic, setMic] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const recRef = useRef<Recording | null>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // stop talking / release the mic when leaving the page
  useEffect(
    () => () => {
      stopSpeaking()
      window.clearTimeout(timerRef.current)
      recRef.current?.cancel()
    },
    [],
  )

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages?.length, busy, error])

  async function toggleMic() {
    if (mic === 'transcribing') return
    if (mic === 'recording') {
      window.clearTimeout(timerRef.current)
      const rec = recRef.current
      recRef.current = null
      if (!rec) return
      setMic('transcribing')
      try {
        const text = await transcribeAudio(await blobToBase64(await rec.stop()))
        if (text) setInput((cur) => (cur ? cur + ' ' : '') + text)
        else toast('Didn’t catch that — try again')
      } catch (err) {
        setError(friendlyError(err))
      } finally {
        setMic('idle')
      }
      return
    }
    if (!canRecord) {
      toast('This browser can’t record audio')
      return
    }
    try {
      stopSpeaking()
      setSpeakingId(null)
      recRef.current = await startRecording()
      setMic('recording')
      // safety stop so a forgotten recording doesn't run forever
      timerRef.current = window.setTimeout(() => void toggleMic(), 60_000)
    } catch {
      toast('Microphone blocked — allow it in your phone/browser settings')
    }
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return
    try {
      const img = await prepareImage(file)
      setImage({ ...img, preview: `data:${img.mimeType};base64,${img.data}` })
    } catch {
      toast('Couldn’t read that photo')
    }
  }

  async function send(override?: string) {
    const text = (override ?? input).trim()
    if ((!text && !image) || busy) return
    const attached = image
    const prior = messages ?? []
    setInput('')
    setImage(null)
    setError(null)
    setBusy(true)
    await addChatMessage('user', text, !!attached)
    try {
      const reply = await askGemini({
        system: await buildSystemPrompt(),
        history: toHistory(prior),
        text,
        image: attached,
        tools: await buildTools(),
        runTool,
      })
      await addChatMessage('model', reply)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  function toggleSpeak(m: ChatMessage) {
    if (!canSpeak) {
      toast('This browser can’t read aloud')
      return
    }
    if (speakingId === m.id) {
      stopSpeaking()
      setSpeakingId(null)
      return
    }
    setSpeakingId(m.id)
    speak(m.text, () => setSpeakingId((cur) => (cur === m.id ? null : cur)))
  }

  async function doClear() {
    stopSpeaking()
    setSpeakingId(null)
    await clearChat()
    setConfirmClear(false)
    setError(null)
    toast('Chat cleared')
  }

  const header = (
    <div className="flex items-center gap-2">
      <IconButton label="Assistant settings" onClick={() => setSettingsOpen(true)}>
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </IconButton>
      <IconButton
        label="Clear chat"
        onClick={() => setConfirmClear(true)}
        disabled={!messages?.length}
      >
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" />
      </IconButton>
    </div>
  )

  return (
    <Screen title="Assistant" subtitle="Ask Gemini" right={header}>
      {!hasKey ? (
        <div className="rounded-3xl bg-surface p-5 text-center shadow-card">
          <div className="text-3xl">✨</div>
          <p className="mt-2 font-extrabold text-ink">Meet your food assistant</p>
          <p className="mt-1 text-sm text-ink-soft">
            Ask for meal ideas from what you have left, add ingredients by name, or snap a photo to
            log it. Needs a free Gemini API key.
          </p>
          <Button className="mt-4" onClick={() => setSettingsOpen(true)}>
            Add API key
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-2">
            {messages && messages.length === 0 && !busy && (
              <div className="flex flex-col gap-2 pt-2">
                <p className="px-1 text-sm text-ink-faint">Try asking:</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-2xl bg-surface px-4 py-3 text-left text-sm font-semibold text-ink-soft shadow-card active:opacity-80"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages?.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'self-end bg-accent text-bg-deep'
                    : 'self-start bg-surface text-ink shadow-card',
                )}
              >
                {m.hadImage && <div className="mb-0.5 text-xs font-bold opacity-70">📷 Photo</div>}
                {m.text}
                {m.role === 'model' && (
                  <button
                    type="button"
                    onClick={() => toggleSpeak(m)}
                    aria-label={speakingId === m.id ? 'Stop reading' : 'Read aloud'}
                    className={cn(
                      'mt-1.5 flex items-center gap-1 text-xs font-bold active:opacity-70',
                      speakingId === m.id ? 'text-accent' : 'text-ink-faint',
                    )}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 10v4h4l5 4V6l-5 4zM16.5 9a4 4 0 010 6M19 6.5a8 8 0 010 11" />
                    </svg>
                    {speakingId === m.id ? 'Stop' : 'Listen'}
                  </button>
                )}
              </div>
            ))}
            {busy && (
              <div className="self-start rounded-2xl bg-surface px-3.5 py-2.5 text-sm text-ink-faint shadow-card">
                Thinking…
              </div>
            )}
            {error && (
              <div className="self-start rounded-2xl bg-over/15 px-3.5 py-2.5 text-sm font-semibold text-over">
                {error}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="sticky bottom-24 -mx-1 flex flex-col gap-2 bg-bg px-1 pt-2">
            {image && (
              <div className="flex items-center gap-2 self-start rounded-2xl bg-surface p-1.5 pr-3">
                <img src={image.preview} alt="Attached" className="h-12 w-12 rounded-xl object-cover" />
                <span className="text-xs font-bold text-ink-soft">Photo attached</span>
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="text-xs font-bold text-over"
                  aria-label="Remove photo"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  void pickPhoto(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Attach a photo"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft active:scale-95"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => void toggleMic()}
                disabled={mic === 'transcribing'}
                aria-label={mic === 'recording' ? 'Stop recording' : 'Speak'}
                className={cn(
                  'grid h-11 w-11 shrink-0 place-items-center rounded-full active:scale-95',
                  mic === 'recording' ? 'animate-pulse bg-over text-bg-deep' : 'bg-surface-2 text-ink-soft',
                )}
              >
                {mic === 'transcribing' ? (
                  <span className="text-xs font-bold">…</span>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="9" y="3" width="6" height="12" rx="3" />
                    <path d="M5 11a7 7 0 0014 0M12 18v3" />
                  </svg>
                )}
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void send()}
                placeholder={
                  mic === 'recording' ? 'Listening… tap the mic to finish' : mic === 'transcribing' ? 'Transcribing…' : 'Ask or tell me something…'
                }
                className="min-w-0 flex-1 rounded-full bg-surface-2 px-4 py-3 font-semibold text-ink outline-none placeholder:text-ink-faint"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy || (!input.trim() && !image)}
                aria-label="Send"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-bg-deep active:scale-95 disabled:opacity-40"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      {settingsOpen && (
        <GeminiKeySheet
          open
          onClose={() => setSettingsOpen(false)}
          onChanged={setHasKey}
        />
      )}
      <ConfirmDialog
        open={confirmClear}
        title="Clear the whole chat?"
        message="This deletes every message. It can’t be undone."
        confirmLabel="Clear chat"
        danger
        onConfirm={doClear}
        onCancel={() => setConfirmClear(false)}
      />
    </Screen>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full bg-surface text-ink-soft shadow-card active:scale-95 disabled:opacity-40"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  )
}
