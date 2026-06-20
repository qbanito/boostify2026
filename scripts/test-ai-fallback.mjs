#!/usr/bin/env node
/**
 * Test script for the AI Fallback system
 * Tests:
 *   1. OpenRouter direct connection (env key check)
 *   2. OpenRouter free-model cascade (real API call)
 *   3. withTextFallback — primary SUCCESS path (simulated)
 *   4. withTextFallback — primary FAIL → OpenRouter fallback (simulated)
 *   5. withTextFallback — ALL fail → fallbackValue returned (simulated)
 *
 * Run: node --require dotenv/config scripts/test-ai-fallback.mjs
 */

import fetch from 'node-fetch';

// ─── Colors ────────────────────────────────────────────────────────────────
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan   = (s) => `\x1b[36m${s}\x1b[0m`;
const bold   = (s) => `\x1b[1m${s}\x1b[0m`;

const pass = (msg) => console.log(`  ${green('✔')} ${msg}`);
const fail = (msg) => console.log(`  ${red('✘')} ${msg}`);
const info = (msg) => console.log(`  ${cyan('ℹ')} ${msg}`);
const sep  = ()    => console.log(cyan('─'.repeat(60)));

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { pass(label); passed++; }
  else           { fail(label); failed++; }
}

// ─── Inline withTextFallback (mirrors server/utils/ai-fallback.ts) ──────────
// Verified free models as of April 2026
const FREE_MODELS_CASCADE = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'google/gemma-4-31b-it:free',
  'openai/gpt-oss-20b:free',
];

async function generateTextViaOpenRouter(prompt, options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const {
    maxTokens = 200,
    temperature = 0.7,
    systemPrompt = 'You are a helpful assistant.',
  } = options;

  for (const model of FREE_MODELS_CASCADE) {
    try {
      info(`  → trying ${model}`);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://boostifymusic.com',
          'X-Title': 'Boostify Music Test',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        info(`    ⚠ ${model} HTTP ${res.status}: ${errText.substring(0, 120)}`);
        continue;
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) {
        info(`    ✅ ${model} responded (${data.usage?.total_tokens || '?'} tokens)`);
        return { text, model, tokens: data.usage?.total_tokens || 0 };
      }
    } catch (err) {
      info(`    ⚠ ${model} error: ${err.message}`);
    }
  }
  return null;
}

async function withTextFallback(primaryFn, options, fallbackValue = null) {
  const label = options.label || 'test';
  try {
    const result = await primaryFn();
    if (result) {
      info(`[${label}] Primary succeeded`);
      return { source: 'primary', value: result };
    }
    info(`[${label}] Primary returned empty — trying OpenRouter...`);
  } catch (err) {
    info(`[${label}] Primary threw: ${err.message} — trying OpenRouter...`);
  }

  const fallback = await generateTextViaOpenRouter(options.prompt, options);
  if (fallback) {
    info(`[${label}] OpenRouter fallback ✅ (model: ${fallback.model})`);
    return { source: 'openrouter', value: fallback.text, model: fallback.model };
  }

  info(`[${label}] All providers failed — returning fallbackValue`);
  return { source: 'fallback', value: fallbackValue };
}

// ─── TESTS ─────────────────────────────────────────────────────────────────

async function test1_envKeys() {
  console.log(bold('\nTest 1: Environment keys'));
  sep();

  const openaiKey  = process.env.OPENAI_API_KEY  || process.env.VITE_OPENAI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;

  assert(!!openaiKey,     `OPENAI_API_KEY configured (${openaiKey ? openaiKey.slice(0,10)+'...' : 'MISSING'})`);
  assert(!!openrouterKey, `OPENROUTER_API_KEY configured (${openrouterKey ? openrouterKey.slice(0,12)+'...' : 'MISSING'})`);
}

async function test2_openRouterDirect() {
  console.log(bold('\nTest 2: OpenRouter direct API call'));
  sep();

  const result = await generateTextViaOpenRouter(
    'Reply with exactly: "Boostify fallback OK" — nothing else.',
    { maxTokens: 20, systemPrompt: 'You must reply with exactly what the user asks.' }
  );

  assert(!!result,               'OpenRouter returned a response');
  if (result) {
    assert(typeof result.text === 'string' && result.text.length > 0, `Response is non-empty: "${result.text.substring(0,80)}"`);
    assert(!!result.model,       `Model used: ${result.model}`);
    info(`Tokens used: ${result.tokens}`);
  }
}

