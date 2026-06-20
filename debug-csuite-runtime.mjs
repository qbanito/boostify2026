/**
 * Standalone debug — runs the C-Suite runtime directly to see the actual error.
 */
import { config } from 'dotenv';
config();

const { runAgentTurn } = await import('./server/services/c-suite/runtime.ts');

try {
  console.log('[debug] starting runAgentTurn for ceo...');
  const r = await runAgentTurn({
    agentId: 'ceo',
    userMessage: 'ping diagnostic',
    triggeredBy: 'debug-script',
    adminEmail: 'convoycubano@gmail.com',
  });
  console.log('[debug] OK', { threadId: r.threadId, finalText: r.finalText?.slice(0, 200) });
} catch (e) {
  console.error('[debug] FAILED:', {
    name: e?.name,
    message: e?.message,
    code: e?.code,
    status: e?.status,
    stack: e?.stack,
  });
  process.exit(1);
}
process.exit(0);
