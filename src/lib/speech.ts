// Read-aloud via the browser's built-in speech engine: free, works offline,
// and nothing is sent anywhere.

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

/** Drop the ✅ action lines and any emoji so the voice doesn't read them out. */
function cleanForSpeech(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('✅'))
    .join('\n')
    .replace(/[\p{Extended_Pictographic}️]/gu, '')
    .replace(/[“”]/g, '"')
    .trim()
}

export function stopSpeaking() {
  if (canSpeak) window.speechSynthesis.cancel()
}

/** Speak `text`; `onEnd` fires when it finishes or is stopped. */
export function speak(text: string, onEnd: () => void) {
  const clean = cleanForSpeech(text)
  if (!canSpeak || !clean) {
    onEnd()
    return
  }
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(clean)
  u.lang = navigator.language || 'en-US'
  u.onend = onEnd
  u.onerror = onEnd
  window.speechSynthesis.speak(u)
}
