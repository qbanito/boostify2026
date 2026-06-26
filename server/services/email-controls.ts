/**
 * Email Controls — global + per-channel kill switch for automated sending
 * ════════════════════════════════════════════════════════════════════════
 * A single source of truth (DB row `email_command_settings.controls`) that the
 * platform outreach sender AND the GitHub-Actions smart router consult before
 * sending. Lets the admin pause ALL automated email (or a single channel)
 * instantly from the Email Command Center — no deploy, no env edit.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

export interface EmailControls {
  global: boolean;                      // true = pause everything
  channels: Record<string, boolean>;    // channel -> paused?
  updatedAt?: string;
}

const DEFAULT_CONTROLS: EmailControls = { global: false, channels: {} };

let cache: { value: EmailControls; at: number } | null = null;
const TTL_MS = 15_000;

export async function ensureControlsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS email_command_settings (
      key        TEXT PRIMARY KEY,
      value      JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function getEmailControls(force = false): Promise<EmailControls> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    await ensureControlsTable();
    const res: any = await db.execute(sql`SELECT value FROM email_command_settings WHERE key = 'controls' LIMIT 1`);
    const row = (res.rows || res)[0];
    const value: EmailControls = row?.value
      ? { global: !!row.value.global, channels: row.value.channels || {}, updatedAt: row.value.updatedAt }
      : { ...DEFAULT_CONTROLS };
    cache = { value, at: Date.now() };
    return value;
  } catch {
    // On any DB issue, do NOT block sending — fail open.
    return { ...DEFAULT_CONTROLS };
  }
}

export async function setEmailControls(next: Partial<EmailControls>): Promise<EmailControls> {
  await ensureControlsTable();
  const current = await getEmailControls(true);
  const merged: EmailControls = {
    global: next.global ?? current.global,
    channels: { ...current.channels, ...(next.channels || {}) },
    updatedAt: new Date().toISOString(),
  };
  await db.execute(sql`
    INSERT INTO email_command_settings (key, value, updated_at)
    VALUES ('controls', ${JSON.stringify(merged)}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `);
  cache = { value: merged, at: Date.now() };
  return merged;
}

/** True when sending is paused globally, or for the given channel. */
export async function isSendingPaused(channel?: string): Promise<boolean> {
  const c = await getEmailControls();
  if (c.global) return true;
  if (channel && c.channels[channel]) return true;
  return false;
}
