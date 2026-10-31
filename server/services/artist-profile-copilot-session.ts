import { randomUUID } from 'node:crypto';
import type { CopilotRuntime, CopilotStreamEvent, CopilotUiCommand, CopilotUiResult } from '../../shared/artist-profile-copilot';

type Pending = { resolve: (result: CopilotUiResult) => void; timer: ReturnType<typeof setTimeout> };
const sessions = new Map<string, ProfileCopilotSession>();

/** One authenticated browser connection owns a short-lived UI control session. */
export class ProfileCopilotSession implements CopilotRuntime {
  readonly id = randomUUID();
  private controller = new AbortController();
  readonly signal = this.controller.signal;
  private pending = new Map<string, Pending>();
  private expiry: ReturnType<typeof setTimeout>;

  constructor(readonly artistId: number, readonly ownerId: string, private emit: (event: CopilotStreamEvent) => void) {
    if (sessions.size >= 100) throw new Error('Too many active Copilot sessions. Please retry shortly.');
    sessions.set(this.id, this);
    this.expiry = setTimeout(() => this.close(), 5 * 60_000);
  }

  progress = (message: string, target?: string) => {
    if (!this.signal.aborted) this.emit({ type: 'progress', message, target });
  };

  requestUi = async (command: CopilotUiCommand): Promise<CopilotUiResult> => {
    if (this.signal.aborted) throw new Error('The artist disconnected. No further changes can be applied.');
    // UI commands are serialized even when the model issues parallel tool calls.
    const previous = this.serial;
    let release!: () => void;
    this.serial = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      if (this.signal.aborted) throw new Error('The artist disconnected.');
      const requestId = randomUUID();
      return await new Promise<CopilotUiResult>((resolve) => {
        const timer = setTimeout(() => {
          this.pending.delete(requestId);
          resolve({ success: false, error: 'The profile interface did not respond. No action was confirmed.' });
        }, 25_000);
        this.pending.set(requestId, { resolve, timer });
        this.emit({ type: 'ui_command', requestId, command });
      });
    } finally { release(); }
  };
  private serial = Promise.resolve();

  accept(requestId: string, result: CopilotUiResult): boolean {
    const pending = this.pending.get(requestId);
    if (!pending || this.signal.aborted) return false;
    clearTimeout(pending.timer);
    this.pending.delete(requestId);
    pending.resolve(result);
    return true;
  }

  close() {
    if (this.signal.aborted) return;
    this.controller.abort();
    clearTimeout(this.expiry);
    sessions.delete(this.id);
    for (const pending of Array.from(this.pending.values())) {
      clearTimeout(pending.timer);
      pending.resolve({ success: false, error: 'The profile interface disconnected.' });
    }
    this.pending.clear();
  }
}

export function findProfileCopilotSession(id: string, artistId: number, ownerId: string) {
  const session = sessions.get(id);
  return session?.artistId === artistId && session.ownerId === ownerId ? session : undefined;
}
