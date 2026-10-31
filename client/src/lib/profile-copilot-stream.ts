import type { CopilotStreamEvent } from '../../../shared/artist-profile-copilot';

/** Incremental NDJSON decoding preserves UTF-8 and messages split across chunks. */
export async function* readProfileCopilotEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<CopilotStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) yield JSON.parse(line) as CopilotStreamEvent;
      }
      if (buffer.length > 500_000) throw new Error('The Copilot returned an oversized interface event.');
      if (done) break;
    }
    if (buffer.trim()) yield JSON.parse(buffer) as CopilotStreamEvent;
  } finally { reader.releaseLock(); }
}
