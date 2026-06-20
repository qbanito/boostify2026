/**
 * BOOSTIFY ARTIST NODE FLOW — Flow Runner
 * Topological sort + sequential node execution with real API calls.
 */

import { Node, Edge } from '@xyflow/react';
import { useFlowStore, NodeFlowData } from './useFlowStore';

// ─── Topological sort ────────────────────────────────────────────────────────

function topoSort(nodes: Node<NodeFlowData>[], edges: Edge[]): Node<NodeFlowData>[] {
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};

  for (const n of nodes) {
    inDegree[n.id] = 0;
    adj[n.id] = [];
  }

  for (const e of edges) {
    // Skip orphan edges that reference nodes no longer on the canvas so the
    // sort never crashes on a stale/deleted endpoint.
    if (adj[e.source] === undefined || inDegree[e.target] === undefined) continue;
    adj[e.source].push(e.target);
    inDegree[e.target] = (inDegree[e.target] ?? 0) + 1;
  }

  const queue = nodes.filter(n => inDegree[n.id] === 0);
  const sorted: Node<NodeFlowData>[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adj[current.id] ?? []) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        const neighborNode = nodes.find(n => n.id === neighbor);
        if (neighborNode) queue.push(neighborNode);
      }
    }
  }

  return sorted;
}

// ─── Gather inputs for a node from its connected source nodes ────────────────

function gatherInputs(
  nodeId: string,
  edges: Edge[],
  outputMap: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  const incomingEdges = edges.filter(e => e.target === nodeId);
  for (const edge of incomingEdges) {
    const sourceOutput = outputMap[edge.source] ?? {};
    Object.assign(merged, sourceOutput);
  }
  return merged;
}

// ─── Node executors ──────────────────────────────────────────────────────────

