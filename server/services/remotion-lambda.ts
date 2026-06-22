/**
 * Remotion Lambda service
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders compositions on AWS Lambda (massively parallel) instead of spawning a
 * single local `npx remotion render`. On a memory-constrained host like
 * Render.com this is the only way to get fast renders without OOM-crashing: each
 * Lambda invocation renders a small chunk of frames in parallel and stitches the
 * result in S3.
 *
 * Configuration (env vars):
 *   REMOTION_LAMBDA_FUNCTION_NAME  — deployed function name (from deploy script)
 *   REMOTION_LAMBDA_SERVE_URL      — deployed site serveUrl  (from deploy script)
 *   REMOTION_LAMBDA_REGION         — AWS region (default us-east-1)
 *   REMOTION_AWS_ACCESS_KEY_ID     — AWS key (Remotion reads this automatically)
 *   REMOTION_AWS_SECRET_ACCESS_KEY — AWS secret
 *     (falls back to AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)
 *   REMOTION_LAMBDA_FRAMES_PER_LAMBDA — optional chunk size override
 *
 * If any of the required vars are missing, isLambdaConfigured() returns false and
 * the caller transparently falls back to the local spawn render.
 */

import {
  renderMediaOnLambda,
  getRenderProgress,
} from '@remotion/lambda/client';

// AwsRegion is a string union in Remotion; keep it loose to avoid import churn.
type AwsRegion = string;

export interface LambdaRenderHandle {
  renderId: string;
  bucketName: string;
  functionName: string;
  region: AwsRegion;
}

export interface LambdaProgress {
  done: boolean;
  progress: number; // 0..100
  outputFile: string | null;
  fatalError: string | null;
}

export function getLambdaConfig() {
  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME?.trim();
  const serveUrl = process.env.REMOTION_LAMBDA_SERVE_URL?.trim();
  const region = (process.env.REMOTION_LAMBDA_REGION || process.env.AWS_REGION || 'us-east-1').trim() as AwsRegion;
  const accessKey =
    process.env.REMOTION_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretKey =
    process.env.REMOTION_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const hasAws = !!(accessKey && secretKey);
  return {
    functionName,
    serveUrl,
    region,
    hasAws,
    enabled: !!(functionName && serveUrl && hasAws),
  };
}

export function isLambdaConfigured(): boolean {
  return getLambdaConfig().enabled;
}

/**
 * Kick off a Lambda render. Returns a handle used to poll progress.
 * Throws if Lambda is not configured.
 */
export async function startLambdaRender(opts: {
  composition: string;
  inputProps: Record<string, unknown>;
  jpegQuality?: number;
  scale?: number;
  framesPerLambda?: number;
}): Promise<LambdaRenderHandle> {
  const cfg = getLambdaConfig();
  if (!cfg.enabled) {
    throw new Error('Remotion Lambda is not configured');
  }

  const framesPerLambda =
    opts.framesPerLambda ||
    (process.env.REMOTION_LAMBDA_FRAMES_PER_LAMBDA
      ? Number(process.env.REMOTION_LAMBDA_FRAMES_PER_LAMBDA)
      : undefined);

  const { renderId, bucketName } = await renderMediaOnLambda({
    region: cfg.region as any,
    functionName: cfg.functionName!,
    serveUrl: cfg.serveUrl!,
    composition: opts.composition,
    inputProps: opts.inputProps,
    codec: 'h264',
    imageFormat: 'jpeg',
    jpegQuality: opts.jpegQuality ?? 80,
    scale: opts.scale ?? 1,
    privacy: 'public',
    // Retry transient AWS rate-limit / throttling errors a few times before
    // giving up (new accounts with a low concurrency quota hit these).
    maxRetries: 3,
    ...(framesPerLambda && Number.isFinite(framesPerLambda)
      ? { framesPerLambda }
      : {}),
    downloadBehavior: { type: 'download', fileName: `${opts.composition}.mp4` },
  } as any);

  return {
    renderId,
    bucketName,
    functionName: cfg.functionName!,
    region: cfg.region,
  };
}

/**
 * Poll the progress of a Lambda render.
 */
export async function getLambdaRenderProgress(
  handle: LambdaRenderHandle,
): Promise<LambdaProgress> {
  const p = await getRenderProgress({
    renderId: handle.renderId,
    bucketName: handle.bucketName,
    functionName: handle.functionName,
    region: handle.region as any,
  });

  const fatal =
    p.fatalErrorEncountered && p.errors?.length
      ? p.errors[0]?.message || 'Lambda render failed'
      : null;

  return {
    done: !!p.done,
    progress: Math.max(0, Math.min(100, Math.round((p.overallProgress || 0) * 100))),
    outputFile: (p as any).outputFile ?? null,
    fatalError: fatal,
  };
}

/**
 * Download the finished render from S3 to a local path so it can be re-uploaded
 * to Firebase Storage (keeping output URLs consistent with the existing flow).
 */
export async function downloadLambdaRender(
  handle: LambdaRenderHandle,
  outPath: string,
): Promise<void> {
  // Dynamic import keeps the heavier deploy/AWS-SDK surface out of the hot path.
  const { downloadMedia } = await import('@remotion/lambda');
  await downloadMedia({
    region: handle.region as any,
    bucketName: handle.bucketName,
    renderId: handle.renderId,
    outPath,
  });
}
