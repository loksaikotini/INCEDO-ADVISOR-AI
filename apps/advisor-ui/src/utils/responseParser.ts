/**
 * Dual-channel response parser for the AI Advisor system.
 * The LLM returns responses wrapped in:
 *   <speech_response> ... </speech_response>
 *   <display_response> ... </display_response>
 *
 * Speech → TTS engine only (concise, TTS-safe plain text)
 * Display → UI chat bubble (rich markdown)
 */

/**
 * Extracts only the content inside <speech_response> tags.
 * Works with partial (streaming) and complete responses.
 * Returns empty string if the tag hasn't appeared yet.
 */
export function extractSpeechResponse(text: string): string {
  if (!text) return '';
  const start = text.indexOf('<speech_response>');
  if (start === -1) {
    if (text.includes('<display_response>')) return '';
    return text;
  }

  const contentStart = start + '<speech_response>'.length;
  const end = text.indexOf('</speech_response>', contentStart);

  return end === -1
    ? text.slice(contentStart)
    : text.slice(contentStart, end);
}

export function extractDisplayResponse(text: string): string {
  if (!text) return '';
  const start = text.indexOf('<display_response>');
  if (start === -1) {
    if (text.includes('<speech_response>')) return '';
    return text;
  }

  const contentStart = start + '<display_response>'.length;
  const end = text.indexOf('</display_response>', contentStart);

  return end === -1
    ? text.slice(contentStart)
    : text.slice(contentStart, end);
}