async function fetchJson(url: string, options?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

type ExecutorFn = (
  nodeData: NodeFlowData,
  inputs: Record<string, unknown>
) => Promise<Record<string, unknown>>;

const EXECUTORS: Record<string, ExecutorFn> = {

  artistInput: async (data) => {
    // Simply outputs the artist context — already on data
    return {
      artistId: data.artistId,
      artistSlug: data.artistSlug,
      name: (data as any).name ?? data.artistSlug,
      genre: (data as any).genre ?? '',
      location: (data as any).location ?? '',
      biography: (data as any).biography ?? '',
      profileImage: (data as any).profileImage ?? '',
      bannerImage: (data as any).bannerImage ?? '',
    };
  },

  songInput: async (data) => {
    // Generate mode: song was already generated inside the node via /api/music/generate.
    // The node's polling stored the result in data.generatedSong.
    const generated = (data as any).generatedSong as { title?: string; audioUrl?: string; coverArt?: string; songId?: string } | null;
    if (generated?.audioUrl) {
      return {
        songId:   generated.songId   ?? (data.songId as string | undefined) ?? '',
        title:    generated.title    ?? 'AI Song',
        audioUrl: generated.audioUrl ?? '',
        coverArt: generated.coverArt ?? '',
        lyrics:   '',
        genre:    (data as any).genTags ?? '',
      };
    }

    // Select mode: fetch by songId
    if (!data.songId) throw new Error('No song selected. Set a Song ID or generate one with Generar IA.');
    const song = await fetchJson(`/api/songs/${data.songId}`).catch(() => ({}));
    return {
      songId:   data.songId,
      title:    (song as any).title    ?? 'Untitled',
      audioUrl: (song as any).audioUrl ?? '',
      coverArt: (song as any).coverArt ?? '',
      lyrics:   (song as any).lyrics   ?? '',
      genre:    (song as any).genre    ?? '',
    };
  },

  videoInput: async (data) => {
    // Generate mode: video was generated inside the node; result stored in data.generatedVideo
    const generated = (data as any).generatedVideo as { title?: string; videoUrl?: string; thumbnailUrl?: string; taskId?: string } | null;
    if (generated?.videoUrl) {
      return {
        videoUrl:     generated.videoUrl     ?? '',
        title:        generated.title        ?? 'AI Video',
        thumbnailUrl: generated.thumbnailUrl ?? '',
        model:        (data as any).vidGenModel ?? 't2v-01',
        duration:     '',
      };
    }

    // URL mode: video URL pasted directly
    const url = (data as any).videoUrl as string | undefined;
    if (url?.trim()) {
      return {
        videoUrl:     url,
        title:        (data as any).videoTitle ?? 'Video',
        thumbnailUrl: '',
        model:        '',
        duration:     '',
      };
    }

    throw new Error('No video available. Paste a URL or generate one with Generar IA.');
  },

  talkToMe: async (data) => {
    // Validate that a Convai agent is reachable and return session config
    const persona  = (data as any).persona  || 'warm, authentic, passionate about music';
    const topics   = (data as any).topics   || [];
    const language = (data as any).language || 'español';
    return {
      sessionConfig: JSON.stringify({ persona, topics, language }),
      persona,
      language,
    };
  },

  // ── Premium Page Nodes — pass-through executors ────────────────────────────
  youtubeBoost: async (data) => {
    const artistId = (data as any).artistId || '';
    return { channelUrl: `https://youtube.com/@${artistId}`, subscribers: '—', growthScore: '—' };
  },

  instagramBoost: async (data) => {
    const handle = (data as any).instagramHandle || '';
    return { handle: handle ? `@${handle}` : '—', followers: '—', engagementRate: '—' };
  },

  tiktokBoost: async (data) => {
    const artistId = (data as any).artistId || '';
    return { handle: `@${artistId}`, followers: '—', viralScore: '—' };
  },

  artistImage: async (data) => {
    return {
      profileImage: (data as any).profileImage || '',
      coverImage:   (data as any).coverImage   || '',
      styleScore:   '—',
    };
  },

  merch: async (data) => {
    const artistId = (data as any).artistId || '';
    try {
      const r = await fetchJson(`/api/merch/summary?artistId=${artistId}`);
      return { productCount: String((r as any).total || '—'), revenue: '—', storeUrl: '' };
    } catch {
      return { productCount: '—', revenue: '—', storeUrl: '' };
    }
  },

  contacts: async () => {
    return { contactCount: '—', activeOutreach: '—', venues: '—' };
  },

  aiArtistMint: async (data) => {
    const artistId = (data as any).artistId || '';
    try {
      const r = await fetchJson(`/api/tokenization/status?artistId=${artistId}`);
      return {
        mintStatus:       (r as any).minted ? 'minted' : 'not_minted',
        tokenId:          String((r as any).tokenId || '—'),
        blockchainNetwork: (r as any).network || 'Polygon',
      };
    } catch {
      return { mintStatus: 'not_minted', tokenId: '—', blockchainNetwork: 'Polygon' };
    }
  },

  bioGenerator: async (_data, inputs) => {
    const result = await fetchJson('/api/generate/biography', {
      method: 'POST',
      body: JSON.stringify({
        name: inputs.name,
        genre: inputs.genre,
        location: inputs.location,
      }),
    });
    return { biography: (result as any).biography ?? result };
  },

  coverArt: async (_data, inputs) => {
    const result = await fetchJson('/api/generate/cover-art', {
      method: 'POST',
      body: JSON.stringify({
        name: inputs.name,
        genre: inputs.genre,
        title: inputs.title,
      }),
    });
    return { imageUrl: (result as any).imageUrl ?? (result as any).url ?? '' };
  },

  karaoke: async (_data, inputs) => {
    const songId = inputs.songId;
    if (!songId) throw new Error('No songId from upstream node');
    const result = await fetchJson(`/api/karaoke/${songId}/generate`, { method: 'POST' });
    return {
      karaokeReady: true,
      videoUrl:  (result as any).videoUrl  ?? (result as any).url ?? '',
      lyricsUrl: (result as any).lyricsUrl ?? '',
    };
  },

  promoClip: async (_data, inputs) => {
    const result = await fetchJson('/api/promo-clips/generate', {
      method: 'POST',
      body: JSON.stringify({
        songId:       inputs.songId,
        title:        inputs.title,
        coverArt:     inputs.coverArt ?? inputs.imageUrl,
        artistId:     inputs.artistId,
        artistName:   inputs.name ?? inputs.artistName,
        genre:        inputs.genre,
        // Creative config from the node itself
        style:        (_data as any).promoStyle      ?? 'cinematic',
        model:        (_data as any).promoModel      ?? 'auto',
        frameRate:    (_data as any).frameRate        ?? '30',
        colorMood:    (_data as any).colorMood        ?? 'dark',
        duration:     (_data as any).promoDuration    ?? '10s',
        instructions: (_data as any).promoInstructions ?? '',
      }),
    });
    return { videoUrl: (result as any).videoUrl ?? (result as any).url ?? '' };
  },

  socialPost: async (_data, inputs) => {
    const result = await fetchJson('/api/generate/social-post', {
      method: 'POST',
      body: JSON.stringify({
        name: inputs.name,
        biography: inputs.biography,
        genre: inputs.genre,
        imageUrl: inputs.imageUrl ?? inputs.profileImage,
      }),
    });
    return {
      caption: (result as any).caption ?? '',
      hashtags: (result as any).hashtags ?? [],
    };
  },

  shareCard: async (_data, inputs) => {
    // Client-side canvas generation — create a simple card
    const cardPngDataUrl = await generateShareCardCanvas({
      name: String(inputs.name ?? ''),
      title: String(inputs.title ?? ''),
      coverArt: String(inputs.coverArt ?? inputs.imageUrl ?? ''),
      profileImage: String(inputs.profileImage ?? ''),
    });
    return { cardPngDataUrl, cardUrl: cardPngDataUrl };
  },

  profileUpdate: async (_data, inputs) => {
    const artistId = inputs.artistId;
    if (!artistId) throw new Error('No artistId from upstream node');
    const body: Record<string, unknown> = {};
    if (inputs.biography) body.biography = inputs.biography;
    if (inputs.imageUrl) body.bannerImage = inputs.imageUrl;
    if (inputs.profileImage) body.profileImage = inputs.profileImage;
    await fetchJson(`/api/artist/${artistId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return { updated: true };
  },

  newsPublisher: async (_data, inputs) => {
    await fetchJson('/api/artist-news', {
      method: 'POST',
      body: JSON.stringify({
        title: inputs.title ?? inputs.name,
        content: inputs.biography ?? inputs.caption ?? '',
        imageUrl: inputs.imageUrl ?? inputs.profileImage ?? '',
      }),
    });
    return { published: true };
  },

  // ── Automation / flow-control nodes ──────────────────────────────────────
  // These forward their upstream inputs downstream so a chain that passes
  // through them stays connected instead of dead-ending on an empty output.
  promptBuilder: async (data, inputs) => {
    const template = String((data as any).template ?? (data as any).prompt ?? '');
    // Interpolate {{key}} placeholders with the matching upstream input value.
    const prompt = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) =>
      String((inputs as Record<string, unknown>)[key] ?? '')
    );
    return { ...inputs, prompt: prompt || template };
  },

  routerNode: async (_data, inputs) => {
    // Pass everything through; downstream branches each receive the same data.
    return { ...inputs };
  },

  agentCommand: async (data, inputs) => {
    return { ...inputs, command: String((data as any).command ?? '') };
  },

  scheduleTrigger: async (data) => {
    return { triggeredAt: new Date().toISOString(), schedule: String((data as any).schedule ?? '') };
  },

  webhookTrigger: async (data) => {
    return { triggeredAt: new Date().toISOString(), webhookUrl: String((data as any).webhookUrl ?? '') };
  },
};

// ─── Canvas-based share card generator ──────────────────────────────────────

async function generateShareCardCanvas(opts: {
  name: string;
  title: string;
  coverArt: string;
  profileImage: string;
}): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 1080);
  grad.addColorStop(0, '#0d0d1a');
  grad.addColorStop(1, '#1a0d2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1080);

  // Load cover image if available
  if (opts.coverArt) {
    try {
      const img = await loadImage(opts.coverArt);
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.drawImage(img, 0, 0, 1080, 1080);
      ctx.restore();
    } catch {
      // skip if image fails
    }
  }

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(opts.name, 540, 500);
  ctx.font = '48px sans-serif';
  ctx.fillStyle = '#a78bfa';
  ctx.fillText(opts.title, 540, 580);

  // Boostify watermark
  ctx.font = '28px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('boostifymusic.com', 540, 980);

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ─── Main runner hook ────────────────────────────────────────────────────────

export function useFlowRunner() {
  const store = useFlowStore();

  const run = async () => {
    const { nodes, edges } = store;
    if (nodes.length === 0) return;

    store.resetExecution();
    store.setIsRunning(true);

    const sorted = topoSort(nodes, edges);
    const outputMap: Record<string, Record<string, unknown>> = {};

    // Pre-populate artistInput data from store context
    for (const node of sorted) {
      if (node.type === 'artistInput') {
        outputMap[node.id] = {
          artistId: store.artistId,
          artistSlug: store.artistSlug,
          name: store.artistSlug,
          genre: '',
          location: '',
          biography: '',
        };
      }
    }

    for (const node of sorted) {
      const executor = EXECUTORS[node.type ?? ''];
      if (!executor) {
        // Unknown node type — mark done with empty output
        store.setNodeStatus(node.id, 'done', {});
        outputMap[node.id] = {};
        continue;
      }

      store.setNodeStatus(node.id, 'running');
      const inputs = gatherInputs(node.id, edges, outputMap);

      // Small delay so UI can show running state
      await new Promise(r => setTimeout(r, 300));

      try {
        const output = await executor(node.data, { ...inputs });
        outputMap[node.id] = output;
        store.setNodeStatus(node.id, 'done', output);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        store.setNodeStatus(node.id, 'error', {}, msg);
        // Continue to next node even on error
      }
    }

    store.setIsRunning(false);
  };

  return { run };
}
