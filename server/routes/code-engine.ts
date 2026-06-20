import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import * as esbuild from "esbuild";
import { PRIMARY_MODEL } from '../utils/ai-config';

const router = Router();

// ─── Config ─────────────────────────────────────────────────────
const PROJECT_ROOT = process.cwd();
const ENGINE_LOG_DIR = path.join(PROJECT_ROOT, "server", "data", "code-engine");
if (!fs.existsSync(ENGINE_LOG_DIR)) {
  fs.mkdirSync(ENGINE_LOG_DIR, { recursive: true });
}

// ─── Per-Page Execution Locks (parallel by pageId) ──────────────
// Each page gets its own lock so IG Boost, Spotify, YouTube can run simultaneously
const pageLocks = new Map<string, { isExecuting: boolean; currentTask: string | null; queuedTasks: Array<{ resolve: (v: void) => void }> }>();

function getPageLock(pageId: string) {
  if (!pageLocks.has(pageId)) {
    pageLocks.set(pageId, { isExecuting: false, currentTask: null, queuedTasks: [] });
  }
  return pageLocks.get(pageId)!;
}

async function acquirePageLock(pageId: string, task: string): Promise<boolean> {
  const lock = getPageLock(pageId);
  if (!lock.isExecuting) {
    lock.isExecuting = true;
    lock.currentTask = task;
    return true;
  }
  // Queue if someone else is running on same page (max 3 in queue)
  if (lock.queuedTasks.length >= 3) return false;
  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      const idx = lock.queuedTasks.findIndex(t => t.resolve === wrappedResolve);
      if (idx >= 0) lock.queuedTasks.splice(idx, 1);
      resolve(false);
    }, 120000); // 2 min timeout
    const wrappedResolve = (v: void) => { clearTimeout(timeout); resolve(true); };
    lock.queuedTasks.push({ resolve: wrappedResolve });
  });
}

function releasePageLock(pageId: string) {
  const lock = getPageLock(pageId);
  lock.isExecuting = false;
  lock.currentTask = null;
  // Wake up next in queue
  if (lock.queuedTasks.length > 0) {
    const next = lock.queuedTasks.shift()!;
    lock.isExecuting = true;
    next.resolve();
  }
}

// File-level locks to prevent two pages from editing the same file simultaneously
const fileLocks = new Set<string>();

function acquireFileLocks(files: string[]): boolean {
  for (const f of files) {
    if (fileLocks.has(f)) return false;
  }
  for (const f of files) fileLocks.add(f);
  return true;
}

function releaseFileLocks(files: string[]) {
  for (const f of files) fileLocks.delete(f);
}

// Global status tracking (read-only, for status endpoint)
function getGlobalStatus() {
  const active: { pageId: string; task: string }[] = [];
  const queued: { pageId: string; waiting: number }[] = [];
  pageLocks.forEach((lock, pageId) => {
    if (lock.isExecuting && lock.currentTask) active.push({ pageId, task: lock.currentTask });
    if (lock.queuedTasks.length > 0) queued.push({ pageId, waiting: lock.queuedTasks.length });
  });
  return { active, queued, totalActive: active.length, totalQueued: queued.reduce((s, q) => s + q.waiting, 0) };
}

// Protected files that should NEVER be modified
const PROTECTED_FILES = new Set([
  ".env",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "drizzle.config.ts",
  "firebase-storage.rules",
  "firestore.rules",
  "hardhat.config.cjs",
  "hardhat.config.minimal.cjs",
]);

// ─── Route-to-Files Mapping ─────────────────────────────────────
// Maps each diagnostic page ID to the files it can modify
const PAGE_FILE_MAP: Record<string, { read: string[]; write: string[] }> = {
  "ig-boost": {
    read: [
      "client/src/pages/instagram-boost.tsx",
      "client/src/components/instagram-boost/ig-boost-pricing.tsx",
      "client/src/components/instagram-boost/reports-tab.tsx",
      "client/src/components/spotify-boost/subscription-banner.tsx",
      "client/src/hooks/use-spotify-boost-limits.ts",
      "server/routes/instagram-boost.ts",
      "server/routes/stripe.ts",
    ],
    write: [
      "client/src/pages/instagram-boost.tsx",
      "client/src/components/instagram-boost/ig-boost-pricing.tsx",
      "client/src/components/instagram-boost/reports-tab.tsx",
      "client/src/components/instagram-boost/subscription-banner.tsx",
      "client/src/hooks/use-instagram-boost-limits.ts",
      "server/routes/instagram-boost.ts",
      "server/routes/stripe.ts",
    ],
  },
  "spotify-boost": {
    read: [
      "client/src/pages/spotify.tsx",
      "client/src/components/spotify-boost/spotify-pricing.tsx",
      "client/src/components/spotify-boost/subscription-banner.tsx",
      "client/src/hooks/use-spotify-boost-limits.ts",
      "server/routes/spotify-boost.ts",
      "server/routes/stripe.ts",
    ],
    write: [
      "client/src/pages/spotify.tsx",
      "client/src/components/spotify-boost/spotify-pricing.tsx",
      "client/src/components/spotify-boost/subscription-banner.tsx",
      "client/src/hooks/use-spotify-boost-limits.ts",
      "server/routes/spotify-boost.ts",
      "server/routes/stripe.ts",
    ],
  },
  "youtube-boost": {
    read: [
      "client/src/pages/youtube-views.tsx",
      "client/src/components/youtube-views/youtube-pricing.tsx",
      "client/src/hooks/use-spotify-boost-limits.ts",
      "server/routes/stripe.ts",
    ],
    write: [
      "client/src/pages/youtube-views.tsx",
      "client/src/components/youtube-views/youtube-pricing.tsx",
      "client/src/components/youtube-views/subscription-banner.tsx",
      "client/src/hooks/use-youtube-boost-limits.ts",
      "server/routes/stripe.ts",
    ],
  },
  "artist-setup": {
    read: [
      "client/src/pages/artist-setup.tsx",
      "client/src/App.tsx",
    ],
    write: [
      "client/src/pages/artist-setup.tsx",
    ],
  },
  "music-video-creator": {
    read: [
      "client/src/pages/music-video-creator.tsx",
      "server/routes/video-rendering.ts",
    ],
    write: [
      "client/src/pages/music-video-creator.tsx",
      "server/routes/video-rendering.ts",
    ],
  },
  "ai-image-gen": {
    read: [
      "client/src/pages/image-generator-simple.tsx",
      "server/routes/image-generation.ts",
    ],
    write: [
      "client/src/pages/image-generator-simple.tsx",
      "server/routes/image-generation.ts",
    ],
  },
  "merchandise": {
    read: [
      "client/src/pages/merchandise.tsx",
      "server/routes/merch.ts",
    ],
    write: [
      "client/src/pages/merchandise.tsx",
      "server/routes/merch.ts",
    ],
  },
  "boostify-tv": {
    read: [
      "client/src/pages/boostify-tv.tsx",
    ],
    write: [
      "client/src/pages/boostify-tv.tsx",
    ],
  },
  "education": {
    read: [
      "client/src/pages/education.tsx",
    ],
    write: [
      "client/src/pages/education.tsx",
    ],
  },
  "boostiswap": {
    read: [
      "client/src/pages/boostiswap.tsx",
      "server/routes/boostiswap.ts",
    ],
    write: [
      "client/src/pages/boostiswap.tsx",
      "server/routes/boostiswap.ts",
    ],
  },
  "social-network": {
    read: [
      "client/src/pages/social-network.tsx",
      "server/routes/social-network.ts",
    ],
    write: [
      "client/src/pages/social-network.tsx",
      "server/routes/social-network.ts",
      "server/routes/content-moderation.ts",
    ],
  },
  "ai-agents": {
    read: [
      "client/src/pages/ai-agents.tsx",
      "server/routes/ai-agents.ts",
    ],
    write: [
      "client/src/pages/ai-agents.tsx",
      "server/routes/ai-agents.ts",
    ],
  },
};

// ─── AI Provider Abstraction (Race Mode) ────────────────────────
interface AIResponse {
  content: string;
  model: string;
  provider: string;
  tokensUsed?: number;
  latencyMs: number;
}

// Individual provider call functions
function callGitHubModels(systemPrompt: string, userPrompt: string): Promise<AIResponse> | null {
  const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
  if (!githubToken) return null;
  const start = Date.now();
  return fetch("https://models.inference.ai.azure.com/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${githubToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: PRIMARY_MODEL,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      max_tokens: 16000, temperature: 0.1,
    }),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`${response.status} - ${(await response.text()).slice(0, 200)}`);
    const data = await response.json() as any;
    return {
      content: data.choices[0].message.content,
      model: PRIMARY_MODEL, provider: "github-models",
      tokensUsed: data.usage?.total_tokens, latencyMs: Date.now() - start,
    };
  });
}

function callAnthropic(systemPrompt: string, userPrompt: string): Promise<AIResponse> | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const start = Date.now();
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 16000, temperature: 0.1,
      system: systemPrompt, messages: [{ role: "user", content: userPrompt }],
    }),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`${response.status} - ${(await response.text()).slice(0, 200)}`);
    const data = await response.json() as any;
    return {
      content: data.content[0].text, model: data.model, provider: "anthropic",
      tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0), latencyMs: Date.now() - start,
    };
  });
}

function callOpenAIDirect(systemPrompt: string, userPrompt: string): Promise<AIResponse> | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const start = Date.now();
  return (async () => {
    const { createTrackedOpenAI } = await import("../utils/tracked-openai");
    const openai = createTrackedOpenAI({ apiKey: key });
    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      max_tokens: 16000, temperature: 0.1,
    });
    return {
      content: completion.choices[0].message.content || "",
      model: PRIMARY_MODEL, provider: "openai",
      tokensUsed: completion.usage?.total_tokens, latencyMs: Date.now() - start,
    };
  })();
}

