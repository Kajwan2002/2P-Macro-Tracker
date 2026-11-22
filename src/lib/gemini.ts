// Tiny Gemini client. The app has no backend, so the browser calls the API
// directly with the user's own (free) key, which lives only in this device's
// localStorage — never in the database, so it can't end up in a backup file.

const KEY_STORAGE = 'macro-tracker.gemini-key'
const MODEL_STORAGE = 'macro-tracker.gemini-model'

/**
 * Stable "flash" model with a free tier. The cheaper flash-lite models were too
 * weak at using tools reliably (claimed actions it never ran, mixed up
 * profiles). Editable in the chat settings.
 */
export const DEFAULT_MODEL = 'gemini-3.6-flash'

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}
function write(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    /* storage blocked — the key just won't persist */
  }
}

export const getGeminiKey = () => read(KEY_STORAGE)
export const setGeminiKey = (key: string) => write(KEY_STORAGE, key.trim())
export const getGeminiModel = () => read(MODEL_STORAGE) || DEFAULT_MODEL
export const setGeminiModel = (model: string) => write(MODEL_STORAGE, model.trim())

/* -------------------------------- wire types ------------------------------ */

type Part = Record<string, unknown>
export interface Content {
  role: 'user' | 'model'
  parts: Part[]
}

export interface Schema {
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT'
  description?: string
  enum?: string[]
  items?: Schema
  properties?: Record<string, Schema>
  required?: string[]
}

export interface FunctionDeclaration {
  name: string
  description: string
  parameters: Schema & { type: 'OBJECT'; properties: Record<string, Schema> }
}

export interface ToolResult {
  /** sent back to the model */
  response: Record<string, unknown>
  /** one-line note shown to the user, e.g. "✅ Added Chicken breast" */
  summary?: string
}

export interface ChatImage {
  mimeType: string
  /** base64, no data: prefix */
  data: string
}

export class GeminiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function friendlyError(err: unknown): string {
  if (err instanceof GeminiError) {
    if (err.status === 408) return 'Gemini took too long to answer. Try again — a shorter question or a smaller photo helps.'
    if (err.status === 400 && /api key/i.test(err.message)) return 'Gemini rejected the API key. Check it in the ⚙ settings.'
    if (err.status === 403) return 'The API key isn’t allowed to use this model. Check the key and model in ⚙.'
    if (err.status === 404) return 'That model name wasn’t found. Change the model in ⚙.'
    if (err.status === 429) return 'Free-tier limit reached — wait a minute and try again.'
    if (err.status === 503 || err.status === 500 || err.status === 502 || err.status === 504) {
      return 'Google’s Gemini servers are overloaded right now (every model I tried was busy). It’s temporary — try again in a minute or two.'
    }
    return `Gemini error (${err.status}): ${err.message}`
  }
  // fetch reports a lost connection as a TypeError ("Load failed" on iPhone)
  if (err instanceof TypeError || !(err instanceof Error)) return 'Couldn’t reach Gemini. Are you online?'
  return `Something went wrong: ${err.message}`
}

/* ---------------------------------- call ---------------------------------- */

interface AskOptions {
  system: string
  history: Content[]
  text: string
  image?: ChatImage | null
  tools: FunctionDeclaration[]
  runTool: (name: string, args: Record<string, unknown>) => Promise<ToolResult>
  /** aborts the whole turn (the Stop button) */
  signal?: AbortSignal
  /** progress for the Thinking bubble, e.g. "Asking gemini-3.6-flash…" */
  onStatus?: (status: string) => void
}

const MAX_TOOL_ROUNDS = 6

/**
 * Does this reply say something was changed? Used to catch the model claiming
 * "done" when it never actually called a tool.
 */
const CLAIMS_ACTION =
  /✅|\b(?:i(?:'ve|’ve| have)?|we(?:'ve|’ve| have)?)\s+(?:just\s+|now\s+|successfully\s+)?(?:deleted|removed|logged|added|saved|updated|changed|created|recorded|marked|split|edited|set)\b|\b(?:has|have|was|were)\s+(?:been\s+)?(?:deleted|removed|logged|added|saved|updated|created|recorded|marked|edited)\b|\ball done\b|^\s*(?:ok(?:ay)?|sure|done|got it|will do|no problem)[.! ]*$/i

const NO_ACTION_NUDGE =
  'You replied without calling any tool, so nothing in the app has changed. If I asked for a change, call the right tool now (set the profile argument explicitly). If I did not ask for a change, answer without claiming anything was done.'

function endpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
}

/** Tried in this order after the model chosen in settings, if Google says it is busy or gone. */
const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']

/** Timed out / busy / overloaded / rate-limited / not found: worth trying another model or waiting a moment. */
const TRY_NEXT = new Set([404, 408, 429, 500, 502, 503, 504])

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One request may not hang longer than this (a stalled phone connection never ends on its own). */
const REQUEST_TIMEOUT_MS = 45_000
/** A whole turn (tool rounds and model fallbacks included) gives up after this. */
const TURN_TIMEOUT_MS = 120_000

/** fetch with a time limit; also stops when `outer` (the Stop button) aborts. */
async function fetchWithTimeout(url: string, init: RequestInit, outer?: AbortSignal): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new GeminiError('Timed out', 408)), REQUEST_TIMEOUT_MS)
  const onOuter = () => ctrl.abort(outer?.reason)
  outer?.addEventListener('abort', onOuter)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } catch (err) {
    if (outer?.aborted) throw outer.reason ?? err
    if (ctrl.signal.aborted) throw new GeminiError('Timed out', 408)
    throw err
  } finally {
    clearTimeout(timer)
    outer?.removeEventListener('abort', onOuter)
  }
}

