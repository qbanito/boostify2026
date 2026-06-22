/**
 * Deploy Remotion to AWS Lambda
 * ─────────────────────────────────────────────────────────────────────────────
 * Run once (and again whenever the remotion/ composition code changes):
 *
 *   npx tsx scripts/deploy-remotion-lambda.ts
 *
 * Requires AWS credentials in env (see below). Prints the two values you must
 * set in your server env (locally in .env and in Render.com):
 *
 *   REMOTION_LAMBDA_FUNCTION_NAME=...
 *   REMOTION_LAMBDA_SERVE_URL=...
 *
 * AWS credentials (the IAM user needs the Remotion Lambda policy — see
 * https://www.remotion.dev/docs/lambda/permissions):
 *   REMOTION_AWS_ACCESS_KEY_ID / REMOTION_AWS_SECRET_ACCESS_KEY
 *   (or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)
 *   REMOTION_LAMBDA_REGION (default us-east-1)
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  deployFunction,
  deploySite,
  getOrCreateBucket,
} from '@remotion/lambda';

const REGION = (process.env.REMOTION_LAMBDA_REGION ||
  process.env.AWS_REGION ||
  'us-east-1') as any;

// Lambda sizing. The lyrics-video composition is 1080p h264. A long song split
// across only ~8 lambdas (new-account concurrency cap) means each lambda renders
// ~1300+ frames, so it needs BOTH a high timeout AND enough CPU:
//   - timeout 900s (the Lambda maximum) so a big chunk never times out.
//   - 3008MB RAM ≈ ~2 vCPU (Lambda CPU scales with memory) so frames render fast.
// Tune via env if needed. NOTE: Remotion encodes mem/disk/timeout into the
// function NAME, so changing these produces a NEW REMOTION_LAMBDA_FUNCTION_NAME.
const MEMORY_MB = Number(process.env.REMOTION_LAMBDA_MEMORY_MB) || 3008;
const DISK_MB = Number(process.env.REMOTION_LAMBDA_DISK_MB) || 2048;
const TIMEOUT_S = Number(process.env.REMOTION_LAMBDA_TIMEOUT_S) || 900;
const SITE_NAME = process.env.REMOTION_LAMBDA_SITE_NAME || 'boostify-lyrics-video';

async function main() {
  const accessKey =
    process.env.REMOTION_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretKey =
    process.env.REMOTION_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKey || !secretKey) {
    console.error(
      '\n❌ Missing AWS credentials.\n' +
        '   Set REMOTION_AWS_ACCESS_KEY_ID and REMOTION_AWS_SECRET_ACCESS_KEY ' +
        '(or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) before running.\n',
    );
    process.exit(1);
  }

  console.log(`\n🚀 Deploying Remotion Lambda to region ${REGION}…\n`);

  // 1) Deploy (or update) the Lambda function.
  console.log('① Deploying Lambda function…');
  const { functionName, alreadyExisted } = await deployFunction({
    region: REGION,
    timeoutInSeconds: TIMEOUT_S,
    memorySizeInMb: MEMORY_MB,
    diskSizeInMb: DISK_MB,
    createCloudWatchLogGroup: true,
  });
  console.log(
    `   ✓ Function: ${functionName} ${alreadyExisted ? '(reused)' : '(created)'}\n`,
  );

  // 2) Ensure an S3 bucket exists for the site + render output.
  console.log('② Ensuring S3 bucket…');
  const { bucketName } = await getOrCreateBucket({ region: REGION });
  console.log(`   ✓ Bucket: ${bucketName}\n`);

  // 3) Bundle + upload the site. The lyrics-video composition only uses remote
  //    URLs (audio/cover art) and never calls staticFile(), so we point the
  //    bundler at an EMPTY public dir to skip uploading the project's ~440MB
  //    public/ folder to S3.
  const emptyPublicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remotion-empty-public-'));
  console.log('③ Bundling + uploading site…');
  const { serveUrl } = await deploySite({
    entryPoint: path.join(process.cwd(), 'remotion', 'index.ts'),
    bucketName,
    region: REGION,
    siteName: SITE_NAME,
    options: {
      publicDir: emptyPublicDir,
      onBundleProgress: (p) => process.stdout.write(`\r   bundling ${p}%   `),
      onUploadProgress: (u) =>
        process.stdout.write(
          `\r   uploading ${u.filesUploaded}/${u.totalFiles} files   `,
        ),
    },
  });
  console.log(`\n   ✓ Serve URL: ${serveUrl}\n`);
  try { fs.rmSync(emptyPublicDir, { recursive: true, force: true }); } catch { /* ignore */ }

  console.log('─────────────────────────────────────────────────────────────');
  console.log('✅ Done. Set these env vars (locally in .env AND in Render):\n');
  console.log(`REMOTION_LAMBDA_FUNCTION_NAME=${functionName}`);
  console.log(`REMOTION_LAMBDA_SERVE_URL=${serveUrl}`);
  console.log(`REMOTION_LAMBDA_REGION=${REGION}`);
  console.log('─────────────────────────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error('\n❌ Deploy failed:', err?.message || err);
  process.exit(1);
});
