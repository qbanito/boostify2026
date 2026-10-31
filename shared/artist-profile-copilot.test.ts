import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { ProfileCopilotSession, findProfileCopilotSession } from '../server/services/artist-profile-copilot-session';
import { readProfileCopilotEvents } from '../client/src/lib/profile-copilot-stream';
import { copilotTextChangesSchema, type CopilotStreamEvent } from './artist-profile-copilot';

test('UI acknowledgements belong to one owner, artist and pending request', async () => {
  const events: CopilotStreamEvent[] = [];
  const session = new ProfileCopilotSession(42, 'owner-a', (event) => events.push(event));
  try {
    assert.equal(findProfileCopilotSession(session.id, 42, 'owner-b'), undefined);
    assert.equal(findProfileCopilotSession(session.id, 43, 'owner-a'), undefined);
    const operation = session.requestUi({ type: 'inspect_interface', moduleId: 'profile' });
    await setImmediate();
    const event = events[0];
    assert.equal(event.type, 'ui_command');
    if (event.type !== 'ui_command') throw new Error('Missing UI command');
    assert.equal(session.accept('invented-id', { success: true }), false);
    assert.equal(session.accept(event.requestId, { success: true, moduleId: 'profile' }), true);
    assert.equal((await operation).success, true);
    assert.equal(session.accept(event.requestId, { success: true }), false);
  } finally { session.close(); }
});

test('parallel model actions execute in order and disconnect stops queued changes', async () => {
  const events: CopilotStreamEvent[] = [];
  const session = new ProfileCopilotSession(42, 'owner', (event) => events.push(event));
  const first = session.requestUi({ type: 'inspect_interface', moduleId: 'profile' });
  const second = session.requestUi({ type: 'preview_profile_text', changes: { biography: 'New biography' } });
  await setImmediate();
  assert.equal(events.length, 1);
  const firstEvent = events[0];
  if (firstEvent.type !== 'ui_command') throw new Error('Missing command');
  session.accept(firstEvent.requestId, { success: true });
  await first;
  await setImmediate();
  assert.equal(events.length, 2);
  session.close();
  assert.equal((await second).success, false);
  assert.equal(session.signal.aborted, true);
  await assert.rejects(() => session.requestUi({ type: 'inspect_interface', moduleId: 'profile' }), /disconnected/);
  assert.equal(findProfileCopilotSession(session.id, 42, 'owner'), undefined);
});

test('stream decoder preserves split UTF-8, split lines and final messages without newline', async () => {
  const expected: CopilotStreamEvent[] = [
    { type: 'progress', message: 'Escribiendo biografía 🎤' },
    { type: 'result', response: 'Guardé la biografía.', actions: [], actionsHandled: true },
  ];
  const bytes = new TextEncoder().encode(expected.map((event) => JSON.stringify(event)).join('\n'));
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    for (let index = 0; index < bytes.length; index += 3) controller.enqueue(bytes.slice(index, index + 3));
    controller.close();
  } });
  const decoded = [];
  for await (const event of readProfileCopilotEvents(body)) decoded.push(event);
  assert.deepEqual(decoded, expected);
});

test('text edits cannot update credentials, money, ownership or unrelated profile fields', () => {
  assert.deepEqual(copilotTextChangesSchema.parse({ biography: ' Updated biography ' }), { biography: 'Updated biography' });
  for (const patch of [{}, { biography: '' }, { biography: 'a'.repeat(12001) }, { biography: 'Valid', generatedBy: 1 }, { email: 'other@example.com' }, { credits: 50000 }, { slug: 'takeover' }, { apiKey: 'credential' }]) {
    assert.equal(copilotTextChangesSchema.safeParse(patch).success, false);
  }
});
