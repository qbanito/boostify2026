/**
 * BOOSTIFY WORKFLOW SCHEDULER
 * Manages server-side cron jobs for ScheduleTrigger nodes.
 * Loaded once on server start; re-registered whenever an artist saves their workflow.
 */

import cron from 'node-cron';
import { db } from '../db';
import { users } from '../db/schema';

interface ScheduleConfig {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  dayOfWeek?: number;   // 0=Sun, 1=Mon … 6=Sat
  dayOfMonth?: number;  // 1-31 for monthly
  time?: string;        // "HH:MM" in 24h
  cronExpr?: string;    // custom cron expression (overrides all above)
  action: string;       // e.g. 'generate-song', 'generate-bio', 'publish-post'
  prompt?: string;
  artistId: number;
  artistSlug: string;
  nodeId: string;
  lastRun?: string | null;
}

// Map of cron task keys → scheduled task
const activeTasks = new Map<string, cron.ScheduledTask>();

function buildCronExpr(config: ScheduleConfig): string {
  if (config.cronExpr) return config.cronExpr;

  const [hh = '9', mm = '0'] = (config.time ?? '09:00').split(':');

  switch (config.frequency) {
    case 'hourly':
      return `${mm} * * * *`;
    case 'daily':
      return `${mm} ${hh} * * *`;
    case 'weekly': {
      const dow = config.dayOfWeek ?? 1;
      return `${mm} ${hh} * * ${dow}`;
    }
    case 'monthly': {
      const dom = config.dayOfMonth ?? 1;
      return `${mm} ${hh} ${dom} * *`;
    }
    default:
      return `${mm} ${hh} * * 1`; // weekly on Monday as fallback
  }
}

async function executeScheduleAction(config: ScheduleConfig) {
  console.log(`[scheduler] ⏰ Firing schedule for artist ${config.artistSlug}, action: ${config.action}, node: ${config.nodeId}`);

  const BASE_URL = process.env.INTERNAL_API_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

  try {
    switch (config.action) {
      case 'generate-song': {
        const resp = await fetch(`${BASE_URL}/api/music/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-scheduler': '1' },
          body: JSON.stringify({
            artistId: config.artistId,
            prompt: config.prompt ?? `Generate a professional song for artist ${config.artistSlug}`,
            autoPublish: true,
          }),
        });
        const data = await resp.json() as any;
        console.log(`[scheduler] generate-song result:`, data?.success ? 'OK' : data?.error);
        break;
      }
      case 'generate-bio': {
        const resp = await fetch(`${BASE_URL}/api/generate/biography`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-scheduler': '1' },
          body: JSON.stringify({ artistId: config.artistId, prompt: config.prompt }),
        });
        const data = await resp.json() as any;
        console.log(`[scheduler] generate-bio result:`, data?.success ? 'OK' : data?.error);
        break;
      }
      case 'publish-post': {
        const resp = await fetch(`${BASE_URL}/api/social/auto-post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-scheduler': '1' },
          body: JSON.stringify({ artistId: config.artistId, prompt: config.prompt }),
        });
        const data = await resp.json() as any;
        console.log(`[scheduler] publish-post result:`, data?.success ? 'OK' : data?.error);
        break;
      }
      case 'custom-api': {
        // prompt field used as the URL to call
        if (config.prompt?.startsWith('http')) {
          await fetch(config.prompt, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        }
        break;
      }
      default:
        console.log(`[scheduler] Unknown action: ${config.action}`);
    }

    // Record last run time on the node
    await updateNodeLastRun(config.artistId, config.nodeId);
  } catch (err) {
    console.error(`[scheduler] Action ${config.action} failed:`, err);
  }
}

async function updateNodeLastRun(artistId: number, nodeId: string) {
  try {
    const [artist] = await db.select().from(users).where(
      // @ts-ignore
      (t: any) => t.id === artistId
    ).limit(1);
    if (!artist) return;
    const workflow = (artist as any).nodeWorkflow as { nodes?: any[]; edges?: any[] } | null;
    if (!workflow?.nodes) return;
    const updatedNodes = workflow.nodes.map((n: any) =>
      n.id === nodeId ? { ...n, data: { ...n.data, schedule: { ...n.data?.schedule, lastRun: new Date().toISOString() } } } : n
    );
    await db.update(users).set({ nodeWorkflow: { ...workflow, nodes: updatedNodes } } as any)
      // @ts-ignore
      .where((t: any) => t.id === artistId);
  } catch (e) {
    console.error('[scheduler] updateNodeLastRun error:', e);
  }
}

function taskKey(artistId: number, nodeId: string) {
  return `${artistId}__${nodeId}`;
}

export const workflowScheduler = {
  /**
   * Register (or re-register) all schedule-trigger nodes for a single artist.
   * Called on server boot (for all artists) and on workflow save.
   */
  registerArtistSchedules(artistId: number, artistSlug: string, nodes: any[]) {
    // Clear existing tasks for this artist
    for (const [key, task] of activeTasks.entries()) {
      if (key.startsWith(`${artistId}__`)) {
        task.stop();
        activeTasks.delete(key);
      }
    }

    const schedulerNodes = (nodes ?? []).filter(
      (n: any) => n.type === 'scheduleTrigger' && n.data?.schedule?.enabled
    );

    for (const node of schedulerNodes) {
      const schedule: ScheduleConfig = {
        ...node.data.schedule,
        artistId,
        artistSlug,
        nodeId: node.id,
      };

      let expr: string;
      try {
        expr = buildCronExpr(schedule);
      } catch {
        console.warn(`[scheduler] Invalid cron config for node ${node.id}`);
        continue;
      }

      if (!cron.validate(expr)) {
        console.warn(`[scheduler] Invalid cron expression "${expr}" for node ${node.id}`);
        continue;
      }

      const key = taskKey(artistId, node.id);
      const task = cron.schedule(expr, () => executeScheduleAction(schedule), { timezone: 'UTC' });
      activeTasks.set(key, task);
      console.log(`[scheduler] ✅ Registered "${expr}" for artist ${artistSlug}, node ${node.id}, action: ${schedule.action}`);
    }
  },

  /** Called once on server start to load all artist workflows from DB */
  async bootstrap() {
    try {
      const allArtists = await db.select({
        id: users.id,
        username: users.username,
        nodeWorkflow: (users as any).nodeWorkflow,
      }).from(users);

      let registered = 0;
      for (const artist of allArtists) {
        const workflow = (artist as any).nodeWorkflow as { nodes?: any[] } | null;
        if (!workflow?.nodes?.length) continue;
        this.registerArtistSchedules(artist.id, artist.username ?? String(artist.id), workflow.nodes);
        registered++;
      }
      console.log(`[scheduler] Bootstrap complete — registered schedules for ${registered} artist(s), ${activeTasks.size} total tasks`);
    } catch (err) {
      console.error('[scheduler] Bootstrap error:', err);
    }
  },

  getActiveCount() { return activeTasks.size; },
};
