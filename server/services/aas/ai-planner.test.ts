import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeDecision } from './ai-planner';
import type { PlannedAction } from './types';

const candidates: PlannedAction[] = [
  { action: 'Review pipeline', agent: 'deal-closer', channel: 'internal', budgetAllocated: 0, priority: 1, expectedOutcome: 'Review' },
  { action: 'Create image', agent: 'growth-operator', channel: 'internal', budgetAllocated: 2, priority: 2, expectedOutcome: 'Image' },
];
const decision = { priorityMode: 'launch', objectives: ['Prepare release'], reasoning: 'Focus on existing material.', actionIds: [1, 0] };

test('materializes only original actions in model order', () => {
  const plan = materializeDecision(decision, candidates, 2);
  assert.deepEqual(plan.actions, [candidates[1], candidates[0]]);
});
test('rejects unknown, duplicate and over-budget actions', () => {
  assert.throws(() => materializeDecision({ ...decision, actionIds: [8] }, candidates, 5));
  assert.throws(() => materializeDecision({ ...decision, actionIds: [0, 0] }, candidates, 5));
  assert.throws(() => materializeDecision(decision, candidates, 1));
  assert.throws(() => materializeDecision({ ...decision, actionIds: [-1] }, candidates, 5));
});
test('rejects malformed model output', () => {
  assert.throws(() => materializeDecision({ ...decision, priorityMode: 'unknown' }, candidates, 5));
  assert.throws(() => materializeDecision({ ...decision, invented: true }, candidates, 5));
  assert.throws(() => materializeDecision(decision, candidates, NaN));
});