// ─── Copilot API Provider (uses VS Code Copilot token — higher rate limits) ───
function callCopilot(systemPrompt: string, userPrompt: string): Promise<AIResponse> | null {
  const token = process.env.COPILOT_API_KEY || process.env.GITHUB_COPILOT_TOKEN;
  if (!token) return null;
  const start = Date.now();
  const apiUrl = process.env.COPILOT_API_URL || "https://api.githubcopilot.com/chat/completions";
  return fetch(apiUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Editor-Version": "vscode/1.96.0",
      "Copilot-Integration-Id": "vscode-chat",
    },
    body: JSON.stringify({
      model: PRIMARY_MODEL,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      max_tokens: 16000, temperature: 0.1,
    }),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`copilot ${response.status}: ${(await response.text()).slice(0, 200)}`);
    const data = await response.json() as any;
    return {
      content: data.choices[0].message.content,
      model: data.model || PRIMARY_MODEL, provider: "copilot",
      tokensUsed: data.usage?.total_tokens, latencyMs: Date.now() - start,
    };
  });
}

async function callAI(systemPrompt: string, userPrompt: string, mode: "race" | "fallback" = "race"): Promise<AIResponse> {
  const providers = [
    { name: "github-models", fn: callGitHubModels },
    { name: "copilot", fn: callCopilot },
    { name: "anthropic", fn: callAnthropic },
    { name: "openai", fn: callOpenAIDirect },
  ];

  const available = providers.map(p => ({ name: p.name, promise: p.fn(systemPrompt, userPrompt) })).filter(p => p.promise !== null);

  if (available.length === 0) {
    throw new Error("No AI providers configured. Set GITHUB_TOKEN, ANTHROPIC_API_KEY, or OPENAI_API_KEY");
  }

  if (mode === "race" && available.length > 1) {
    // RACE MODE: fire all available providers simultaneously, use first successful response
    console.log(`⚡ [CodeEngine] Racing ${available.length} providers: ${available.map(a => a.name).join(", ")}`);
    
    const results = available.map(({ name, promise }) =>
      promise!.then(
        (result) => { console.log(`🏁 [CodeEngine] ${name} finished in ${result.latencyMs}ms`); return result; },
        (err) => { console.warn(`❌ [CodeEngine] ${name} failed: ${err.message}`); throw err; }
      )
    );

    // Promise.any returns the first successful result
    try {
      const winner = await Promise.any(results);
      console.log(`✅ [CodeEngine] Winner: ${winner.provider} (${winner.latencyMs}ms, ${winner.tokensUsed} tokens)`);
      return winner;
    } catch (aggregateErr: any) {
      const msgs = aggregateErr.errors?.map((e: any) => e.message).join(" | ") || aggregateErr.message;
      throw new Error(`All providers failed in race mode: ${msgs}`);
    }
  }

  // FALLBACK MODE: try in order
  const errors: string[] = [];
  for (const { name, promise } of available) {
    try {
      console.log(`[CodeEngine] Trying ${name}...`);
      const result = await promise!;
      console.log(`✅ [CodeEngine] ${name} responded (${result.latencyMs}ms)`);
      return result;
    } catch (err: any) {
      errors.push(`${name}: ${err.message}`);
      console.warn(`[CodeEngine] ${name} failed: ${err.message}`);
    }
  }
  throw new Error(`No AI provider succeeded. Errors: ${errors.join(" | ")}`);
}

// ─── File Utilities ─────────────────────────────────────────────
function readProjectFile(relativePath: string): string | null {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, "utf-8");
}

function writeProjectFile(relativePath: string, content: string): void {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content, "utf-8");
}

function isFileProtected(relativePath: string): boolean {
  const basename = path.basename(relativePath);
  if (PROTECTED_FILES.has(basename)) return true;
  if (relativePath.startsWith(".env")) return true;
  if (relativePath.includes("node_modules")) return true;
  return false;
}

// ─── Smart Context Resolution ───────────────────────────────────
// Follows imports to discover referenced files (like VSCode agents do)
function resolveImports(filePath: string, depth = 0, visited = new Set<string>()): string[] {
  if (depth > 2 || visited.has(filePath)) return [];
  visited.add(filePath);

  const content = readProjectFile(filePath);
  if (!content) return [];

  const discovered: string[] = [];
  // Match: import ... from './path' or '../path' (relative imports only)
  const importRegex = /(?:import|from)\s+['"](\.[^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    const dir = path.dirname(filePath);
    let resolved = path.posix.join(dir.replace(/\\/g, "/"), importPath);

    // Try extensions
    const extensions = ["", ".tsx", ".ts", ".jsx", ".js"];
    for (const ext of extensions) {
      const candidate = resolved + ext;
      if (readProjectFile(candidate)) {
        if (!visited.has(candidate)) {
          discovered.push(candidate);
          // Recurse one more level
          discovered.push(...resolveImports(candidate, depth + 1, visited));
        }
        break;
      }
    }
  }

  return discovered;
}

// Build comprehensive context: page files + their imports
function buildSmartContext(pageId: string): { path: string; content: string; role: string }[] {
  const fileMap = PAGE_FILE_MAP[pageId];
  if (!fileMap) return [];

  const contextFiles: { path: string; content: string; role: string }[] = [];
  const visited = new Set<string>();

  // Phase 1: Primary files (full content, marked as WRITABLE or READ-ONLY)
  for (const f of fileMap.write) {
    if (visited.has(f)) continue;
    visited.add(f);
    const content = readProjectFile(f);
    if (content) contextFiles.push({ path: f, content, role: "WRITABLE" });
  }
  for (const f of fileMap.read) {
    if (visited.has(f)) continue;
    visited.add(f);
    const content = readProjectFile(f);
    if (content) contextFiles.push({ path: f, content: content.slice(0, 20000), role: "READ-ONLY CONTEXT" });
  }

  // Phase 2: Discover imported components (up to 2 levels deep)
  const allPrimaryFiles = [...fileMap.read, ...fileMap.write];
  const importedFiles = new Set<string>();
  for (const f of allPrimaryFiles) {
    const imports = resolveImports(f, 0, new Set(visited));
    imports.forEach(imp => importedFiles.add(imp));
  }

  // Phase 3: Add imported files as context (capped to avoid token overflow)
  let totalContextSize = contextFiles.reduce((s, f) => s + f.content.length, 0);
  const MAX_CONTEXT_SIZE = 120000; // ~30K tokens

  for (const imp of Array.from(importedFiles)) {
    if (totalContextSize > MAX_CONTEXT_SIZE) break;
    if (visited.has(imp)) continue;
    visited.add(imp);
    const content = readProjectFile(imp);
    if (content) {
      const capped = content.slice(0, 8000);
      contextFiles.push({ path: imp, content: capped, role: "IMPORTED DEPENDENCY (DO NOT MODIFY unless task requires)" });
      totalContextSize += capped.length;
    }
  }

  return contextFiles;
}

// ─── Deep Validation (multi-step) ───────────────────────────────
interface ValidationResult {
  success: boolean;
  phase: string;
  errors: string;
  severity: "syntax" | "type" | "semantic" | "none";
}

function deepValidateChanges(
  changedFiles: string[],
  backup: Map<string, string | null>,
  changes: FileChange[]
): ValidationResult {
  // PHASE 1: esbuild syntax check (instant)
  for (const file of changedFiles) {
    const fullPath = path.join(PROJECT_ROOT, file);
    if (!fs.existsSync(fullPath)) continue;
    if (!file.match(/\.(ts|tsx)$/)) continue;

    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      esbuild.transformSync(content, {
        loader: file.endsWith(".tsx") ? "tsx" as const : "ts" as const,
        jsx: "automatic",
        logLevel: "silent",
        format: "esm",
      });
    } catch (err: any) {
      const errorMsg = err.errors?.map((e: any) => `${file}:${e.location?.line}: ${e.text}`).join("\n") || err.message;
      return { success: false, phase: "esbuild-syntax", errors: errorMsg.slice(0, 3000), severity: "syntax" };
    }
  }

  // PHASE 2: Import integrity check — verify all imports still resolve
  for (const change of changes) {
    if (change.action !== "modify") continue;
    const content = change.content;
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (!importPath.startsWith(".")) continue; // skip package imports

      const dir = path.dirname(change.filePath);
      const resolved = path.posix.join(dir.replace(/\\/g, "/"), importPath);
      const extensions = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];
      const exists = extensions.some(ext => {
        const candidate = path.join(PROJECT_ROOT, resolved + ext);
        return fs.existsSync(candidate);
      });
      if (!exists) {
        return {
          success: false,
          phase: "import-integrity",
          errors: `Broken import in ${change.filePath}: "${importPath}" does not resolve to any file`,
          severity: "type",
        };
      }
    }
  }

  // PHASE 3: Export preservation check — ensure we didn't remove exports used elsewhere
  for (const change of changes) {
    if (!change.originalContent || change.action !== "modify") continue;
    const origExports = extractExports(change.originalContent);
    const newExports = extractExports(change.content);
    const removed = origExports.filter(e => !newExports.includes(e));
    if (removed.length > 0) {
      return {
        success: false,
        phase: "export-preservation",
        errors: `Removed exports from ${change.filePath}: ${removed.join(", ")}. This would break other files that import them.`,
        severity: "semantic",
      };
    }
  }

  // PHASE 4: Size sanity check — if a file shrunk by >40%, it was probably truncated or gutted
  for (const change of changes) {
    if (!change.originalContent || change.action !== "modify") continue;
    const origSize = change.originalContent.length;
    const newSize = change.content.length;
    if (origSize > 200 && newSize < origSize * 0.6) {
      const pctReduced = Math.round((1 - newSize / origSize) * 100);
      return {
        success: false,
        phase: "size-sanity",
        errors: `${change.filePath} was reduced by ${pctReduced}% (${origSize} → ${newSize} chars). This likely removed existing functionality.`,
        severity: "semantic",
      };
    }
  }

  console.log(`[CodeEngine] ✅ Deep validation passed (${changedFiles.length} files, 4 phases)`);
  return { success: true, phase: "all-passed", errors: "", severity: "none" };
}