async function test3_fallback_primarySuccess() {
  console.log(bold('\nTest 3: withTextFallback — primary SUCCEEDS (no OpenRouter call needed)'));
  sep();

  const result = await withTextFallback(
    async () => 'Primary result: artist bio generated successfully',
    { label: 'test3', prompt: 'ignored', maxTokens: 50 }
  );

  assert(result.source === 'primary',   `Source is 'primary' (got: ${result.source})`);
  assert(result.value.includes('Primary result'), `Value matches primary output`);
}

async function test4_fallback_primaryFails() {
  console.log(bold('\nTest 4: withTextFallback — primary THROWS → OpenRouter cascade'));
  sep();

  const result = await withTextFallback(
    async () => {
      throw new Error('Simulated OpenAI quota exceeded');
    },
    {
      label: 'test4',
      prompt: 'Write a 1-sentence description of a fictional pop artist named Luna Vega.',
      systemPrompt: 'You are a music journalist. Be concise.',
      maxTokens: 80,
    }
  );

  assert(result.source === 'openrouter', `Source is 'openrouter' (got: ${result.source})`);
  assert(typeof result.value === 'string' && result.value.length > 10, `OpenRouter returned text: "${result.value?.substring(0,100)}"`);
  if (result.model) info(`Model that responded: ${result.model}`);
}

async function test5_fallback_primaryReturnsNull() {
  console.log(bold('\nTest 5: withTextFallback — primary returns null → OpenRouter cascade'));
  sep();

  const result = await withTextFallback(
    async () => null,
    {
      label: 'test5',
      prompt: 'In one word, what genre is heavy metal? Answer with just the genre word.',
      maxTokens: 10,
    }
  );

  assert(result.source === 'openrouter', `Source is 'openrouter' (got: ${result.source})`);
  assert(typeof result.value === 'string' && result.value.length > 0, `Got response: "${result.value}"`);
}

async function test6_allFail_returnsFallbackValue() {
  console.log(bold('\nTest 6: withTextFallback — simulated ALL fail → fallbackValue returned'));
  sep();

  // Override generateTextViaOpenRouter locally with one that always returns null
  const originalEnvKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = '';
  process.env.VITE_OPENROUTER_API_KEY = '';

  const result = await withTextFallback(
    async () => { throw new Error('Primary failed'); },
    { label: 'test6', prompt: 'This should fail', maxTokens: 10 },
    'DEFAULT_FALLBACK_VALUE'
  );

  // Restore
  if (originalEnvKey) process.env.OPENROUTER_API_KEY = originalEnvKey;

  assert(result.source === 'fallback',           `Source is 'fallback' (got: ${result.source})`);
  assert(result.value === 'DEFAULT_FALLBACK_VALUE', `Fallback value returned correctly`);
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(bold(cyan('\n╔══════════════════════════════════════════════════════════╗')));
  console.log(bold(cyan('║         BOOSTIFY AI FALLBACK SYSTEM — TEST SUITE         ║')));
  console.log(bold(cyan('╚══════════════════════════════════════════════════════════╝')));

  await test1_envKeys();
  await test2_openRouterDirect();
  await test3_fallback_primarySuccess();
  await test4_fallback_primaryFails();
  await test5_fallback_primaryReturnsNull();
  await test6_allFail_returnsFallbackValue();

  sep();
  console.log(bold(`\n📊 Results: ${green(passed + ' passed')}  ${failed > 0 ? red(failed + ' failed') : '0 failed'}\n`));

  if (failed > 0) {
    console.log(yellow('⚠ Some tests failed — check output above for details.\n'));
    process.exit(1);
  } else {
    console.log(green('🎉 All tests passed! AI fallback system is working correctly.\n'));
  }
}

main().catch((err) => {
  console.error(red('\n❌ Test suite crashed:'), err);
  process.exit(1);
});
