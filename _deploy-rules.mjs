// Deploy Firebase security rules via the Rules REST API using the Admin SDK
// service account (no interactive `firebase login` needed).
//
// Usage:
//   node _deploy-rules.mjs firestore            → deploy firestore.rules
//   node _deploy-rules.mjs storage <bucket>     → deploy firebase-storage.rules
//   node _deploy-rules.mjs get firestore        → just print the CURRENT live rules (backup)
//   node _deploy-rules.mjs get storage <bucket> → print current storage rules
import 'dotenv/config';
import fs from 'fs';
import { GoogleAuth } from 'google-auth-library';

const PROJECT = process.env.FIREBASE_PROJECT_ID;
const API = 'https://firebaserules.googleapis.com/v1';

function credentials() {
  let sa = null;
  if (process.env.FIREBASE_ADMIN_KEY) {
    try { sa = JSON.parse(process.env.FIREBASE_ADMIN_KEY); } catch { /* not JSON */ }
  }
  const client_email = sa?.client_email || process.env.FIREBASE_CLIENT_EMAIL;
  let private_key = sa?.private_key || process.env.FIREBASE_PRIVATE_KEY || '';
  private_key = private_key.replace(/\\n/g, '\n');
  return { client_email, private_key };
}

async function token() {
  const { client_email, private_key } = credentials();
  if (!client_email || !private_key) throw new Error('Missing service-account credentials');
  const auth = new GoogleAuth({
    credentials: { client_email, private_key },
    scopes: ['https://www.googleapis.com/auth/firebase', 'https://www.googleapis.com/auth/cloud-platform'],
  });
  const c = await auth.getClient();
  const t = await c.getAccessToken();
  return t.token;
}

async function api(path, method = 'GET', body) {
  const t = await token();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);
    err.status = res.status; err.body = json;
    throw err;
  }
  return json;
}

function releaseId(target, bucket) {
  if (target === 'firestore') return 'cloud.firestore';
  if (target === 'storage') return `firebase.storage/${bucket}`;
  throw new Error('target must be firestore|storage');
}
function rulesFile(target) {
  return target === 'firestore' ? 'firestore.rules' : 'firebase-storage.rules';
}

async function getCurrent(target, bucket) {
  const rid = releaseId(target, bucket);
  const release = await api(`/projects/${PROJECT}/releases/${rid}`);
  const rulesetName = release.rulesetName; // projects/<p>/rulesets/<id>
  const rs = await api(`/projects/${PROJECT}/${rulesetName.split(`projects/${PROJECT}/`)[1]}`);
  const content = rs?.source?.files?.[0]?.content || '(none)';
  return { rid, rulesetName, content };
}

async function deploy(target, bucket) {
  const rid = releaseId(target, bucket);
  const file = rulesFile(target);
  const content = fs.readFileSync(file, 'utf8');

  // 1) Backup current
  let backup = null;
  try { backup = await getCurrent(target, bucket); }
  catch (e) { console.log(`(no existing release to back up: ${e.message})`); }
  if (backup) {
    console.log(`\n── CURRENT (backup) ${rid} → ${backup.rulesetName} ──`);
    console.log(backup.content.split('\n').slice(0, 12).join('\n'));
    fs.writeFileSync(`_rules-backup-${target}.txt`, backup.content);
    console.log(`(full current rules saved to _rules-backup-${target}.txt)`);
  }

  // 2) Create new ruleset (this validates syntax server-side)
  const created = await api(`/projects/${PROJECT}/rulesets`, 'POST', {
    source: { files: [{ name: file, content }] },
  });
  console.log(`\n✅ Ruleset created + validated: ${created.name}`);

  // 3) Point the release at the new ruleset (PATCH existing, else create)
  try {
    await api(`/projects/${PROJECT}/releases/${rid}`, 'PATCH', {
      release: { name: `projects/${PROJECT}/releases/${rid}`, rulesetName: created.name },
    });
  } catch (e) {
    if (e.status === 404) {
      await api(`/projects/${PROJECT}/releases`, 'POST', {
        name: `projects/${PROJECT}/releases/${rid}`, rulesetName: created.name,
      });
    } else throw e;
  }
  console.log(`🚀 Deployed ${file} → release ${rid}\n`);
}

async function main() {
  const [, , cmd, a, b] = process.argv;
  console.log(`project=${PROJECT}`);
  if (cmd === 'get') {
    const cur = await getCurrent(a, b);
    console.log(`\n── LIVE ${cur.rid} → ${cur.rulesetName} ──\n${cur.content}`);
    return;
  }
  await deploy(cmd, a); // cmd=firestore | storage ; a=bucket (storage)
}

main().catch((e) => { console.error('\n❌', e.message); process.exit(1); });