function extractExports(content: string): string[] {
  const exports: string[] = [];
  const regex = /export\s+(?:default\s+)?(?:function|const|class|interface|type|enum)\s+(\w+)/g;
  let m;
  while ((m = regex.exec(content)) !== null) exports.push(m[1]);
  // Named exports
  const namedRegex = /export\s+\{([^}]+)\}/g;
  while ((m = namedRegex.exec(content)) !== null) {
    m[1].split(",").forEach(e => {
      const name = e.trim().split(/\s+as\s+/)[0].trim();
      if (name) exports.push(name);
    });
  }
  if (/export\s+default\b/.test(content)) exports.push("default");
  return Array.from(new Set(exports));
}

// ─── Git Utilities ──────────────────────────────────────────────
function gitBackup(files: string[]): Map<string, string | null> {
  const backup = new Map<string, string | null>();
  for (const f of files) {
    backup.set(f, readProjectFile(f));
  }
  return backup;
}

function gitRollback(backup: Map<string, string | null>): void {
  backup.forEach((content, file) => {
    const fullPath = path.join(PROJECT_ROOT, file);
    if (content === null) {
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } else {
      writeProjectFile(file, content);
    }
  });
}

function gitCommit(message: string, files: string[]): string {
  try {
    for (const f of files) {
      execSync(`git add "${f}"`, { cwd: PROJECT_ROOT, stdio: "pipe" });
    }
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: PROJECT_ROOT, stdio: "pipe" });
    const hash = execSync("git rev-parse --short HEAD", { cwd: PROJECT_ROOT, stdio: "pipe" }).toString().trim();
    return hash;
  } catch (err: any) {
    throw new Error(`Git commit failed: ${err.message}`);
  }
}

function validateTypeScript(changedFiles: string[]): { success: boolean; errors: string } {
  // Wrapper kept for backwards compat — real validation is in deepValidateChanges
  for (const file of changedFiles) {
    const fullPath = path.join(PROJECT_ROOT, file);
    if (!fs.existsSync(fullPath)) continue;
    if (!file.match(/\.(ts|tsx)$/)) continue;
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      esbuild.transformSync(content, {
        loader: file.endsWith(".tsx") ? "tsx" as const : "ts" as const,
        jsx: "automatic", logLevel: "silent", format: "esm",
      });
    } catch (err: any) {
      const errorMsg = err.errors?.map((e: any) => `${file}:${e.location?.line}: ${e.text}`).join("\n") || err.message;
      return { success: false, errors: errorMsg.slice(0, 3000) };
    }
  }
  return { success: true, errors: "" };
}

// ─── Parse AI Response into File Changes ────────────────────────
interface FileChange {
  filePath: string;
  action: "create" | "modify";
  content: string;              // For "create": full file. For "modify": applied search/replace result
  originalContent: string | null;
  edits: { search: string; replace: string }[]; // The individual edits for tracking
}

function parseAIResponse(response: string): FileChange[] {
  const changes: FileChange[] = [];

  // APPROACH 1: Search/Replace blocks (preferred for modifications)
  // Format: <<<EDIT file:path/to/file.tsx
  // <<<SEARCH
  // old code
  // ===
  // new code
  // >>>REPLACE
  // >>>END
  const editBlockRegex = /<<<EDIT file:([^\n]+)\n([\s\S]*?)>>>END/g;
  let editMatch;

  while ((editMatch = editBlockRegex.exec(response)) !== null) {
    const filePath = editMatch[1].trim().replace(/^[/\\]/, "");
    if (!filePath || filePath.includes("..") || isFileProtected(filePath)) continue;

    const editBody = editMatch[2];
    const searchReplaceRegex = /<<<SEARCH\n([\s\S]*?)\n===\n([\s\S]*?)\n>>>REPLACE/g;
    let srMatch;
    const edits: { search: string; replace: string }[] = [];

    while ((srMatch = searchReplaceRegex.exec(editBody)) !== null) {
      edits.push({ search: srMatch[1], replace: srMatch[2] });
    }

    if (edits.length > 0) {
      const original = readProjectFile(filePath);
      if (original === null) continue; // Can't search/replace on non-existent file

      let modified = original;
      for (const edit of edits) {
        if (modified.includes(edit.search)) {
          modified = modified.replace(edit.search, edit.replace);
        } else {
          // Try trimmed match (whitespace tolerance)
          const trimmedSearch = edit.search.trim();
          const lines = modified.split("\n");
          let found = false;
          for (let i = 0; i <= lines.length - trimmedSearch.split("\n").length; i++) {
            const slice = lines.slice(i, i + trimmedSearch.split("\n").length).join("\n");
            if (slice.trim() === trimmedSearch) {
              modified = modified.replace(slice, edit.replace);
              found = true;
              break;
            }
          }
          if (!found) {
            console.warn(`[CodeEngine] SEARCH block not found in ${filePath}: "${edit.search.slice(0, 80)}..."`);
          }
        }
      }

      if (modified !== original) {
        changes.push({ filePath, action: "modify", content: modified, originalContent: original, edits });
      }
    }
  }

  // APPROACH 2: Full file blocks (for new files or if no EDIT blocks found)
  // Format: ```filepath:path/to/file.tsx\n...full content...\n```
  if (changes.length === 0) {
    const fileBlockRegex = /```(?:filepath|file)?[:\s]*([^\n`]+)\n([\s\S]*?)```/g;
    let match;

    while ((match = fileBlockRegex.exec(response)) !== null) {
      let filePath = match[1].trim();
      const content = match[2];

      filePath = filePath.replace(/^[/\\]/, "");
      if (!filePath || filePath.includes("..")) continue;
      if (isFileProtected(filePath)) continue;
      // Skip if filePath looks like a language identifier
      if (/^(ts|tsx|js|jsx|json|css|html|bash|shell|diff)$/i.test(filePath)) continue;

      const existing = readProjectFile(filePath);
      changes.push({
        filePath,
        action: existing ? "modify" : "create",
        content,
        originalContent: existing,
        edits: [],
      });
    }
  }

  return changes;
}

// ─── Generate Unified Diff ──────────────────────────────────────
function generateDiff(originalContent: string | null, newContent: string, filePath: string): string {
  const origLines = (originalContent || "").split("\n");
  const newLines = newContent.split("\n");

  let diff = `--- a/${filePath}\n+++ b/${filePath}\n`;
  const maxLines = Math.max(origLines.length, newLines.length);

  let inHunk = false;
  let hunkStart = -1;
  let hunkLines: string[] = [];

  for (let i = 0; i < maxLines; i++) {
    const origLine = i < origLines.length ? origLines[i] : undefined;
    const newLine = i < newLines.length ? newLines[i] : undefined;

    if (origLine !== newLine) {
      if (!inHunk) {
        inHunk = true;
        hunkStart = Math.max(0, i - 3);
        // Context before
        for (let c = hunkStart; c < i; c++) {
          if (c < origLines.length) hunkLines.push(` ${origLines[c]}`);
        }
      }
      if (origLine !== undefined) hunkLines.push(`-${origLine}`);
      if (newLine !== undefined) hunkLines.push(`+${newLine}`);
    } else if (inHunk) {
      hunkLines.push(` ${origLine || ""}`);
      // End hunk after 3 context lines
      if (hunkLines.filter(l => l.startsWith(" ")).length > 6) {
        diff += `@@ -${hunkStart + 1} @@\n${hunkLines.join("\n")}\n`;
        hunkLines = [];
        inHunk = false;
      }
    }
  }

  if (hunkLines.length > 0) {
    diff += `@@ -${hunkStart + 1} @@\n${hunkLines.join("\n")}\n`;
  }

  return diff;
}

// ─── Build System Prompt for Code Engine ────────────────────────
const SYSTEM_PROMPT = `You are Boostify Code Engine, an expert full-stack developer working as a precise surgical coding agent.

TECH STACK:
- Frontend: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui + Remotion + framer-motion
- Backend: Express.js + TypeScript + PostgreSQL (Drizzle ORM) + Firebase
- Styling: Dark theme with orange-500 accents, slate backgrounds
- Auth: Clerk  |  Payments: Stripe  |  State: React Query

RESPONSE FORMAT — CRITICAL:
For EXISTING files, use SEARCH/REPLACE blocks. This is MANDATORY for modifications:

<<<EDIT file:client/src/pages/example.tsx
<<<SEARCH
// exact lines from the original file to find
const oldCode = "something";
===
// the replacement code
const newCode = "better";
>>>REPLACE
>>>END

For NEW files only, use a code block:
\`\`\`filepath:client/src/hooks/new-hook.ts
// complete file content here
\`\`\`

ABSOLUTE RULES (violations cause automatic rollback):
1. NEVER rewrite/replace an entire existing file — ONLY use surgical SEARCH/REPLACE
2. Make MINIMAL changes — only modify lines directly relevant to the task
3. PRESERVE ALL existing functionality — do not remove, rename, or restructure working code
4. PRESERVE ALL existing imports — do not remove imports even if you think they're unused
5. PRESERVE ALL existing exports — removing an export breaks other files
6. NEVER replace a component with a generic placeholder — if you don't understand a component, leave it alone
7. NEVER change default prop values (autoPlay, loop, etc.) unless the task explicitly requires it
8. Follow existing code patterns and naming conventions exactly
9. Use TypeScript strict types
10. Never modify .env, package.json, or config files
11. Import only from packages already in the project
12. Each SEARCH block must be unique and match EXACTLY (including whitespace/indentation)
13. Include 3-5 lines of unchanged context in SEARCH blocks to uniquely identify location
14. If a file has IMPORTED DEPENDENCY status, do NOT modify it unless the task specifically requires it
15. If you're unsure about a change, do LESS rather than MORE — it's better to make a small correct change than a large broken one

CONTEXT FILES ARE LABELED:
- WRITABLE = You may modify these files
- READ-ONLY CONTEXT = Reference only, do not modify
- IMPORTED DEPENDENCY = Files imported by the page — modify only if task requires

BEFORE GENERATING CHANGES, verify:
✅ Do my SEARCH blocks match the exact current file content?
✅ Am I preserving all existing exports and imports?
✅ Am I only changing what the task requires?
✅ Will the file still work the same way after my changes (except for the new feature)?`;

