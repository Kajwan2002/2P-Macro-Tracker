// Tiny Gemini client. The app has no backend, so the browser calls the API
// directly with the user's own (free) key, which lives only in this device's
// localStorage — never in the database, so it can't end up in a backup file.

const KEY_STORAGE = 'macro-tracker.gemini-key'
const MODEL_STORAGE = 'macro-tracker.gemini-model'

/** Cheapest current model with a free tier. Editable in the chat settings. */
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite'

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

export interface FunctionDeclaration {
  name: string
  description: string
  parameters: {
    type: 'OBJECT'
    properties: Record<string, { type: 'STRING' | 'NUMBER'; description: string }>
    required: string[]
  }
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
    if (err.status === 400 && /api key/i.test(err.message)) return 'Gemini rejected the API key. Check it in the ⚙ settings.'
    if (err.status === 403) return 'The API key isn’t allowed to use this model. Check the key and model in ⚙.'
    if (err.status === 404) return 'That model name wasn’t found. Change the model in ⚙.'
    if (err.status === 429) return 'Free-tier limit reached — wait a minute and try again.'
    return `Gemini error (${err.status}): ${err.message}`
  }
  return 'Couldn’t reach Gemini. Are you online?'
}

/* ---------------------------------- call ---------------------------------- */

interface AskOptions {
  system: string
  history: Content[]
  text: string
  image?: ChatImage | null
  tools: FunctionDeclaration[]
  runTool: (name: string, args: Record<string, unknown>) => Promise<ToolResult>
}

const MAX_TOOL_ROUNDS = 5

/** Send one user turn; runs any tool calls the model makes; returns the final reply. */
export async function askGemini(opts: AskOptions): Promise<string> {
  const key = getGeminiKey()
  if (!key) throw new GeminiError('No API key', 400)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(getGeminiModel())}:generateContent`

  const userParts: Part[] = [{ text: opts.text || 'Here is a photo.' }]
  if (opts.image) userParts.push({ inlineData: { mimeType: opts.image.mimeType, data: opts.image.data } })
  const contents: Content[] = [...opts.history, { role: 'user', parts: userParts }]
  const notes: string[] = []

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents,
        tools: [{ functionDeclarations: opts.tools }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 800 },
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new GeminiError(json?.error?.message ?? res.statusText, res.status)

    const content: Content | undefined = json?.candidates?.[0]?.content
    const parts: Part[] = content?.parts ?? []
    const calls = parts.filter((p) => p.functionCall) as { functionCall: { name: string; args?: Record<string, unknown> } }[]

    if (calls.length === 0) {
      const text = parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('').trim()
      return [text, ...notes].filter(Boolean).join('\n\n') || 'Hmm, I got an empty answer — try rephrasing?'
    }

    // keep the model's turn exactly as returned, then answer each call
    contents.push({ role: 'model', parts })
    const responses: Part[] = []
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