/** The chosen model first, then the others (no duplicates). */
function modelChain(): string[] {
  const first = getGeminiModel()
  return [first, ...FALLBACK_MODELS.filter((m) => m !== first)]
}

/**
 * POST to Gemini. If a model answers "high demand" (503) and friends, move on to
 * the next model in `chain`, and make a second pass after a short pause before
 * giving up. Any other error (bad key, bad request…) is thrown straight away.
 */
async function generate(
  body: unknown,
  chain: string[],
  signal?: AbortSignal,
  deadline = Date.now() + TURN_TIMEOUT_MS,
  onStatus?: (status: string) => void,
): Promise<{ json: Record<string, unknown>; model: string }> {
  const key = getGeminiKey()
  if (!key) throw new GeminiError('No API key', 400)
  let last: GeminiError | null = null
  for (let pass = 0; pass < 2; pass++) {
    if (pass > 0) await sleep(2500)
    for (const model of chain) {
      if (Date.now() > deadline) throw new GeminiError('Timed out', 408)
      onStatus?.(`Asking ${model}…`)
      let res: Response
      try {
        res = await fetchWithTimeout(
          endpoint(model),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify(body),
          },
          signal,
        )
      } catch (err) {
        // a stalled request: try the next model; anything else (offline, Stop) ends the turn
        if (err instanceof GeminiError && err.status === 408) {
          last = err
          continue
        }
        throw err
      }
      const json = await res.json().catch(() => ({}))
      if (res.ok) return { json, model }
      last = new GeminiError(json?.error?.message ?? res.statusText, res.status)
      if (!TRY_NEXT.has(res.status)) throw last
    }
  }
  throw last ?? new GeminiError('No response', 503)
}

/** Turn a short voice clip (WAV, base64) into text. The clip is never stored. */
export async function transcribeAudio(wavBase64: string): Promise<string> {
  const { json } = await generate(
    {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Transcribe this short voice message exactly as spoken. Output only the transcript — no quotes, no commentary. If there is no clear speech, output nothing.',
            },
            { inlineData: { mimeType: 'audio/wav', data: wavBase64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 400 },
    },
    modelChain(),
  )
  const parts: Part[] = (json as { candidates?: { content?: { parts?: Part[] } }[] })?.candidates?.[0]?.content?.parts ?? []
  return parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('').trim()
}

/** Send one user turn; runs any tool calls the model makes; returns the final reply. */
export async function askGemini(opts: AskOptions): Promise<string> {
  if (!getGeminiKey()) throw new GeminiError('No API key', 400)
  const deadline = Date.now() + TURN_TIMEOUT_MS
  // Once a model has answered, stay on it for the rest of this turn: its tool-call
  // parts (with their internal signatures) are echoed back to the same model.
  let usedModel: string | null = null

  const userParts: Part[] = [{ text: opts.text || 'Here is a photo.' }]
  if (opts.image) userParts.push({ inlineData: { mimeType: opts.image.mimeType, data: opts.image.data } })
  // turns must alternate: if the last message never got an answer, join this one to it
  const contents: Content[] = opts.history.map((c) => ({ ...c, parts: [...c.parts] }))
  const last = contents[contents.length - 1]
  if (last?.role === 'user') last.parts.push(...userParts)
  else contents.push({ role: 'user', parts: userParts })
  const notes: string[] = []
  let nudged = false

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const { json: raw, model } = await generate(
      {
        systemInstruction: { parts: [{ text: opts.system }] },
        contents,
        tools: [{ functionDeclarations: opts.tools }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      },
      usedModel ? [usedModel] : modelChain(),
      opts.signal,
      deadline,
      opts.onStatus,
    )
    usedModel = model
    const json = raw as { candidates?: { content?: Content }[] }

    const content: Content | undefined = json?.candidates?.[0]?.content
    const parts: Part[] = content?.parts ?? []
    const calls = parts.filter((p) => p.functionCall) as { functionCall: { name: string; args?: Record<string, unknown> } }[]

    if (calls.length === 0) {
      const text = parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('').trim()

      // The model says it did something, but no tool ran: don't believe it.
      if (notes.length === 0 && CLAIMS_ACTION.test(text)) {
        if (!nudged) {
          nudged = true
          contents.push({ role: 'model', parts: [{ text }] }, { role: 'user', parts: [{ text: NO_ACTION_NUDGE }] })
          continue
        }
        return '⚠️ I said I did it, but nothing was actually changed in the app. Please try again — naming the item (and who it’s for) helps.'
      }

      return [text, ...notes].filter(Boolean).join('\n\n') || 'Hmm, I got an empty answer — try rephrasing?'
    }

    // keep the model's turn exactly as returned, then answer each call
    contents.push({ role: 'model', parts })
    const responses: Part[] = []
    opts.onStatus?.('Updating the app…')
    for (const { functionCall } of calls) {
      let result: ToolResult
      try {
        result = await opts.runTool(functionCall.name, functionCall.args ?? {})
      } catch (err) {
        result = { response: { ok: false, error: (err as Error).message } }
      }
      if (result.summary) notes.push(result.summary)
      responses.push({ functionResponse: { name: functionCall.name, response: result.response } })
    }
    contents.push({ role: 'user', parts: responses })
  }
  return [...notes, 'I got stuck in a loop — try asking again.'].join('\n\n')
}

/* ---------------------------------- image --------------------------------- */

/**
 * Shrink a photo before sending. Re-drawing it on a canvas also drops EXIF
 * (location etc.). The result lives in memory only — nothing is saved.
 */
export async function prepareImage(file: File, maxSide = 1024): Promise<ChatImage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
  return { mimeType: 'image/jpeg', data: dataUrl.split(',')[1] }
}
