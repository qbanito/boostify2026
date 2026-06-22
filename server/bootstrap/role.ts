/**
 * Service role resolution — one binary, three roles.
 * ==================================================
 * The same build runs as `web`, `worker` or `scheduler` depending on
 * SERVICE_ROLE. This lets us move the heavy, event-loop-starving work
 * (cron schedulers, media/IA jobs) OUT of the web process so a busy cron
 * tick or an OOM in a generation job can never take down the API.
 *
 * Safe, additive default: when SERVICE_ROLE is unset the process behaves as
 * `web` and KEEPS running the in-process schedulers (current behaviour), so
 * nothing changes until a dedicated `scheduler` service is provisioned and
 * `SCHEDULERS_IN_WEB=false` is set on the web service.
 */
export type ServiceRole = 'web' | 'worker' | 'scheduler';

export const ROLE: ServiceRole =
  (process.env.SERVICE_ROLE as ServiceRole) || 'web';

export const isWeb = ROLE === 'web';
export const isWorker = ROLE === 'worker';
export const isScheduler = ROLE === 'scheduler';

/**
 * Whether THIS process should run the periodic background schedulers
 * (stats cron, social-integration worker, fan-sequence emails, …).
 *
 *  • A dedicated `scheduler` service always runs them.
 *  • The `web` service runs them ONLY when SCHEDULERS_IN_WEB !== 'false'
 *    (the default), preserving today's single-service behaviour. Set
 *    SCHEDULERS_IN_WEB=false on web once a `scheduler` service exists to
 *    avoid double execution.
 *  • The `worker` service never runs them.
 */
export function shouldRunSchedulers(): boolean {
  if (isScheduler) return true;
  if (isWorker) return false;
  return process.env.SCHEDULERS_IN_WEB !== 'false';
}

export function describeRole(): string {
  return `role=${ROLE} schedulers=${shouldRunSchedulers()}`;
}