// ─── Agent Mode: Tool-Based Agentic Execution (like VSCode Agents) ──
// Instead of single-shot prompt→response, the AI iterates:
// read files → search → edit → validate → fix errors → repeat until done

interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: AgentToolCall[];
  tool_call_id?: string;
}

interface AgentToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface AgentResult {
  success: boolean;
  filesChanged: string[];
  iterations: number;
  toolCallsTotal: number;
  commitHash?: string;
  error?: string;
  log: string[];
  provider: string;
  model: string;
}

const AGENT_TOOLS_OPENAI = [
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "Read a file's content. ALWAYS read a file before editing it to understand the current code.",
      parameters: {
        type: "object" as const,
        properties: {
          path: { type: "string" as const, description: "Relative path from project root (e.g. client/src/pages/spotify.tsx)" },
          startLine: { type: "number" as const, description: "Start line (1-based). Omit to read from beginning." },
          endLine: { type: "number" as const, description: "End line (1-based, inclusive). Omit to read to end." },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_codebase",
      description: "Search for a text pattern in project source files. Returns matching lines with file paths and line numbers.",
      parameters: {
        type: "object" as const,
        properties: {
          query: { type: "string" as const, description: "Text to search for (exact match)" },
          filePattern: { type: "string" as const, description: "Directory to search in (e.g. 'client/src' or 'server')" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_directory",
      description: "List files and folders in a directory to explore the project structure.",
      parameters: {
        type: "object" as const,
        properties: {
          path: { type: "string" as const, description: "Relative path from project root (e.g. 'client/src/components')" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "edit_file",
      description: "Make a surgical edit to an existing file. The oldString must match EXACTLY. Include 3-5 lines of surrounding context to uniquely identify the location. ALWAYS read the file first.",
      parameters: {
        type: "object" as const,
        properties: {
          path: { type: "string" as const, description: "Relative file path to edit" },
          oldString: { type: "string" as const, description: "Exact text to find and replace (include surrounding context lines)" },
          newString: { type: "string" as const, description: "Replacement text" },
          explanation: { type: "string" as const, description: "Brief explanation of what this edit does" },
        },
        required: ["path", "oldString", "newString"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_file",
      description: "Create a new file that doesn't exist yet.",
      parameters: {
        type: "object" as const,
        properties: {
          path: { type: "string" as const, description: "Relative file path to create" },
          content: { type: "string" as const, description: "Full file content" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "validate_changes",
      description: "Run syntax validation on all files you've edited. Call this after making edits to catch errors. If errors are found, fix them.",
      parameters: {
        type: "object" as const,
        properties: {},
      },
    },
  },
];

const AGENT_SYSTEM_PROMPT = `You are Boostify Code Engine, an expert full-stack agent that implements code changes iteratively.

You work in AGENT MODE with tools. Follow this workflow:
1. READ the relevant files first to understand the current code structure
2. SEARCH the codebase if you need to find patterns, usages, or understand how components connect
3. EDIT files with surgical precision — only change what's needed for the task
4. VALIDATE your changes after editing to catch syntax errors
5. If validation fails, read the error, fix it, and validate again

TECH STACK:
- Frontend: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui + Remotion + framer-motion
- Backend: Express.js + TypeScript + PostgreSQL (Drizzle ORM) + Firebase
- Styling: Dark theme with orange-500 accents, slate backgrounds
- Auth: Clerk | Payments: Stripe | State: React Query

ABSOLUTE RULES:
1. ALWAYS read a file BEFORE editing it — never edit blindly
2. Make MINIMAL surgical edits — never rewrite entire files
3. PRESERVE all existing imports, exports, and functionality
4. Include 3-5 lines of unchanged context in oldString to uniquely identify the edit location
5. Never modify .env, package.json, tsconfig.json, or config files
6. Never replace a working component with a generic placeholder
7. Never change default prop values unless the task explicitly requires it
8. Import only from packages already in the project
9. If you're unsure about a change, do LESS rather than MORE
10. After making edits, ALWAYS call validate_changes before finishing
11. If validation fails, fix the errors immediately — do not leave broken code

When you've completed the task successfully, respond with a brief summary of the changes you made.`;

// Execute a single agent tool call
function executeAgentTool(
  toolName: string,
  args: any,
  pageId: string,
  changedFiles: Map<string, { original: string | null; current: string }>,
  fileMap: { read: string[]; write: string[] },
  log: string[]
): string {
  try {
    switch (toolName) {
      case "read_file": {
        const filePath = (args.path || "").replace(/^[/\\]/, "");
        // If file was already edited in this session, return the current version
        if (changedFiles.has(filePath)) {
          const content = changedFiles.get(filePath)!.current;
          if (args.startLine && args.endLine) {
            const lines = content.split("\n");
            const start = Math.max(1, args.startLine) - 1;
            const end = Math.min(lines.length, args.endLine);
            return lines.slice(start, end).map((l: string, i: number) => `${start + i + 1}: ${l}`).join("\n");
          }
          log.push(`📖 Read (edited): ${filePath}`);
          return content.length > 12000
            ? content.slice(0, 12000) + `\n... (truncated, ${content.length} total chars. Use startLine/endLine for specific sections)`
            : content;
        }

        const content = readProjectFile(filePath);
        if (!content) return `ERROR: File not found: ${filePath}`;

        if (args.startLine && args.endLine) {
          const lines = content.split("\n");
          const start = Math.max(1, args.startLine) - 1;
          const end = Math.min(lines.length, args.endLine);
          return lines.slice(start, end).map((l: string, i: number) => `${start + i + 1}: ${l}`).join("\n");
        }

        log.push(`📖 Read: ${filePath} (${content.length} chars)`);
        return content.length > 12000
          ? content.slice(0, 12000) + `\n... (truncated, ${content.length} total chars. Use startLine/endLine for specific sections)`
          : content;
      }

      case "search_codebase": {
        const query = args.query || "";
        const searchRoot = args.filePattern
          ? path.join(PROJECT_ROOT, args.filePattern)
          : path.join(PROJECT_ROOT, "client", "src");
        const results: string[] = [];

        const searchDir = (dir: string) => {
          if (!fs.existsSync(dir) || results.length >= 25) return;
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (results.length >= 25) return;
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "dist") {
                searchDir(fullPath);
              } else if (entry.isFile() && /\.(tsx?|jsx?|css)$/.test(entry.name)) {
                try {
                  const content = fs.readFileSync(fullPath, "utf-8");
                  const lines = content.split("\n");
                  for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(query)) {
                      results.push(`${path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, "/")}:${i + 1}: ${lines[i].trim()}`);
                      if (results.length >= 25) return;
                    }
                  }
                } catch {}
              }
            }
          } catch {}
        }

        searchDir(searchRoot);
        // Also search server if we only searched client
        if (!args.filePattern || args.filePattern === "client/src") {
          searchDir(path.join(PROJECT_ROOT, "server"));
        }

        log.push(`🔍 Search: "${query}" → ${results.length} results`);
        return results.length > 0 ? results.join("\n") : `No results found for "${query}"`;
      }

      case "list_directory": {
        const dirPath = (args.path || "").replace(/^[/\\]/, "");
        const fullDir = path.join(PROJECT_ROOT, dirPath);
        if (!fs.existsSync(fullDir)) return `ERROR: Directory not found: ${dirPath}`;

        const entries = fs.readdirSync(fullDir, { withFileTypes: true });
        const items = entries
          .filter(e => !e.name.startsWith(".") && e.name !== "node_modules" && e.name !== "dist")
          .map(e => e.isDirectory() ? `${e.name}/` : e.name)
          .sort();
        log.push(`📂 List: ${dirPath} (${items.length} items)`);
        return items.join("\n");
      }

      case "edit_file": {
        const filePath = (args.path || "").replace(/^[/\\]/, "");

        // Security checks
        if (isFileProtected(filePath)) return `ERROR: Cannot modify protected file: ${filePath}`;
        if (!filePath.startsWith("client/src/") && !filePath.startsWith("server/") && !filePath.startsWith("shared/")) {
          return `ERROR: File outside allowed scope: ${filePath}. Only client/src/, server/, and shared/ are editable.`;
        }

        // Get current content (might have been edited already in this session)
        let current: string;
        if (changedFiles.has(filePath)) {
          current = changedFiles.get(filePath)!.current;
        } else {
          const original = readProjectFile(filePath);
          if (!original) return `ERROR: File not found: ${filePath}. Use create_file for new files.`;
          changedFiles.set(filePath, { original, current: original });
          current = original;
        }

        const oldString: string = args.oldString || "";
        const newString: string = args.newString || "";

        if (!oldString) return "ERROR: oldString cannot be empty";

        if (current.includes(oldString)) {
          // Exact match found
          const count = current.split(oldString).length - 1;
          if (count > 1) {
            return `ERROR: oldString matches ${count} locations in ${filePath}. Add more context lines to make it unique.`;
          }
          changedFiles.get(filePath)!.current = current.replace(oldString, newString);
          log.push(`✏️ Edit: ${filePath}${args.explanation ? ` (${args.explanation})` : ""}`);
          return `OK: Edited ${filePath}`;
        }

        // Try trimmed/whitespace-tolerant match
        const trimmedOld = oldString.trim();
        const currentLines = current.split("\n");
        const searchLines = trimmedOld.split("\n");
        let found = false;

        for (let i = 0; i <= currentLines.length - searchLines.length; i++) {
          const slice = currentLines.slice(i, i + searchLines.length).join("\n");
          if (slice.trim() === trimmedOld) {
            changedFiles.get(filePath)!.current = current.replace(slice, newString);
            found = true;
            log.push(`✏️ Edit (fuzzy): ${filePath}${args.explanation ? ` (${args.explanation})` : ""}`);
            return `OK: Edited ${filePath} (fuzzy whitespace match)`;
          }
        }

        return `ERROR: oldString not found in ${filePath}. Read the file again to get the exact current content. First 150 chars of oldString searched: "${oldString.slice(0, 150)}"`;
      }

      case "create_file": {
        const filePath = (args.path || "").replace(/^[/\\]/, "");
        if (isFileProtected(filePath)) return `ERROR: Cannot create protected file: ${filePath}`;
        if (readProjectFile(filePath) || changedFiles.has(filePath)) {
          return `ERROR: File already exists: ${filePath}. Use edit_file to modify it.`;
        }
        changedFiles.set(filePath, { original: null, current: args.content || "" });
        log.push(`📝 Create: ${filePath}`);
        return `OK: Created ${filePath}`;
      }

      case "validate_changes": {
        if (changedFiles.size === 0) return "No files have been changed yet.";

        const errors: string[] = [];
        for (const [filePath, { current }] of Array.from(changedFiles.entries())) {
          if (!filePath.match(/\.(ts|tsx)$/)) continue;
          try {
            esbuild.transformSync(current, {
              loader: filePath.endsWith(".tsx") ? "tsx" as const : "ts" as const,
              jsx: "automatic",
              logLevel: "silent",
              format: "esm",
            });
          } catch (err: any) {
            const errorMsg = err.errors
              ?.map((e: any) => `${filePath}:${e.location?.line}: ${e.text}`)
              .join("\n") || err.message;
            errors.push(errorMsg);
          }
        }

        // Also check import integrity
        for (const [filePath, { current }] of Array.from(changedFiles.entries())) {
          const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
          let m;
          while ((m = importRegex.exec(current)) !== null) {
            if (!m[1].startsWith(".")) continue;
            const dir = path.dirname(filePath);
            const resolved = path.posix.join(dir.replace(/\\/g, "/"), m[1]);
            const extensions = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];
            const exists = extensions.some(ext => {
              const candidate = path.join(PROJECT_ROOT, resolved + ext);
              return fs.existsSync(candidate);
            });
            if (!exists && !changedFiles.has(resolved + ".tsx") && !changedFiles.has(resolved + ".ts")) {
              errors.push(`${filePath}: Broken import "${m[1]}" — file does not exist`);
            }
          }
        }

        if (errors.length > 0) {
          log.push(`❌ Validation: ${errors.length} error(s)`);
          return `VALIDATION ERRORS (fix these before finishing):\n${errors.join("\n")}`;
        }

        log.push(`✅ Validation: all ${changedFiles.size} file(s) passed`);
        return `OK: All ${changedFiles.size} changed file(s) pass syntax and import validation.`;
      }

      default:
        return `ERROR: Unknown tool: ${toolName}`;
    }
  } catch (err: any) {
    log.push(`💥 Tool error (${toolName}): ${err.message}`);
    return `ERROR: ${err.message}`;
  }
}

// Call AI with function calling (OpenAI-compatible format)
async function callAIWithTools(
  systemPrompt: string,
  messages: AgentMessage[],
  tools: any[],
  apiUrl: string,
  apiKey: string,
  model: string,
  providerName: string
): Promise<{ message: AgentMessage; provider: string; latencyMs: number }> {
  const start = Date.now();
  const body: any = {
    model,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    max_tokens: 16000,
    temperature: 0.1,
  };
  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  // Rate-limit-aware retry with exponential backoff
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status === 429) {
      // Rate limited — extract wait time or use exponential backoff
      const retryAfter = response.headers.get("retry-after");
      const errorBody = await response.text();
      const waitMatch = errorBody.match(/wait (\d+) seconds/i) || errorBody.match(/(\d+)s/);
      const waitSec = retryAfter ? parseInt(retryAfter) : waitMatch ? parseInt(waitMatch[1]) : (10 * Math.pow(2, attempt));
      const waitMs = Math.min(waitSec * 1000, 120000); // Cap at 2 minutes
      console.warn(`⏳ [CodeEngine] Rate limited by ${providerName}, waiting ${waitSec}s (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`);
      lastError = new Error(`${providerName} 429: Rate limited. Waited ${waitSec}s.`);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw new Error(`${providerName} 429: Rate limit exceeded after ${MAX_RETRIES + 1} attempts. ${errorBody.slice(0, 200)}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${providerName} ${response.status}: ${errorText.slice(0, 300)}`);
    }

    const data = await response.json() as any;
    const choice = data.choices?.[0];
    if (!choice) throw new Error(`${providerName}: No choices in response`);

    return {
      message: {
        role: "assistant",
        content: choice.message.content || null,
        tool_calls: choice.message.tool_calls || undefined,
      },
      provider: providerName,
      latencyMs: Date.now() - start,
    };
  }

  throw lastError || new Error(`${providerName}: All retry attempts exhausted`);
}

// ─── SSE Event Emitter for Real-Time Agent Progress ─────────────
type AgentEventCallback = (event: string, data: any) => void;

// ─── Get completed tasks per page (from execution logs) ─────────
function getCompletedTasks(pageId?: string): { pageId: string; task: string; commitHash?: string; timestamp: string }[] {
  const logs = getExecutionLogs();
  return logs
    .filter(l => (l.status === "committed" || l.status === "applied") && (!pageId || l.pageId === pageId))
    .map(l => ({ pageId: l.pageId, task: l.task, commitHash: l.commitHash, timestamp: l.timestamp }));
}

// ─── The Agent Loop — core agentic execution ────────────────────
async function runAgentLoop(
  pageId: string,
  task: string,
  priority: string,
  onEvent?: AgentEventCallback
): Promise<AgentResult> {
  const emit = onEvent || (() => {});
  const fileMap = PAGE_FILE_MAP[pageId];
  if (!fileMap) throw new Error(`Unknown page: ${pageId}`);

  const log: string[] = [];
  const changedFiles = new Map<string, { original: string | null; current: string }>();
  const messages: AgentMessage[] = [];
  let totalToolCalls = 0;
  const MAX_ITERATIONS = 20;

  // Build initial context — give the agent a map of available files
  const smartContext = buildSmartContext(pageId);

  let taskPrompt = `TASK: ${task}\nPRIORITY: ${priority}\nPAGE: ${pageId}\n\n`;
  taskPrompt += `AVAILABLE FILES FOR THIS PAGE:\n`;
  for (const f of smartContext) {
    taskPrompt += `- ${f.path} [${f.role}] (${f.content.length} chars)\n`;
  }
  taskPrompt += `\nWRITABLE FILES (you may edit these):\n${fileMap.write.map(f => `- ${f}`).join("\n")}\n\n`;
  taskPrompt += `INSTRUCTIONS:\n`;
  taskPrompt += `1. Start by reading the relevant file(s) to understand the current code\n`;
  taskPrompt += `2. If you need to find how something is used, search the codebase\n`;
  taskPrompt += `3. Make your edits surgically using edit_file\n`;
  taskPrompt += `4. After all edits, call validate_changes\n`;
  taskPrompt += `5. If validation fails, fix the errors and validate again\n`;
  taskPrompt += `6. When done, respond with a summary of your changes\n`;

  messages.push({ role: "user", content: taskPrompt });

  log.push(`🤖 Agent started: "${task}" for ${pageId}`);
  log.push(`📚 Context: ${smartContext.length} files discovered`);
  emit("status", { phase: "init", message: `Agent started for ${pageId}`, filesDiscovered: smartContext.length });

  // Select provider(s) — supports fallback rotation on rate limit errors
  const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
  const copilotToken = process.env.COPILOT_API_KEY || process.env.GITHUB_COPILOT_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;

  interface ProviderConfig { apiUrl: string; apiKey: string; model: string; name: string }
  const availableProviders: ProviderConfig[] = [];

  if (githubToken) {
    availableProviders.push({
      apiUrl: "https://models.inference.ai.azure.com/chat/completions",
      apiKey: githubToken, model: PRIMARY_MODEL, name: "github-models",
    });
  }
  if (copilotToken) {
    availableProviders.push({
      apiUrl: process.env.COPILOT_API_URL || "https://api.githubcopilot.com/chat/completions",
      apiKey: copilotToken, model: PRIMARY_MODEL, name: "copilot",
    });
  }
  if (openaiKey) {
    availableProviders.push({
      apiUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: openaiKey, model: PRIMARY_MODEL, name: "openai",
    });
  }

  if (availableProviders.length === 0) {
    throw new Error("Agent mode requires function calling support. Set GITHUB_TOKEN, COPILOT_API_KEY, or OPENAI_API_KEY.");
  }

  let providerIdx = 0;
  let apiUrl = availableProviders[providerIdx].apiUrl;
  let apiKey = availableProviders[providerIdx].apiKey;
  let model = availableProviders[providerIdx].model;
  let providerName = availableProviders[providerIdx].name;

  // Function to rotate to next provider on rate limit
  const rotateProvider = (): boolean => {
    if (availableProviders.length <= 1) return false;
    providerIdx = (providerIdx + 1) % availableProviders.length;
    const next = availableProviders[providerIdx];
    apiUrl = next.apiUrl;
    apiKey = next.apiKey;
    model = next.model;
    providerName = next.name;
    log.push(`🔄 Rotated to provider: ${providerName}`);
    emit("status", { phase: "provider-rotation", message: `Switched to ${providerName} (rate limit)` });
    return true;
  };

  log.push(`🔌 Provider: ${providerName} (${model})`);
  emit("status", { phase: "provider", message: `Using ${providerName} (${model})` });

  // ── Main Agent Loop ──
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    log.push(`\n--- Iteration ${i + 1}/${MAX_ITERATIONS} ---`);
    emit("iteration", { current: i + 1, max: MAX_ITERATIONS });

    let response: Awaited<ReturnType<typeof callAIWithTools>>;
    try {
      response = await callAIWithTools(
        AGENT_SYSTEM_PROMPT, messages, AGENT_TOOLS_OPENAI, apiUrl, apiKey, model, providerName
      );
    } catch (err: any) {
      // On rate limit (429), try rotating to another provider
      if (err.message?.includes("429") && rotateProvider()) {
        log.push(`⚠️ Rate limited on previous provider, retrying with ${providerName}...`);
        emit("status", { phase: "rate-limit-retry", message: `Rate limited, retrying with ${providerName}` });
        i--; // Don't consume an iteration for the rate limit
        continue;
      }
      // Re-throw if can't recover
      emit("error_event", { message: err.message });
      throw err;
    }

    log.push(`🤖 Response (${response.latencyMs}ms)`);
    emit("thinking", { latencyMs: response.latencyMs });
    messages.push(response.message);

    // If no tool calls, the agent is done
    if (!response.message.tool_calls || response.message.tool_calls.length === 0) {
      log.push(`\n✅ Agent finished after ${i + 1} iterations, ${totalToolCalls} tool calls`);
      if (response.message.content) {
        log.push(`📋 Summary: ${response.message.content.slice(0, 500)}`);
        emit("summary", { text: response.message.content.slice(0, 500), iterations: i + 1, toolCalls: totalToolCalls });
      }
      break;
    }

    // Execute each tool call
    for (const toolCall of response.message.tool_calls) {
      totalToolCalls++;
      let fnArgs: any;
      try {
        fnArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        fnArgs = {};
      }

      emit("tool_call", {
        tool: toolCall.function.name,
        args: fnArgs,
        callNumber: totalToolCalls,
      });

      const result = executeAgentTool(
        toolCall.function.name, fnArgs, pageId, changedFiles, fileMap, log
      );

      emit("tool_result", {
        tool: toolCall.function.name,
        success: !result.startsWith("ERROR"),
        preview: result.slice(0, 200),
      });

      messages.push({
        role: "tool",
        content: result,
        tool_call_id: toolCall.id,
      });
    }
  }

  // ── Post-loop: Apply & Validate all changes ──
  if (changedFiles.size === 0) {
    log.push(`ℹ️ No file changes made by agent`);
    emit("done", { success: true, filesChanged: 0, message: "No file changes needed" });
    return {
      success: true, filesChanged: [], iterations: messages.length,
      toolCallsTotal: totalToolCalls, log, provider: providerName, model,
    };
  }

  const filePaths = Array.from(changedFiles.keys());
  const backup = gitBackup(filePaths);

  emit("status", { phase: "applying", message: `Writing ${filePaths.length} file(s) to disk...`, files: filePaths });

  // Write all changes to disk
  for (const [fp, { current }] of Array.from(changedFiles.entries())) {
    writeProjectFile(fp, current);
  }

  // Deep validation
  const changes: FileChange[] = Array.from(changedFiles.entries()).map(([fp, { original, current }]) => ({
    filePath: fp,
    action: (original === null ? "create" : "modify") as "create" | "modify",
    content: current,
    originalContent: original,
    edits: [],
  }));

  const validation = deepValidateChanges(filePaths, backup, changes);

  if (!validation.success) {
    log.push(`\n❌ Post-loop validation failed (${validation.phase}): ${validation.errors}`);
    emit("status", { phase: "validation-failed", message: `Validation failed (${validation.phase}), retrying...`, errors: validation.errors.slice(0, 300) });

    // RETRY: Rollback, send error to agent, let it fix
    gitRollback(backup);

    // Reset changed files state
    for (const [fp] of Array.from(changedFiles.entries())) {
      const original = readProjectFile(fp);
      changedFiles.set(fp, { original, current: original || "" });
    }

    messages.push({
      role: "user",
      content: `VALIDATION FAILED after your edits!\nPhase: ${validation.phase}\nErrors:\n${validation.errors}\n\nPlease fix these errors. Read the affected files again to see their current state, then make corrective edits and call validate_changes.`,
    });

    log.push(`🔄 Retry cycle: sending errors back to agent`);

    // Give agent up to 8 more iterations to fix
    for (let retry = 0; retry < 8; retry++) {
      const response = await callAIWithTools(
        AGENT_SYSTEM_PROMPT, messages, AGENT_TOOLS_OPENAI, apiUrl, apiKey, model, providerName
      );
      messages.push(response.message);

      if (!response.message.tool_calls || response.message.tool_calls.length === 0) {
        break;
      }

      for (const toolCall of response.message.tool_calls) {
        totalToolCalls++;
        let fnArgs: any;
        try { fnArgs = JSON.parse(toolCall.function.arguments); } catch { fnArgs = {}; }
        const result = executeAgentTool(toolCall.function.name, fnArgs, pageId, changedFiles, fileMap, log);
        messages.push({ role: "tool", content: result, tool_call_id: toolCall.id });
      }
    }

    // Apply retry changes
    const retryFilePaths = Array.from(changedFiles.keys());
    const retryBackup = gitBackup(retryFilePaths);
    for (const [fp, { current }] of Array.from(changedFiles.entries())) {
      writeProjectFile(fp, current);
    }

    const retryChanges: FileChange[] = Array.from(changedFiles.entries()).map(([fp, { original, current }]) => ({
      filePath: fp,
      action: (original === null ? "create" : "modify") as "create" | "modify",
      content: current, originalContent: original, edits: [],
    }));

    const retryValidation = deepValidateChanges(retryFilePaths, retryBackup, retryChanges);
    if (!retryValidation.success) {
      gitRollback(retryBackup);
      log.push(`❌ Retry also failed (${retryValidation.phase}): ${retryValidation.errors}`);
      log.push(`🔙 All changes rolled back`);
      emit("done", { success: false, message: "Validation failed after retry, rolled back" });
      return {
        success: false, filesChanged: [], iterations: messages.length,
        toolCallsTotal: totalToolCalls, error: `Validation failed after retry: ${retryValidation.errors}`,
        log, provider: providerName, model,
      };
    }

    log.push(`✅ Retry validation passed!`);
    filePaths.length = 0;
    filePaths.push(...retryFilePaths);
  }

  // Git commit
  let commitHash: string | undefined;
  try {
    commitHash = gitCommit(`[CodeEngine Agent] ${task} (${pageId})`, filePaths);
    log.push(`✅ Committed: ${commitHash}`);
    emit("done", { success: true, filesChanged: filePaths.length, commitHash, files: filePaths });
  } catch (err: any) {
    log.push(`⚠️ Git commit failed (changes still applied): ${err.message}`);
    emit("done", { success: true, filesChanged: filePaths.length, message: "Applied but commit failed" });
  }

  saveExecutionLog({
    id: `agent_${Date.now()}`, timestamp: new Date().toISOString(),
    pageId, task, status: commitHash ? "committed" : "applied",
    model, provider: providerName, filesChanged: filePaths, commitHash,
  });

  return {
    success: true, filesChanged: filePaths, iterations: messages.length,
    toolCallsTotal: totalToolCalls, commitHash, log, provider: providerName, model,
  };
}

// ─── Execution Log ──────────────────────────────────────────────
interface ExecutionLog {
  id: string;
  timestamp: string;
  pageId: string;
  task: string;
  status: "preview" | "applied" | "committed" | "rolled-back" | "failed";
  model: string;
  provider: string;
  filesChanged: string[];
  commitHash?: string;
  error?: string;
  diff?: string;
}

function saveExecutionLog(log: ExecutionLog): void {
  const filepath = path.join(ENGINE_LOG_DIR, `${log.id}.json`);
  fs.writeFileSync(filepath, JSON.stringify(log, null, 2), "utf-8");
}

function getExecutionLogs(): ExecutionLog[] {
  if (!fs.existsSync(ENGINE_LOG_DIR)) return [];
  return fs.readdirSync(ENGINE_LOG_DIR)
    .filter(f => f.endsWith(".json"))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 50)
    .map(f => JSON.parse(fs.readFileSync(path.join(ENGINE_LOG_DIR, f), "utf-8")));
}

// ─── POST /api/admin/code-engine/preview ────────────────────────
// Generate a preview of changes WITHOUT applying them
router.post("/preview", async (req: Request, res: Response) => {
  try {
    const { pageId, task, priority, implementationPrompt, mode } = req.body;
    if (!pageId || !task) {
      return res.status(400).json({ success: false, error: "pageId and task are required" });
    }

    const acquired = await acquirePageLock(pageId, task);
    if (!acquired) {
      return res.status(409).json({ success: false, error: `Page ${pageId} queue is full. Try again.` });
    }

    try {
      const fileMap = PAGE_FILE_MAP[pageId];
      if (!fileMap) {
        return res.status(400).json({ success: false, error: `Unknown page: ${pageId}` });
      }

      // Smart context: primary files + discovered imports
      const smartContext = buildSmartContext(pageId);

      const userPrompt = `TASK: ${task}
PRIORITY: ${priority || "high"}
PAGE: ${pageId}

WRITABLE FILES (you may create/modify these):
${fileMap.write.join("\n")}

CURRENT CODEBASE CONTEXT (with import-resolved dependencies):
${smartContext.map(f => `\n--- FILE: ${f.path} [${f.role}] ---\n${f.content}\n--- END ---`).join("\n")}

${implementationPrompt ? `\nDETAILED IMPLEMENTATION GUIDE:\n${implementationPrompt}` : ""}

Use SEARCH/REPLACE blocks for existing files. Only create new files when needed.`;

      console.log(`🔧 [CodeEngine] Preview request: "${task}" for ${pageId}`);
      const aiResponse = await callAI(SYSTEM_PROMPT, userPrompt, mode === "fallback" ? "fallback" : "race");

      const changes = parseAIResponse(aiResponse.content);

      if (changes.length === 0) {
        return res.status(400).json({
          success: false,
          error: "AI response did not contain any valid file changes.",
          rawResponse: aiResponse.content.slice(0, 2000),
        });
      }

      const protectedAttempts = changes.filter(c => isFileProtected(c.filePath));
      if (protectedAttempts.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot modify protected files: ${protectedAttempts.map(c => c.filePath).join(", ")}`,
        });
      }

      const diffs = changes.map(c => ({
        filePath: c.filePath,
        action: c.action,
        diff: generateDiff(c.originalContent, c.content, c.filePath),
        linesAdded: c.content.split("\n").filter((l, i) => !c.originalContent || c.originalContent.split("\n")[i] !== l).length,
        linesRemoved: c.originalContent ? c.originalContent.split("\n").filter((l, i) => c.content.split("\n")[i] !== l).length : 0,
        editsCount: c.edits.length,
      }));

      const logId = `preview_${Date.now()}`;
      saveExecutionLog({
        id: logId,
        timestamp: new Date().toISOString(),
        pageId, task, status: "preview",
        model: aiResponse.model, provider: aiResponse.provider,
        filesChanged: changes.map(c => c.filePath),
        diff: diffs.map(d => d.diff).join("\n\n"),
      });

      res.json({
        success: true,
        previewId: logId,
        model: aiResponse.model,
        provider: aiResponse.provider,
        tokensUsed: aiResponse.tokensUsed,
        latencyMs: aiResponse.latencyMs,
        changes: diffs,
        filesAffected: changes.length,
        rawChanges: changes.map(c => ({ filePath: c.filePath, action: c.action, content: c.content })),
      });
    } finally {
      releasePageLock(pageId);
    }
  } catch (err: any) {
    console.error("[CodeEngine] Preview error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/admin/code-engine/apply ──────────────────────────
router.post("/apply", async (req: Request, res: Response) => {
  try {
    const { previewId, changes, task, pageId, autoCommit = true } = req.body;
    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ success: false, error: "No changes to apply" });
    }

    const pid = pageId || "unknown";
    const acquired = await acquirePageLock(pid, task || "Applying changes");
    if (!acquired) {
      return res.status(409).json({ success: false, error: "Page is busy. Try again." });
    }

    try {
      for (const change of changes) {
        if (isFileProtected(change.filePath)) {
          return res.status(400).json({ success: false, error: `Cannot modify protected file: ${change.filePath}` });
        }
      }

      const filePaths = changes.map((c: any) => c.filePath);

      // Acquire file-level locks
      if (!acquireFileLocks(filePaths)) {
        return res.status(409).json({ success: false, error: "Some files are being modified by another task. Try again." });
      }

      try {
        const backup = gitBackup(filePaths);
        console.log(`🔧 [CodeEngine] Applying ${changes.length} file changes for ${pid}...`);

        for (const change of changes) {
          writeProjectFile(change.filePath, change.content);
          console.log(`  ✏️ ${change.action}: ${change.filePath}`);
        }

        console.log("⚡ [CodeEngine] Deep validation (4 phases)...");
        const fileChanges: FileChange[] = changes.map((c: any) => ({
          filePath: c.filePath,
          action: c.action || "modify",
          content: c.content,
          originalContent: backup.get(c.filePath) || null,
          edits: [],
        }));
        const validation = deepValidateChanges(filePaths, backup, fileChanges);

        if (!validation.success) {
          console.log(`❌ [CodeEngine] Validation failed (${validation.phase}), rolling back...`);
          gitRollback(backup);

          const logId = `failed_${Date.now()}`;
          saveExecutionLog({
            id: logId, timestamp: new Date().toISOString(),
            pageId: pid, task: task || "unknown", status: "rolled-back",
            model: "n/a", provider: "n/a", filesChanged: filePaths, error: validation.errors,
          });

          return res.json({
            success: false, status: "rolled-back",
            error: `Validation failed (${validation.phase}). Changes rolled back.`,
            tsErrors: validation.errors, logId,
            severity: validation.severity,
          });
        }

        let commitHash: string | undefined;
        if (autoCommit) {
          try {
            const commitMsg = `[CodeEngine] ${task || "Auto-improvement"} (${pid})`;
            commitHash = gitCommit(commitMsg, filePaths);
            console.log(`✅ [CodeEngine] Committed: ${commitHash}`);
          } catch (gitErr: any) {
            console.warn("[CodeEngine] Git commit failed (changes still applied):", gitErr.message);
          }
        }

        const logId = `applied_${Date.now()}`;
        saveExecutionLog({
          id: logId, timestamp: new Date().toISOString(),
          pageId: pid, task: task || "unknown", status: commitHash ? "committed" : "applied",
          model: "n/a", provider: "n/a", filesChanged: filePaths, commitHash,
        });

        res.json({
          success: true, status: commitHash ? "committed" : "applied", commitHash,
          filesChanged: filePaths,
          fileDetails: changes.map((c: any) => ({ filePath: c.filePath, action: c.action || "modify", size: c.content?.length || 0 })),
          logId,
          message: commitHash
            ? `✅ ${filePaths.length} file(s) modified and committed (${commitHash})`
            : `✅ ${filePaths.length} file(s) modified (not committed)`,
        });
      } finally {
        releaseFileLocks(filePaths);
      }
    } finally {
      releasePageLock(pid);
    }
  } catch (err: any) {
    console.error("[CodeEngine] Apply error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/admin/code-engine/agent-execute ──────────────────
// AGENT MODE: Full agentic loop with tool calling (like VSCode agent)
// The AI reads files, searches codebase, makes surgical edits, validates, and self-corrects
router.post("/agent-execute", async (req: Request, res: Response) => {
  try {
    const { pageId, task, priority = "high" } = req.body;
    if (!pageId || !task) {
      return res.status(400).json({ success: false, error: "pageId and task are required" });
    }

    const acquired = await acquirePageLock(pageId, task);
    if (!acquired) {
      return res.status(409).json({ success: false, error: `Page ${pageId} queue is full. Try again.` });
    }

    try {
      console.log(`🤖 [CodeEngine] Agent execute: "${task}" for ${pageId}`);
      const result = await runAgentLoop(pageId, task, priority);

      const logId = `agent_${Date.now()}`;
      saveExecutionLog({
        id: logId,
        timestamp: new Date().toISOString(),
        pageId, task,
        status: result.success ? (result.commitHash ? "committed" : "applied") : "failed",
        model: result.model, provider: result.provider,
        filesChanged: result.filesChanged,
        commitHash: result.commitHash,
        error: result.error,
      });

      res.json({
        success: result.success,
        mode: "agent",
        pageId,
        task,
        filesChanged: result.filesChanged,
        commitHash: result.commitHash,
        iterations: result.iterations,
        toolCalls: result.toolCallsTotal,
        provider: result.provider,
        model: result.model,
        error: result.error,
        log: result.log,
        logId,
      });
    } finally {
      releasePageLock(pageId);
    }
  } catch (err: any) {
    console.error("[CodeEngine] Agent execute error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/admin/code-engine/agent-stream ────────────────────
// SSE endpoint: streams real-time agent progress to the frontend
router.get("/agent-stream", async (req: Request, res: Response) => {
  const { pageId, task, priority } = req.query as { pageId: string; task: string; priority?: string };
  if (!pageId || !task) {
    return res.status(400).json({ success: false, error: "pageId and task query params required" });
  }

  // Set up SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent("status", { phase: "connecting", message: "Acquiring lock..." });

  const acquired = await acquirePageLock(pageId, task);
  if (!acquired) {
    sendEvent("error", { message: `Page ${pageId} queue is full` });
    sendEvent("done", { success: false });
    res.end();
    return;
  }

  try {
    sendEvent("status", { phase: "starting", message: "Agent loop starting..." });

    const result = await runAgentLoop(pageId, task, priority || "high", (event, data) => {
      sendEvent(event, data);
    });

    const logId = `agent_${Date.now()}`;
    saveExecutionLog({
      id: logId, timestamp: new Date().toISOString(),
      pageId, task,
      status: result.success ? (result.commitHash ? "committed" : "applied") : "failed",
      model: result.model, provider: result.provider,
      filesChanged: result.filesChanged, commitHash: result.commitHash, error: result.error,
    });

    sendEvent("complete", {
      success: result.success,
      filesChanged: result.filesChanged,
      commitHash: result.commitHash,
      iterations: result.iterations,
      toolCalls: result.toolCallsTotal,
      provider: result.provider,
      model: result.model,
      error: result.error,
      logId,
    });
  } catch (err: any) {
    console.error("[CodeEngine] Agent stream error:", err.message);
    sendEvent("error", { message: err.message });
  } finally {
    releasePageLock(pageId);
    res.end();
  }
});

// ─── GET /api/admin/code-engine/completed-tasks ─────────────────
// Returns tasks already completed by the engine (persisted in logs)
router.get("/completed-tasks", (req: Request, res: Response) => {
  try {
    const { pageId } = req.query as { pageId?: string };
    const completed = getCompletedTasks(pageId);
    res.json({ success: true, completed });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/admin/code-engine/batch-execute ──────────────────
// Execute multiple tasks for a page using agent mode (iterative tool-calling loop)
router.post("/batch-execute", async (req: Request, res: Response) => {
  try {
    const { pageId, tasks, useAgentMode = true } = req.body;
    if (!pageId || !tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ success: false, error: "pageId and tasks[] required" });
    }

    const results: Array<{ task: string; status: string; commitHash?: string; error?: string; latencyMs?: number; toolCalls?: number }> = [];
    console.log(`🚀 [CodeEngine] Batch execute: ${tasks.length} tasks for ${pageId} (agent mode: ${useAgentMode})`);

    for (const taskItem of tasks) {
      const taskName = typeof taskItem === "string" ? taskItem : taskItem.task;
      const priority = typeof taskItem === "string" ? "high" : taskItem.priority || "high";
      const startTime = Date.now();

      try {
        if (useAgentMode) {
          // Agent mode: full iterative tool-calling loop
          const acquired = await acquirePageLock(pageId, taskName);
          if (!acquired) {
            results.push({ task: taskName, status: "skipped", error: "Could not acquire lock" });
            continue;
          }

          try {
            const agentResult = await runAgentLoop(pageId, taskName, priority);
            results.push({
              task: taskName,
              status: agentResult.success ? "applied" : "failed",
              commitHash: agentResult.commitHash,
              error: agentResult.error,
              latencyMs: Date.now() - startTime,
              toolCalls: agentResult.toolCallsTotal,
            });
          } finally {
            releasePageLock(pageId);
          }
        } else {
          // Legacy single-shot mode (fallback)
          const acquired = await acquirePageLock(pageId, taskName);
          if (!acquired) {
            results.push({ task: taskName, status: "skipped", error: "Could not acquire lock" });
            continue;
          }

          try {
            const fileMap = PAGE_FILE_MAP[pageId];
            if (!fileMap) { results.push({ task: taskName, status: "error", error: "Unknown page" }); continue; }

            const smartContext = buildSmartContext(pageId);
            const aiResponse = await callAI(SYSTEM_PROMPT, `TASK: ${taskName}\nPRIORITY: ${priority}\nPAGE: ${pageId}\n\nWRITABLE FILES:\n${fileMap.write.join("\n")}\n\nCONTEXT:\n${smartContext.map(f => `--- ${f.path} [${f.role}] ---\n${f.content}\n--- END ---`).join("\n")}`, "race");

            const changes = parseAIResponse(aiResponse.content);
            if (changes.length === 0) {
              results.push({ task: taskName, status: "no-changes", latencyMs: Date.now() - startTime });
              continue;
            }

            const filePaths = changes.map(c => c.filePath);
            if (!acquireFileLocks(filePaths)) {
              results.push({ task: taskName, status: "skipped", error: "File lock conflict" });
              continue;
            }

            try {
              const backup = gitBackup(filePaths);
              for (const c of changes) writeProjectFile(c.filePath, c.content);

              const validation = deepValidateChanges(filePaths, backup, changes);
              if (!validation.success) {
                gitRollback(backup);
                results.push({ task: taskName, status: "failed", error: validation.errors.slice(0, 500), latencyMs: Date.now() - startTime });
                continue;
              }

              let commitHash: string | undefined;
              try { commitHash = gitCommit(`[CodeEngine] ${taskName} (${pageId})`, filePaths); } catch {}

              results.push({ task: taskName, status: "applied", commitHash, latencyMs: Date.now() - startTime });
            } finally {
              releaseFileLocks(filePaths);
            }
          } finally {
            releasePageLock(pageId);
          }
        }
      } catch (err: any) {
        results.push({ task: taskName, status: "error", error: err.message.slice(0, 300), latencyMs: Date.now() - startTime });
      }
    }

    const applied = results.filter(r => r.status === "applied").length;
    const failed = results.filter(r => r.status === "failed" || r.status === "error").length;
    console.log(`✅ [CodeEngine] Batch complete: ${applied}/${tasks.length} applied, ${failed} failed`);

    res.json({
      success: true,
      pageId,
      totalTasks: tasks.length,
      applied, failed,
      skipped: results.filter(r => r.status === "skipped" || r.status === "no-changes").length,
      results,
    });
  } catch (err: any) {
    console.error("[CodeEngine] Batch error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/admin/code-engine/auto-execute-all ───────────────
// Execute ALL improvements for ALL pages in parallel using agent mode
router.post("/auto-execute-all", async (req: Request, res: Response) => {
  try {
    const { useAgentMode = true } = req.body;

    const allPages = Object.keys(PAGE_FILE_MAP);
    console.log(`🚀🚀 [CodeEngine] AUTO-EXECUTE ALL: ${allPages.length} pages (agent: ${useAgentMode})`);

    // Fire all pages in parallel
    const pagePromises = allPages.map(async (pageId) => {
      try {
        // Fetch page diagnostics
        const diagRes = await fetch(`http://localhost:${process.env.PORT || 3000}/api/admin/reports/diagnostics/${pageId}`);
        if (!diagRes.ok) return { pageId, status: "skipped", reason: "No diagnostics" };
        const diagData = await diagRes.json() as any;
        if (!diagData.success || !diagData.diagnostic?.improvements?.length) {
          return { pageId, status: "no-improvements", tasks: 0 };
        }

        const tasks = diagData.diagnostic.improvements.map((imp: any) => ({
          task: imp.task,
          priority: imp.priority,
        }));

        // Execute tasks for this page sequentially using agent mode
        const results: Array<{ task: string; status: string; toolCalls?: number }> = [];
        for (const taskItem of tasks) {
          const acquired = await acquirePageLock(pageId, taskItem.task);
          if (!acquired) { results.push({ task: taskItem.task, status: "skipped" }); continue; }

          try {
            if (useAgentMode) {
              const agentResult = await runAgentLoop(pageId, taskItem.task, taskItem.priority);
              results.push({
                task: taskItem.task,
                status: agentResult.success ? "applied" : "failed",
                toolCalls: agentResult.toolCallsTotal,
              });
            } else {
              // Legacy single-shot fallback
              const fileMap = PAGE_FILE_MAP[pageId];
              if (!fileMap) { results.push({ task: taskItem.task, status: "error" }); continue; }

              const smartContext = buildSmartContext(pageId);
              const aiResponse = await callAI(SYSTEM_PROMPT, `TASK: ${taskItem.task}\nPRIORITY: ${taskItem.priority}\nPAGE: ${pageId}\n\nWRITABLE FILES:\n${fileMap.write.join("\n")}\n\nCONTEXT:\n${smartContext.map(f => `--- ${f.path} [${f.role}] ---\n${f.content}\n--- END ---`).join("\n")}`, "race");

              const changes = parseAIResponse(aiResponse.content);
              if (changes.length === 0) { results.push({ task: taskItem.task, status: "no-changes" }); continue; }

              const filePaths = changes.map(c => c.filePath);
              if (!acquireFileLocks(filePaths)) { results.push({ task: taskItem.task, status: "file-locked" }); continue; }

              try {
                const backup = gitBackup(filePaths);
                for (const c of changes) writeProjectFile(c.filePath, c.content);

                const validation = deepValidateChanges(filePaths, backup, changes);
                if (!validation.success) {
                  gitRollback(backup);
                  results.push({ task: taskItem.task, status: "failed" });
                  continue;
                }

                try { gitCommit(`[CodeEngine] ${taskItem.task} (${pageId})`, filePaths); } catch {}
                results.push({ task: taskItem.task, status: "applied" });
              } finally {
                releaseFileLocks(filePaths);
              }
            }
          } finally {
            releasePageLock(pageId);
          }
        }

        const applied = results.filter(r => r.status === "applied").length;
        return { pageId, status: "done", total: tasks.length, applied, failed: tasks.length - applied, results };
      } catch (err: any) {
        return { pageId, status: "error", error: err.message.slice(0, 200) };
      }
    });

    const pageResults = await Promise.all(pagePromises);
    const totalApplied = pageResults.reduce((s, p: any) => s + (p.applied || 0), 0);
    const totalTasks = pageResults.reduce((s, p: any) => s + (p.total || 0), 0);

    console.log(`🏁 [CodeEngine] AUTO-EXECUTE ALL complete: ${totalApplied}/${totalTasks} applied across ${allPages.length} pages`);

    res.json({
      success: true,
      totalPages: allPages.length,
      totalTasks, totalApplied,
      pages: pageResults,
    });
  } catch (err: any) {
    console.error("[CodeEngine] Auto-execute error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/admin/code-engine/rollback ───────────────────────
router.post("/rollback", async (req: Request, res: Response) => {
  try {
    const { commitHash } = req.body;
    if (!commitHash) {
      return res.status(400).json({ success: false, error: "commitHash required" });
    }

    execSync(`git revert --no-commit ${commitHash}`, { cwd: PROJECT_ROOT, stdio: "pipe" });
    execSync(`git commit -m "[CodeEngine] Reverted: ${commitHash}"`, { cwd: PROJECT_ROOT, stdio: "pipe" });

    const newHash = execSync("git rev-parse --short HEAD", { cwd: PROJECT_ROOT, stdio: "pipe" }).toString().trim();
    console.log(`↩️ [CodeEngine] Reverted ${commitHash} → new commit: ${newHash}`);

    res.json({ success: true, revertedCommit: commitHash, newCommit: newHash });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/admin/code-engine/status ──────────────────────────
router.get("/status", (_req: Request, res: Response) => {
  const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
  const copilotToken = process.env.COPILOT_API_KEY || process.env.GITHUB_COPILOT_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const global = getGlobalStatus();

  const availableCount = [githubToken, copilotToken, anthropicKey, openaiKey].filter(Boolean).length;

  res.json({
    success: true,
    // Parallel execution status
    execution: global,
    // Provider info
    providers: {
      "github-models": { available: !!githubToken, model: PRIMARY_MODEL, priority: 1, note: "Free via GitHub PAT" },
      copilot: { available: !!copilotToken, model: PRIMARY_MODEL, priority: 2, note: "Copilot API — higher rate limits" },
      anthropic: { available: !!anthropicKey, model: "claude-sonnet-4", priority: 3 },
      openai: { available: !!openaiKey, model: PRIMARY_MODEL, priority: 4 },
    },
    raceMode: availableCount > 1,
    availableProviders: availableCount,
    activeProvider: availableCount > 1 ? `Race mode (${availableCount} providers)` : githubToken ? "GitHub Models (gpt-4o)" : copilotToken ? "Copilot (gpt-4o)" : anthropicKey ? "Anthropic (Claude)" : openaiKey ? "OpenAI (gpt-4o)" : "none",
    validation: "deep (esbuild + imports + exports + size)",
    pagesSupported: Object.keys(PAGE_FILE_MAP),
    protectedFiles: Array.from(PROTECTED_FILES),
    agentMode: {
      enabled: !!(githubToken || copilotToken || openaiKey),
      provider: githubToken ? "github-models" : copilotToken ? "copilot" : openaiKey ? "openai" : "none",
      tools: ["read_file", "search_codebase", "list_directory", "edit_file", "create_file", "validate_changes"],
      maxIterations: 20,
      retryOnFailure: true,
      rateLimitRetry: true,
      providerRotation: availableCount > 1,
    },
    features: [
      "agent-mode", "tool-calling", "iterative-edits",
      "smart-context", "deep-validation", "auto-retry",
      "parallel-pages", "race-providers", "esbuild-validation",
      "batch-execute", "auto-execute-all",
      "rate-limit-backoff", "provider-rotation",
    ],
  });
});

// ─── GET /api/admin/code-engine/logs ────────────────────────────
router.get("/logs", (_req: Request, res: Response) => {
  try {
    const logs = getExecutionLogs();
    res.json({ success: true, logs, total: logs.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
