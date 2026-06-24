/**
 * Virtual3DStore — Boutique de lujo virtual 3D interactiva para el artista.
 *
 * Construido con react-three-fiber (v8) + drei (v9). Renderiza el INTERIOR de
 * una boutique flagship futurista: suelo de mármol reflectante, paredes con
 * arte mural generado por OpenAI, vitrinas/pedestales iluminados con los
 * productos, molduras de neón con la paleta de la marca, y —si existe— el
 * AVATAR 3D del artista de pie en el podio central. Todo se adapta
 * MAGISTRALMENTE al estilo del artista (género + paleta de marca) para crear
 * una experiencia de venta inmersiva que incita a comprar.
 *
 * Lazy-loaded (default export) para no penalizar el bundle de la tienda.
 */

import React, { Suspense, useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  MeshReflectorMaterial,
  Float,
  Sparkles,
  Text,
  Html,
  useTexture,
  useGLTF,
  useAnimations,
  ContactShadows,
  RoundedBox,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { FBXLoader, SkeletonUtils } from "three-stdlib";
import * as THREE from "three";

/* ────────────────────────────────────────────────────────────
 *  Tipos públicos
 * ──────────────────────────────────────────────────────────── */
export interface Virtual3DProduct {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
}

export interface Virtual3DStoreProps {
  products: Virtual3DProduct[];
  artistName: string;
  genre?: string;
  brandColors?: { primary?: string; secondary?: string; accent?: string };
  logoUrl?: string;
  /** URL del avatar 3D del artista (GLB/FBX) — se coloca en el podio central. */
  avatarUrl?: string;
  avatarFormat?: "glb" | "fbx";
  /** Obras de arte (OpenAI) que se cuelgan en las paredes de la boutique. */
  decorImages?: string[];
  /** Textura seamless de PARED generada por OpenAI para este artista. */
  wallTextureUrl?: string;
  /** Textura seamless de SUELO generada por OpenAI para este artista. */
  floorTextureUrl?: string;
  /** Props 3D (Meshy) — candelabro, esculturas — en GLB. */
  propModels?: Array<{ key?: string; glbUrl: string }>;
  /** Slug de la tienda — habilita los audios interactivos de venta (ElevenLabs). */
  storeSlug?: string;
  onProductClick?: (id: string) => void;
  className?: string;
}

/* ────────────────────────────────────────────────────────────
 *  Theming por género / paleta del artista
 * ──────────────────────────────────────────────────────────── */
interface StoreTheme {
  primary: string;
  secondary: string;
  accent: string;
  fog: string;
  background: string;
  floor: string;
  envPreset:
    | "night"
    | "warehouse"
    | "sunset"
    | "city"
    | "studio"
    | "dawn"
    | "forest"
    | "apartment"
    | "lobby"
    | "park";
  sparkleColor: string;
  vibeLabel: string;
}

const GENRE_THEMES: Record<string, Partial<StoreTheme>> = {
  pop: { primary: "#ff5ea8", secondary: "#7b5cff", accent: "#ffd166", envPreset: "studio", vibeLabel: "POP UNIVERSE" },
  "hip-hop": { primary: "#ffb627", secondary: "#1a1a1a", accent: "#ff7b00", envPreset: "night", vibeLabel: "STREET LUX" },
  rap: { primary: "#d4af37", secondary: "#0d0d0d", accent: "#9b1d1d", envPreset: "night", vibeLabel: "GOLD DRIP" },
  trap: { primary: "#9d4edd", secondary: "#10002b", accent: "#00e5ff", envPreset: "night", vibeLabel: "CYBER TRAP" },
  electronic: { primary: "#00e5ff", secondary: "#ff2d95", accent: "#7c5cff", envPreset: "night", vibeLabel: "NEON GRID" },
  edm: { primary: "#00ffa3", secondary: "#ff2d95", accent: "#00e5ff", envPreset: "night", vibeLabel: "RAVE ENERGY" },
  rock: { primary: "#e63946", secondary: "#1d1d1d", accent: "#f1faee", envPreset: "warehouse", vibeLabel: "RAW STAGE" },
  metal: { primary: "#b3001b", secondary: "#000000", accent: "#8d99ae", envPreset: "warehouse", vibeLabel: "STEEL FORGE" },
  indie: { primary: "#e8c468", secondary: "#3a5a40", accent: "#dad7cd", envPreset: "forest", vibeLabel: "DREAM FOLK" },
  "r&b": { primary: "#d4af37", secondary: "#3d2c2e", accent: "#e0b1cb", envPreset: "sunset", vibeLabel: "SMOOTH GOLD" },
  soul: { primary: "#e09f3e", secondary: "#540b0e", accent: "#fff3b0", envPreset: "sunset", vibeLabel: "WARM SOUL" },
  jazz: { primary: "#d4af37", secondary: "#1b1b3a", accent: "#c44536", envPreset: "lobby", vibeLabel: "ART DECO" },
  latin: { primary: "#ff5400", secondary: "#118ab2", accent: "#ffd60a", envPreset: "sunset", vibeLabel: "TROPICAL HEAT" },
  reggaeton: { primary: "#39ff14", secondary: "#ff10f0", accent: "#00e5ff", envPreset: "night", vibeLabel: "PERREO NEON" },
  reggae: { primary: "#2a9d8f", secondary: "#e9c46a", accent: "#e76f51", envPreset: "park", vibeLabel: "IRIE VIBES" },
  country: { primary: "#bc6c25", secondary: "#283618", accent: "#fefae0", envPreset: "dawn", vibeLabel: "WILD WEST" },
  folk: { primary: "#a3b18a", secondary: "#344e41", accent: "#dad7cd", envPreset: "forest", vibeLabel: "EARTH FOLK" },
  classical: { primary: "#d4af37", secondary: "#1b263b", accent: "#e0e1dd", envPreset: "lobby", vibeLabel: "TIMELESS" },
  "k-pop": { primary: "#ff8fab", secondary: "#9d4edd", accent: "#80ffdb", envPreset: "studio", vibeLabel: "HOLO IDOL" },
};

function isValidHex(c?: string): c is string {
  return !!c && /^#?[0-9a-fA-F]{6}$/.test(c.trim());
}

/**
 * Las texturas WebGL exigen CORS. Muchas imágenes (Firebase Storage, Printful CDN)
 * no envían cabeceras CORS, lo que "ensucia" el canvas y hace fallar la carga.
 * Las enrutamos por el proxy same-origin para evitarlo por completo.
 */
function proxiedTextureUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (/^https?:\/\//i.test(url)) {
    return `/api/proxy/firebase-file?url=${encodeURIComponent(url)}`;
  }
  return url;
}

/* ────────────────────────────────────────────────────────────
 *  Fuentes creativas (locales — compatibles con CSP y troika)
 * ──────────────────────────────────────────────────────────── */
const FONT_DISPLAY = "/fonts/audiowide-400.woff"; // titulares — futurista
const FONT_HEAD = "/fonts/orbitron-700.woff"; // etiquetas/precios — sci-fi
const FONT_LABEL = "/fonts/rajdhani-600.woff"; // nombres de producto — tech
const FONT_ELEGANT = "/fonts/cinzel-700.woff"; // serif de lujo — nombre del artista / CTA
const FONT_SERIF = "/fonts/cormorant-600.woff"; // serif editorial — detalles finos

/* ────────────────────────────────────────────────────────────
 *  Paleta de lujo compartida — oro champán, marfil, mármol oscuro.
 *  El acabado dorado cálido es lo que da el look "flagship boutique"
 *  profesional (en vez de neón saturado).
 * ──────────────────────────────────────────────────────────── */
const GOLD = "#c9a96a";
const GOLD_BRIGHT = "#e8c98a";
const GOLD_EMISSIVE = "#2e2410";
const CHAMPAGNE = "#f3e3c0";
const IVORY = "#f5efe2";

/* ────────────────────────────────────────────────────────────
 *  Textura segura (no-suspense) — para materiales de pared/suelo.
 *  Si la imagen falla, la sala simplemente queda con el material base.
 * ──────────────────────────────────────────────────────────── */
const safeTexCache = new Map<string, THREE.Texture>();

function useSafeTexture(url: string | undefined, repeat?: [number, number]): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(url ? safeTexCache.get(url) || null : null);

  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    const hit = safeTexCache.get(url);
    if (hit) {
      setTex(hit);
      return;
    }
    let cancelled = false;
    new THREE.TextureLoader().load(
      proxiedTextureUrl(url),
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 8;
        safeTexCache.set(url, t);
        if (!cancelled) setTex(t);
      },
      undefined,
      () => {
        /* material base como fallback */
      }
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (tex && repeat) tex.repeat.set(repeat[0], repeat[1]);
  }, [tex, repeat?.[0], repeat?.[1]]);

  return tex;
}

/* ────────────────────────────────────────────────────────────
 *  Textura "cutout" — elimina el fondo blanco de los mockups para
 *  que el producto se vea como un PNG transparente flotando.
 *  Flood-fill desde los bordes: solo borra el blanco CONECTADO al
 *  exterior (no toca blancos internos como camisetas claras).
 * ──────────────────────────────────────────────────────────── */
const cutoutCache = new Map<string, THREE.Texture>();

type CutoutResult = { mode: "cutout" | "original"; bbox?: { x: number; y: number; w: number; h: number } };

function removeWhiteBackground(img: ImageData): CutoutResult {
  const { data, width: w, height: h } = img;
  const n = w * h;

  // Si ya tiene transparencia en los bordes, es un PNG recortado: no tocar.
  let borderAlphaLow = false;
  for (let x = 0; x < w; x += Math.max(1, w >> 5)) {
    if (data[(x) * 4 + 3] < 16 || data[((h - 1) * w + x) * 4 + 3] < 16) { borderAlphaLow = true; break; }
  }
  if (borderAlphaLow) return { mode: "cutout" };

  const nearWhite = (i: number) => {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    return Math.min(r, g, b) > 220 && Math.max(r, g, b) - Math.min(r, g, b) < 22;
  };
  const fringy = (i: number) => {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    return Math.min(r, g, b) > 198 && Math.max(r, g, b) - Math.min(r, g, b) < 30;
  };

  const removed = new Uint8Array(n);
  const stack: number[] = [];
  // Semillas: todos los píxeles del borde que sean casi blancos
  for (let x = 0; x < w; x++) {
    if (nearWhite(x)) stack.push(x);
    const bottom = (h - 1) * w + x;
    if (nearWhite(bottom)) stack.push(bottom);
  }
  for (let y = 0; y < h; y++) {
    const left = y * w;
    if (nearWhite(left)) stack.push(left);
    const right = y * w + w - 1;
    if (nearWhite(right)) stack.push(right);
  }
  while (stack.length) {
    const i = stack.pop()!;
    if (removed[i]) continue;
    removed[i] = 1;
    data[i * 4 + 3] = 0;
    const x = i % w, y = (i / w) | 0;
    if (x > 0 && !removed[i - 1] && nearWhite(i - 1)) stack.push(i - 1);
    if (x < w - 1 && !removed[i + 1] && nearWhite(i + 1)) stack.push(i + 1);
    if (y > 0 && !removed[i - w] && nearWhite(i - w)) stack.push(i - w);
    if (y < h - 1 && !removed[i + w] && nearWhite(i + w)) stack.push(i + w);
  }
  // 1) EROSIÓN del halo blanco: 2 pasadas — los píxeles casi blancos
  //    pegados al área eliminada también se eliminan (mata el cerco blanco).
  for (let pass = 0; pass < 2; pass++) {
    const toRemove: number[] = [];
    for (let i = 0; i < n; i++) {
      if (removed[i]) continue;
      const x = i % w, y = (i / w) | 0;
      const touches =
        (x > 0 && removed[i - 1]) || (x < w - 1 && removed[i + 1]) ||
        (y > 0 && removed[i - w]) || (y < h - 1 && removed[i + w]);
      if (touches && fringy(i)) toRemove.push(i);
    }
    for (const i of toRemove) {
      removed[i] = 1;
      data[i * 4 + 3] = 0;
    }
  }

  // 2) PLUMADO anti-alias: rampa de alpha suave (3 anillos) hacia el borde.
  //    dist[i] = distancia BFS al área eliminada (1..3).
  const dist = new Uint8Array(n); // 0 = lejos / eliminado
  let frontier: number[] = [];
  for (let i = 0; i < n; i++) {
    if (removed[i]) continue;
    const x = i % w, y = (i / w) | 0;
    const touches =
      (x > 0 && removed[i - 1]) || (x < w - 1 && removed[i + 1]) ||
      (y > 0 && removed[i - w]) || (y < h - 1 && removed[i + w]);
    if (touches) {
      dist[i] = 1;
      frontier.push(i);
    }
  }
  for (let d = 2; d <= 3; d++) {
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % w, y = (i / w) | 0;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of nb) {
        if (j >= 0 && !removed[j] && dist[j] === 0) {
          dist[j] = d;
          next.push(j);
        }
      }
    }
    frontier = next;
  }
  const RAMP = [0, 0.35, 0.7, 0.92]; // alpha multiplicador por distancia
  for (let i = 0; i < n; i++) {
    const d = dist[i];
    if (d > 0) data[i * 4 + 3] = Math.round(data[i * 4 + 3] * RAMP[d]);
  }

  // 3) CONTROL DE CALIDAD: si el recorte destruyó el producto (productos
  //    blancos conectados al fondo, p.ej. una taza blanca) → revertir.
  let opaque = 0;
  let centerOpaque = 0, centerTotal = 0;
  const cx0 = (w * 0.3) | 0, cx1 = (w * 0.7) | 0;
  const cy0 = (h * 0.3) | 0, cy1 = (h * 0.7) | 0;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const solid = data[i * 4 + 3] > 60;
      if (solid) {
        opaque++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) {
        centerTotal++;
        if (solid) centerOpaque++;
      }
    }
  }
  const centerFrac = centerTotal > 0 ? centerOpaque / centerTotal : 0;
  const totalFrac = opaque / n;
  // El centro quedó hueco o casi no queda contenido → el recorte falló
  // (típico en productos blancos: tazas, packaging claro).
  if (centerFrac < 0.6 || totalFrac < 0.15 || maxX < 0) return { mode: "original" };
  return { mode: "cutout", bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } };
}

function useCutoutTexture(url: string): { texture: THREE.Texture | null; aspect: number } {
  const cached = cutoutCache.get(url) || null;
  const [texture, setTexture] = useState<THREE.Texture | null>(cached);
  const [aspect, setAspect] = useState<number>(cached ? (cached as any).userData?.aspect || 1 : 1);

  useEffect(() => {
    const hit = cutoutCache.get(url);
    if (hit) {
      setTexture(hit);
      setAspect((hit as any).userData?.aspect || 1);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(proxiedTextureUrl(url));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const bmp = await createImageBitmap(blob);
        const MAX = 1024;
        const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * scale));
        const h = Math.max(1, Math.round(bmp.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bmp, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        const result = removeWhiteBackground(img);

        let outCanvas = canvas;
        let outW = w;
        let outH = h;
        let isCard = false;
        if (result.mode === "original") {
          // El recorte destruiría el producto → usar la imagen original intacta.
          ctx.drawImage(bmp, 0, 0, w, h);
          isCard = true;
        } else {
          ctx.putImageData(img, 0, 0);
          // Recortar al contenido (con margen) para centrar el producto.
          const b = result.bbox;
          if (b && b.w > 8 && b.h > 8 && (b.w < w * 0.96 || b.h < h * 0.96)) {
            const mx = Math.round(b.w * 0.05);
            const my = Math.round(b.h * 0.05);
            const sx = Math.max(0, b.x - mx);
            const sy = Math.max(0, b.y - my);
            const sw = Math.min(w - sx, b.w + mx * 2);
            const sh = Math.min(h - sy, b.h + my * 2);
            const crop = document.createElement("canvas");
            crop.width = sw;
            crop.height = sh;
            crop.getContext("2d")!.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
            outCanvas = crop;
            outW = sw;
            outH = sh;
          }
        }
        const t = new THREE.CanvasTexture(outCanvas);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 16;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.generateMipmaps = true;
        t.userData = { aspect: outW / outH, card: isCard };
        cutoutCache.set(url, t);
        if (!cancelled) {
          setTexture(t);
          setAspect(outW / outH);
        }
      } catch {
        /* el placeholder shimmer queda visible */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { texture, aspect };
}
function normHex(c?: string, fallback = "#ff7b00"): string {
  if (!isValidHex(c)) return fallback;
  const t = c!.trim();
  return t.startsWith("#") ? t : `#${t}`;
}

function buildTheme(genre?: string, brandColors?: Virtual3DStoreProps["brandColors"]): StoreTheme {
  const key = (genre || "").toLowerCase().trim();
  const base = GENRE_THEMES[key] || {
    primary: "#ff7b00",
    secondary: "#7c5cff",
    accent: "#00e5ff",
    envPreset: "night" as const,
    vibeLabel: "BOOSTIFY STORE",
  };

  // La paleta de marca del artista TIENE PRIORIDAD sobre el preset de género.
  const primary = normHex(brandColors?.primary, base.primary || "#ff7b00");
  const secondary = normHex(brandColors?.secondary, base.secondary || "#7c5cff");
  const accent = normHex(brandColors?.accent, base.accent || "#00e5ff");

  return {
    primary,
    secondary,
    accent,
    fog: secondary,
    background: "#05050a",
    floor: "#0a0a12",
    envPreset: (base.envPreset as StoreTheme["envPreset"]) || "night",
    sparkleColor: accent,
    vibeLabel: base.vibeLabel || "BOOSTIFY STORE",
  };
}

/* ────────────────────────────────────────────────────────────
 *  Error boundary por panel (una textura rota no tumba la escena)
 * ──────────────────────────────────────────────────────────── */
class PanelBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* swallow — render fallback */
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* ────────────────────────────────────────────────────────────
 *  Panel de producto — cutout transparente tipo PNG flotando
 *  sobre un halo holográfico (sin tarjeta de fondo blanco).
 * ──────────────────────────────────────────────────────────── */
function ProductCutout({ url, hovered, theme }: { url: string; hovered: boolean; theme: StoreTheme }) {
  const { texture, aspect } = useCutoutTexture(url);
  const isCard = !!(texture as any)?.userData?.card;
  const W = isCard ? 1.55 : 1.7;
  const hgt = Math.min(2.1, Math.max(1.1, W / Math.max(aspect, 0.55)));

  if (!texture) {
    // Placeholder shimmer mientras carga
    return (
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[1.4, 1.4]} />
        <meshStandardMaterial color={theme.secondary} emissive={theme.primary} emissiveIntensity={0.18} transparent opacity={0.35} />
      </mesh>
    );
  }
  if (isCard) {
    // El producto no se pudo recortar (p.ej. producto blanco sobre fondo
    // blanco) → presentarlo como pieza de galería con marco dorado fino.
    return (
      <group position={[0, 0, 0.02]}>
        <mesh position={[0, 0, -0.015]}>
          <boxGeometry args={[W + 0.09, hgt + 0.09, 0.03]} />
          <meshStandardMaterial color={GOLD} metalness={1} roughness={0.3} emissive={GOLD_EMISSIVE} emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[W, hgt]} />
          <meshBasicMaterial map={texture} toneMapped />
        </mesh>
      </group>
    );
  }
  return (
    <mesh position={[0, 0, 0.02]}>
      <planeGeometry args={[W, hgt]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.02} toneMapped depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ProductPanel({
  product,
  position,
  rotationY,
  theme,
  onClick,
}: {
  product: Virtual3DProduct;
  position: [number, number, number];
  rotationY: number;
  theme: StoreTheme;
  onClick?: (id: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (groupRef.current) {
      const target = hovered ? 1.06 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(target, target, target), Math.min(1, delta * 8));
    }
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, hovered ? 0.4 : 0.14, Math.min(1, delta * 6));
    }
    if (beamRef.current) {
      const mat = beamRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, hovered ? 0.08 : 0.03, Math.min(1, delta * 5));
    }
  });

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Float speed={1.1} rotationIntensity={0} floatIntensity={0.25} floatingRange={[-0.035, 0.035]}>
        <group
          ref={groupRef}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(product.id);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
        >
          {/* Aro fino estático — hairline dorado, solo se ilumina al hover */}
          <mesh ref={ringRef} position={[0, 0, -0.06]}>
            <ringGeometry args={[1.12, 1.135, 96]} />
            <meshBasicMaterial
              color={GOLD_BRIGHT}
              transparent
              opacity={0.14}
              toneMapped={false}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          {/* Haz de luz vertical tipo vitrina de museo — muy sutil */}
          <mesh ref={beamRef} position={[0, 0.1, -0.18]}>
            <cylinderGeometry args={[0.55, 0.95, 3.4, 24, 1, true]} />
            <meshBasicMaterial
              color={CHAMPAGNE}
              transparent
              opacity={0.03}
              toneMapped={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          {/* Disco de cristal flotante bajo el producto */}
          <group position={[0, -0.98, 0]}>
            <mesh rotation={[0, 0, 0]}>
              <cylinderGeometry args={[0.82, 0.82, 0.045, 48]} />
              <meshPhysicalMaterial
                color="#dfe8ff"
                metalness={0.15}
                roughness={0.08}
                transparent
                opacity={0.16}
                depthWrite={false}
              />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
              <ringGeometry args={[0.76, 0.82, 48]} />
              <meshBasicMaterial color={GOLD_BRIGHT} toneMapped={false} transparent opacity={0.65} side={THREE.DoubleSide} />
            </mesh>
          </group>
          {/* Resplandor suave de fondo */}
          <mesh position={[0, 0, -0.1]}>
            <circleGeometry args={[1.05, 48]} />
            <meshBasicMaterial
              color={CHAMPAGNE}
              transparent
              opacity={hovered ? 0.09 : 0.04}
              toneMapped={false}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* Imagen del producto — recorte transparente tipo PNG */}
          <PanelBoundary
            fallback={
              <mesh position={[0, 0, 0.02]}>
                <planeGeometry args={[1.4, 1.4]} />
                <meshStandardMaterial color={theme.secondary} emissive={theme.primary} emissiveIntensity={0.25} transparent opacity={0.4} />
              </mesh>
            }
          >
            <ProductCutout url={product.imageUrl} hovered={hovered} theme={theme} />
          </PanelBoundary>

          {/* CTA al hacer hover */}
          {hovered && (
            <Text
              position={[0, 1.18, 0.05]}
              font={FONT_ELEGANT}
              fontSize={0.12}
              anchorX="center"
              anchorY="middle"
              color={CHAMPAGNE}
              outlineWidth={0.008}
              outlineColor="#000000"
              letterSpacing={0.22}
            >
              ✦ TOCA PARA COMPRAR ✦
            </Text>
          )}

          {/* Etiqueta nombre — serif editorial */}
          <Text
            position={[0, -1.06, 0.1]}
            font={FONT_SERIF}
            fontSize={0.15}
            maxWidth={1.7}
            anchorX="center"
            anchorY="top"
            color="#f5f1e8"
            outlineWidth={0.004}
            outlineColor="#000000"
            textAlign="center"
            letterSpacing={0.04}
          >
            {product.name.length > 38 ? product.name.slice(0, 36) + "…" : product.name}
          </Text>

          {/* Precio */}
          <Text
            position={[0, -1.34, 0.1]}
            font={FONT_HEAD}
            fontSize={0.17}
            anchorX="center"
            anchorY="top"
            color={GOLD_BRIGHT}
            outlineWidth={0.006}
            outlineColor="#000000"
          >
            {product.price > 0 ? `$${product.price.toFixed(2)}` : "—"}
          </Text>
        </group>
      </Float>
    </group>
  );
}

/* ────────────────────────────────────────────────────────────
 *  Pedestal central con el nombre / logo del artista
 * ──────────────────────────────────────────────────────────── */
function CenterStage({
  artistName,
  vibeLabel,
  theme,
  logoUrl,
  avatarUrl,
  avatarFormat,
}: {
  artistName: string;
  vibeLabel: string;
  theme: StoreTheme;
  logoUrl?: string;
  avatarUrl?: string;
  avatarFormat?: "glb" | "fbx";
}) {
  const hasAvatar = !!avatarUrl;

  return (
    <group position={[0, 0, 0]}>
      {/* Podio circular de dos niveles — piedra pulida con aros dorados */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[3.75, 3.9, 0.2, 96]} />
        <meshStandardMaterial color="#101016" metalness={0.55} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.205, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.5, 3.72, 96]} />
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.25} emissive={GOLD_EMISSIVE} emissiveIntensity={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.26, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[3.1, 3.35, 0.28, 96]} />
        <meshStandardMaterial color="#15151d" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Incrustación dorada estática al ras del podio — discreta */}
      <mesh position={[0, 0.405, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.18, 3.24, 96]} />
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.3} emissive={GOLD_EMISSIVE} emissiveIntensity={0.35} side={THREE.DoubleSide} />
      </mesh>

      {/* Avatar 3D del artista de pie en el podio (si existe) */}
      {hasAvatar && (
        <group position={[0, 0.4, 0]}>
          <ArtistAvatar url={avatarUrl!} format={avatarFormat} theme={theme} />
          {/* Foco teatral cenital sobre el avatar */}
          <spotLight position={[0, 9, 2.5]} angle={0.4} penumbra={1} intensity={2.6} color="#ffffff" castShadow distance={20} />
          {/* Luz principal frontal para que el rostro/cuerpo no quede en sombra */}
          <spotLight position={[0, 3.2, 6]} angle={0.5} penumbra={0.9} intensity={2.2} color="#fff6ec" distance={22} />
          {/* Relleno suave desde abajo */}
          <pointLight position={[0, 0.6, 3]} intensity={0.7} color="#ffffff" distance={7} />
          {/* Contraluz de color de marca (rim light) */}
          <pointLight position={[0, 3, -3.2]} intensity={1.4} color={theme.primary} distance={9} />
          <pointLight position={[2.6, 2.4, -1.5]} intensity={0.9} color={theme.accent} distance={8} />
        </group>
      )}

      {/* Logo flotante (si existe y NO hay avatar, para no tapar) */}
      {logoUrl && !hasAvatar && (
        <Float speed={1.4} rotationIntensity={0.2} floatIntensity={0.6}>
          <PanelBoundary fallback={<group />}>
            <Suspense fallback={null}>
              <FloatingLogo url={logoUrl} />
            </Suspense>
          </PanelBoundary>
        </Float>
      )}

      {/* Nombre del artista (sobre el avatar o en el centro) — serif de lujo */}
      <Text
        position={[0, hasAvatar ? 3.55 : logoUrl ? 0.9 : 1.7, 0]}
        font={FONT_ELEGANT}
        fontSize={hasAvatar ? 0.46 : 0.64}
        anchorX="center"
        anchorY="middle"
        color="#fdf6e3"
        outlineWidth={0.01}
        outlineColor={theme.primary}
        letterSpacing={0.1}
        maxWidth={8}
        textAlign="center"
      >
        {artistName.toUpperCase()}
      </Text>
      {/* Filigrana divisoria dorada */}
      <mesh position={[0, hasAvatar ? 3.32 : logoUrl ? 0.66 : 1.42, 0]}>
        <planeGeometry args={[2.2, 0.012]} />
        <meshBasicMaterial color={GOLD_BRIGHT} toneMapped={false} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <Text
        position={[0, hasAvatar ? 3.12 : logoUrl ? 0.46 : 1.2, 0]}
        font={FONT_HEAD}
        fontSize={hasAvatar ? 0.15 : 0.18}
        anchorX="center"
        anchorY="middle"
        color={CHAMPAGNE}
        letterSpacing={0.45}
      >
        {vibeLabel}
      </Text>
    </group>
  );
}

function FloatingLogo({ url }: { url: string }) {
  const texture = useTexture(proxiedTextureUrl(url));
  useMemo(() => {
    if (texture) texture.colorSpace = THREE.SRGBColorSpace;
  }, [texture]);
  return (
    <mesh position={[0, 1.7, 0]}>
      <planeGeometry args={[1.8, 1.8]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

/* ────────────────────────────────────────────────────────────
 *  Avatar 3D del artista (GLB con draco o FBX) — de pie en el podio
 * ──────────────────────────────────────────────────────────── */
function AvatarGLB({ url, theme }: { url: string; theme: StoreTheme }) {
  const group = useRef<THREE.Group>(null);
  const gltf = useGLTF(proxiedTextureUrl(url), true); // draco habilitado
  const object = gltf.scene as THREE.Object3D;
  const animations = gltf.animations || [];
  // Clonamos para no mutar la caché; SkeletonUtils re-vincula meshes skinned.
  const scene = useMemo(() => SkeletonUtils.clone(object), [object]);
  const { actions, names } = useAnimations(animations, group);

  // Apoyar los pies en el suelo + escalar a una altura humana de boutique (~2.3u)
  useEffect(() => {
    scene.position.set(0, 0, 0);
    scene.scale.setScalar(1);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const targetH = 2.3;
    const s = size.y > 0.001 ? targetH / size.y : 1;
    scene.scale.setScalar(s);
    scene.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(scene);
    if (Number.isFinite(box2.min.y)) scene.position.y = -box2.min.y;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }, [scene]);

  // Reproducir el primer clip (idle/baile) si existe
  useEffect(() => {
    if (names.length > 0 && actions[names[0]]) {
      const a = actions[names[0]]!;
      a.reset().fadeIn(0.4).play();
      return () => void a.fadeOut(0.3);
    }
  }, [actions, names]);

  // Giro lento de pasarela
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.18;
  });

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

function AvatarFBX({ url }: { url: string }) {
  const group = useRef<THREE.Group>(null);
  const fbx = useLoader(FBXLoader, proxiedTextureUrl(url));
  const scene = useMemo(() => SkeletonUtils.clone(fbx), [fbx]);
  const { actions, names } = useAnimations((fbx as any).animations || [], group);

  useEffect(() => {
    scene.position.set(0, 0, 0);
    scene.scale.setScalar(1);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = size.y > 0.001 ? 2.3 / size.y : 0.02;
    scene.scale.setScalar(s);
    scene.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(scene);
    if (Number.isFinite(box2.min.y)) scene.position.y = -box2.min.y;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }, [scene]);

  useEffect(() => {
    if (names.length > 0 && actions[names[0]]) {
      const a = actions[names[0]]!;
      a.reset().fadeIn(0.4).play();
      return () => void a.fadeOut(0.3);
    }
  }, [actions, names]);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.18;
  });

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

function ArtistAvatar({ url, format, theme }: { url: string; format?: "glb" | "fbx"; theme: StoreTheme }) {
  const isFbx = format === "fbx" || /\.fbx(\?|$)/i.test(url);
  return (
    <PanelBoundary fallback={<group />}>
      <Suspense fallback={null}>
        {isFbx ? <AvatarFBX url={url} /> : <AvatarGLB url={url} theme={theme} />}
      </Suspense>
    </PanelBoundary>
  );
}

/* ────────────────────────────────────────────────────────────
 *  Props 3D decorativos (Meshy) — candelabro, esculturas...
 * ──────────────────────────────────────────────────────────── */
interface PropPlacement {
  position: [number, number, number];
  targetH: number;
  mode: "hang" | "ground";
  rotationY?: number;
}

const PROP_PLACEMENTS: Record<string, PropPlacement[]> = {
  chandelier: [{ position: [0, 0, 0], targetH: 2.5, mode: "hang" }],
  sculpture: [
    { position: [-9.6, 0, -9.6], targetH: 2.6, mode: "ground", rotationY: Math.PI / 4 },
    { position: [9.6, 0, -9.6], targetH: 2.6, mode: "ground", rotationY: -Math.PI / 4 },
    { position: [-9.6, 0, 9.6], targetH: 2.6, mode: "ground", rotationY: (3 * Math.PI) / 4 },
    { position: [9.6, 0, 9.6], targetH: 2.6, mode: "ground", rotationY: (-3 * Math.PI) / 4 },
  ],
  displayTable: [
    { position: [-6.2, 0, 2.2], targetH: 1.0, mode: "ground", rotationY: Math.PI / 3 },
    { position: [6.2, 0, 2.2], targetH: 1.0, mode: "ground", rotationY: -Math.PI / 3 },
  ],
  armchair: [
    { position: [-4.2, 0, -8.6], targetH: 1.35, mode: "ground", rotationY: Math.PI / 7 },
    { position: [4.2, 0, -8.6], targetH: 1.35, mode: "ground", rotationY: -Math.PI / 7 },
  ],
  plant: [
    { position: [-7.4, 0, -11.4], targetH: 2.3, mode: "ground" },
    { position: [7.4, 0, -11.4], targetH: 2.3, mode: "ground" },
    { position: [-11.4, 0, 7.4], targetH: 2.3, mode: "ground", rotationY: Math.PI / 2 },
    { position: [11.4, 0, 7.4], targetH: 2.3, mode: "ground", rotationY: -Math.PI / 2 },
  ],
};

function PropGLBModel({ url, targetH, mode }: { url: string; targetH: number; mode: "hang" | "ground" }) {
  const gltf = useGLTF(proxiedTextureUrl(url), true);
  const scene = useMemo(() => {
    const s = gltf.scene.clone(true);
    s.position.set(0, 0, 0);
    s.scale.setScalar(1);
    s.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = new THREE.Vector3();
    box.getSize(size);
    // Normalizar por altura, pero CLAMP por anchura/fondo: algunos modelos
    // Meshy son anchos y planos y escalados solo por Y se vuelven gigantes.
    let k = size.y > 0.001 ? targetH / size.y : 1;
    const maxXZ = targetH * 1.4;
    const widest = Math.max(size.x, size.z);
    if (widest * k > maxXZ) k = maxXZ / widest;
    s.scale.setScalar(k);
    s.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(s);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    // Centrar en X/Z; en Y: apoyar en el suelo o colgar del punto de anclaje
    s.position.x = -center.x;
    s.position.z = -center.z;
    s.position.y = mode === "ground" ? -box2.min.y : -box2.max.y;
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return s;
  }, [gltf.scene, targetH, mode]);

  return <primitive object={scene} />;
}

function BoutiqueProp({ url, placement, theme }: { url: string; placement: PropPlacement; theme: StoreTheme }) {
  const y = placement.mode === "hang" ? ROOM_H - 0.08 : 0;
  return (
    <group
      position={[placement.position[0], y, placement.position[2]]}
      rotation={[0, placement.rotationY || 0, 0]}
    >
      <PanelBoundary fallback={<group />}>
        <Suspense fallback={null}>
          <PropGLBModel url={url} targetH={placement.targetH} mode={placement.mode} />
        </Suspense>
      </PanelBoundary>
      {placement.mode === "hang" ? (
        // Luz cálida del candelabro
        <pointLight position={[0, -placement.targetH * 0.55, 0]} intensity={1.3} color="#ffd9a0" distance={14} decay={1.6} />
      ) : (
        // Foco sobre la escultura + anillo de base
        <>
          <spotLight position={[0, 5.4, 1.2]} angle={0.45} penumbra={1} intensity={1.0} color="#fff2dd" distance={9} />
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.9, 1.05, 48]} />
            <meshBasicMaterial color={GOLD_BRIGHT} toneMapped={false} transparent opacity={0.45} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
    </group>
  );
}

/* ────────────────────────────────────────────────────────────
 *  Arte mural enmarcado (imágenes generadas por OpenAI)
 * ──────────────────────────────────────────────────────────── */
function WallArtTexture({ url, w, h }: { url: string; w: number; h: number }) {
  const texture = useTexture(proxiedTextureUrl(url));
  useMemo(() => {
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
    }
  }, [texture]);
  return (
    <mesh position={[0, 0, 0.06]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function WallArt({
  url,
  position,
  rotationY,
  theme,
  size = [2.6, 3.4],
}: {
  url: string;
  position: [number, number, number];
  rotationY: number;
  theme: StoreTheme;
  size?: [number, number];
}) {
  const [w, h] = size;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Marco dorado de galería con paspartú marfil */}
      <RoundedBox args={[w + 0.34, h + 0.34, 0.14]} radius={0.04} smoothness={4} position={[0, 0, -0.02]}>
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.28} emissive={GOLD_EMISSIVE} emissiveIntensity={0.4} />
      </RoundedBox>
      <mesh position={[0, 0, 0.052]}>
        <planeGeometry args={[w + 0.14, h + 0.14]} />
        <meshStandardMaterial color={IVORY} metalness={0.05} roughness={0.85} />
      </mesh>
      {/* Imagen */}
      <PanelBoundary
        fallback={
          <mesh position={[0, 0, 0.06]}>
            <planeGeometry args={[w, h]} />
            <meshStandardMaterial color={theme.secondary} emissive={theme.primary} emissiveIntensity={0.2} />
          </mesh>
        }
      >
        <Suspense
          fallback={
            <mesh position={[0, 0, 0.06]}>
              <planeGeometry args={[w, h]} />
              <meshStandardMaterial color="#11111a" />
            </mesh>
          }
        >
          <WallArtTexture url={url} w={w} h={h} />
        </Suspense>
      </PanelBoundary>
      {/* Luz cenital sobre el cuadro */}
      <spotLight
        position={[0, h / 2 + 1.4, 1.2]}
        target-position={[0, 0, 0]}
        angle={0.5}
        penumbra={1}
        intensity={1.1}
        color="#fff4e0"
        distance={9}
      />
    </group>
  );
}

/* ────────────────────────────────────────────────────────────
 *  Vitrina / pedestal de producto (plinto iluminado + panel flotante)
 * ──────────────────────────────────────────────────────────── */
function ProductPedestal({
  product,
  position,
  rotationY,
  theme,
  onClick,
}: {
  product: Virtual3DProduct;
  position: [number, number, number];
  rotationY: number;
  theme: StoreTheme;
  onClick?: (id: string) => void;
}) {
  const [x, , z] = position;
  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      {/* Plinto de mármol con base luminosa */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.7, 0.85, 1.0, 48]} />
        <meshStandardMaterial color="#14141c" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Anillo dorado en la base */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.86, 1.02, 48]} />
        <meshBasicMaterial color={GOLD_BRIGHT} toneMapped={false} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* Banda dorada en el plinto */}
      <mesh position={[0, 0.98, 0]}>
        <cylinderGeometry args={[0.715, 0.715, 0.05, 48, 1, true]} />
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.25} emissive={GOLD_EMISSIVE} emissiveIntensity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Halo superior del plinto */}
      <mesh position={[0, 1.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.72, 48]} />
        <meshBasicMaterial color={CHAMPAGNE} toneMapped={false} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      {/* Foco que ilumina el producto */}
      <spotLight position={[0, 4.6, 0.4]} angle={0.4} penumbra={1} intensity={1.3} color="#fff6ea" distance={8} />
      {/* Panel del producto flotando sobre el plinto */}
      <ProductPanel
        product={product}
        position={[0, 2.4, 0]}
        rotationY={0}
        theme={theme}
        onClick={onClick}
      />
    </group>
  );
}

/* ────────────────────────────────────────────────────────────
 *  Sala de la boutique — arquitectura clásica de flagship store:
 *  boiserie con molduras doradas, pilastras, zócalo de mármol,
 *  cornisa con luz cove cálida y rosetón en el techo.
 * ──────────────────────────────────────────────────────────── */
const ROOM_HALF = 13;
const ROOM_H = 8;

/** Moldura de pared estilo boiserie — marco dorado fino sobre la pared. */
function WallMolding({ w, h }: { w: number; h: number }) {
  const t = 0.045; // grosor del listón
  return (
    <group>
      <mesh position={[0, h / 2 - t / 2, 0]}>
        <boxGeometry args={[w, t, 0.03]} />
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.3} emissive={GOLD_EMISSIVE} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, -h / 2 + t / 2, 0]}>
        <boxGeometry args={[w, t, 0.03]} />
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.3} emissive={GOLD_EMISSIVE} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[-w / 2 + t / 2, 0, 0]}>
        <boxGeometry args={[t, h, 0.03]} />
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.3} emissive={GOLD_EMISSIVE} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[w / 2 - t / 2, 0, 0]}>
        <boxGeometry args={[t, h, 0.03]} />
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.3} emissive={GOLD_EMISSIVE} emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

/** Una pared completa: textura IA + zócalo + boiserie + pilastras + cornisa. */
function BoutiqueWall({
  wallTex,
  theme,
}: {
  wallTex: THREE.Texture | null;
  theme: StoreTheme;
}) {
  const W = ROOM_HALF * 2;
  // 3 paneles de boiserie entre 4 pilastras
  const panelW = 5.4;
  const panelXs = [-7.6, 0, 7.6];
  const pilasterXs = [-11.6, -4.0, 4.0, 11.6];
  return (
    <group>
      {/* Lienzo de la pared — textura de material generada por OpenAI */}
      <mesh receiveShadow>
        <planeGeometry args={[W, ROOM_H]} />
        {wallTex ? (
          <meshStandardMaterial map={wallTex} color="#d8d2c4" metalness={0.12} roughness={0.66} side={THREE.FrontSide} />
        ) : (
          <meshStandardMaterial color="#191920" metalness={0.3} roughness={0.6} side={THREE.FrontSide} />
        )}
      </mesh>

      {/* Zócalo de mármol oscuro */}
      <mesh position={[0, -ROOM_H / 2 + 0.45, 0.035]}>
        <boxGeometry args={[W, 0.9, 0.07]} />
        <meshStandardMaterial color="#101014" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, -ROOM_H / 2 + 0.93, 0.05]}>
        <boxGeometry args={[W, 0.06, 0.1]} />
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.25} emissive={GOLD_EMISSIVE} emissiveIntensity={0.4} />
      </mesh>

      {/* Paneles de boiserie con marco dorado */}
      {panelXs.map((x) => (
        <group key={`panel-${x}`} position={[x, 0.45, 0.045]}>
          <WallMolding w={panelW} h={4.6} />
          <group position={[0, 0, 0.001]} scale={[0.88, 0.88, 1]}>
            <WallMolding w={panelW} h={4.6} />
          </group>
        </group>
      ))}

      {/* Pilastras verticales con capitel dorado */}
      {pilasterXs.map((x) => (
        <group key={`pilaster-${x}`} position={[x, 0, 0.06]}>
          <mesh position={[0, -0.25, 0]}>
            <boxGeometry args={[0.55, ROOM_H - 1.5, 0.12]} />
            <meshStandardMaterial color="#1a1a22" metalness={0.65} roughness={0.3} />
          </mesh>
          <mesh position={[0, ROOM_H / 2 - 1.18, 0.01]}>
            <boxGeometry args={[0.68, 0.16, 0.15]} />
            <meshStandardMaterial color={GOLD} metalness={1} roughness={0.25} emissive={GOLD_EMISSIVE} emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0, -ROOM_H / 2 + 1.04, 0.01]}>
            <boxGeometry args={[0.68, 0.14, 0.15]} />
            <meshStandardMaterial color={GOLD} metalness={1} roughness={0.25} emissive={GOLD_EMISSIVE} emissiveIntensity={0.4} />
          </mesh>
        </group>
      ))}

      {/* Cornisa superior + banda de luz cove cálida */}
      <mesh position={[0, ROOM_H / 2 - 0.5, 0.06]}>
        <boxGeometry args={[W, 0.22, 0.12]} />
        <meshStandardMaterial color="#15151c" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, ROOM_H / 2 - 0.68, 0.075]}>
        <planeGeometry args={[W, 0.1]} />
        <meshBasicMaterial color={CHAMPAGNE} toneMapped={false} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function BoutiqueRoom({ theme, wallTex }: { theme: StoreTheme; wallTex: THREE.Texture | null }) {
  const walls = [
    { pos: [0, ROOM_H / 2, -ROOM_HALF] as [number, number, number], rotY: 0 },
    { pos: [0, ROOM_H / 2, ROOM_HALF] as [number, number, number], rotY: Math.PI },
    { pos: [-ROOM_HALF, ROOM_H / 2, 0] as [number, number, number], rotY: Math.PI / 2 },
    { pos: [ROOM_HALF, ROOM_H / 2, 0] as [number, number, number], rotY: -Math.PI / 2 },
  ];

  return (
    <group>
      {/* 4 paredes arquitectónicas */}
      {walls.map((w, i) => (
        <group key={`wall-${i}`} position={w.pos} rotation={[0, w.rotY, 0]}>
          <BoutiqueWall wallTex={wallTex} theme={theme} />
        </group>
      ))}

      {/* Techo — marfil suave para rebotar la luz cálida */}
      <mesh position={[0, ROOM_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_HALF * 2, ROOM_HALF * 2]} />
        <meshStandardMaterial color="#2a2823" metalness={0.1} roughness={0.92} side={THREE.FrontSide} />
      </mesh>

      {/* Rosetón central del techo — aros dorados concéntricos */}
      <group position={[0, ROOM_H - 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <ringGeometry args={[2.6, 2.75, 96]} />
          <meshStandardMaterial color={GOLD} metalness={1} roughness={0.3} emissive={GOLD_EMISSIVE} emissiveIntensity={0.5} side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <ringGeometry args={[3.3, 3.38, 96]} />
          <meshBasicMaterial color={CHAMPAGNE} toneMapped={false} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <ringGeometry args={[1.7, 1.78, 96]} />
          <meshBasicMaterial color={CHAMPAGNE} toneMapped={false} transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Líneas de luz empotradas en el techo — perímetro elegante */}
      {([
        [0, -ROOM_HALF + 1.6, ROOM_HALF * 2 - 3, true],
        [0, ROOM_HALF - 1.6, ROOM_HALF * 2 - 3, true],
        [-ROOM_HALF + 1.6, 0, ROOM_HALF * 2 - 3, false],
        [ROOM_HALF - 1.6, 0, ROOM_HALF * 2 - 3, false],
      ] as Array<[number, number, number, boolean]>).map(([x, z, len, horiz], i) => (
        <mesh key={`cove-${i}`} position={[x, ROOM_H - 0.05, z]} rotation={[Math.PI / 2, 0, horiz ? 0 : Math.PI / 2]}>
          <planeGeometry args={[len, 0.16]} />
          <meshBasicMaterial color="#fff3dd" toneMapped={false} transparent opacity={0.75} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Zócalo de luz dorada al ras del suelo (sustituye el neón saturado) */}
      {([
        [0, -ROOM_HALF + 0.05, true],
        [0, ROOM_HALF - 0.05, true],
        [-ROOM_HALF + 0.05, 0, false],
        [ROOM_HALF - 0.05, 0, false],
      ] as Array<[number, number, boolean]>).map(([x, z, horiz], i) => (
        <mesh key={`baseline-${i}`} position={[x, 0.05, z]} rotation={[0, horiz ? 0 : Math.PI / 2, 0]}>
          <boxGeometry args={[ROOM_HALF * 2, 0.07, 0.07]} />
          <meshBasicMaterial color={GOLD_BRIGHT} toneMapped={false} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/* ────────────────────────────────────────────────────────────
 *  Escena
 * ──────────────────────────────────────────────────────────── */
function StoreScene({
  products,
  artistName,
  theme,
  logoUrl,
  avatarUrl,
  avatarFormat,
  decorImages,
  wallTextureUrl,
  floorTextureUrl,
  propModels,
  onProductClick,
}: {
  products: Virtual3DProduct[];
  artistName: string;
  theme: StoreTheme;
  logoUrl?: string;
  avatarUrl?: string;
  avatarFormat?: "glb" | "fbx";
  decorImages?: string[];
  wallTextureUrl?: string;
  floorTextureUrl?: string;
  propModels?: Array<{ key?: string; glbUrl: string }>;
  onProductClick?: (id: string) => void;
}) {
  const { scene } = useThree();

  // Respeta la preferencia de accesibilidad: sin auto-rotación si el usuario
  // pidió movimiento reducido.
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );

  // Texturas de entorno generadas por OpenAI para este artista
  const wallTex = useSafeTexture(wallTextureUrl, [3.2, 1]);
  const floorTex = useSafeTexture(floorTextureUrl, [4, 4]);

  useEffect(() => {
    scene.background = new THREE.Color(theme.background);
    scene.fog = new THREE.FogExp2(new THREE.Color("#0b0a08"), 0.008);
    return () => {
      scene.fog = null;
    };
  }, [scene, theme.background, theme.fog]);

  // Distribuir productos en pedestales en un anillo (dentro de la sala)
  const ring = useMemo(() => {
    const n = Math.max(products.length, 1);
    const radius = Math.min(5.5 + n * 0.28, 10.5);
    return products.map((p, i) => {
      const angle = (i / n) * Math.PI * 2;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const rotationY = Math.atan2(x, z); // mirar al centro
      return { product: p, position: [x, 0, z] as [number, number, number], rotationY };
    });
  }, [products]);

  // Colocar el arte mural en las 4 paredes
  const wallArt = useMemo(() => {
    const imgs = (decorImages || []).filter(Boolean);
    if (imgs.length === 0) return [] as Array<{ url: string; position: [number, number, number]; rotationY: number; size: [number, number] }>;
    const slots: Array<{ position: [number, number, number]; rotationY: number; size: [number, number] }> = [
      // Pared del fondo (cuadro hero, grande)
      { position: [0, 4.0, -ROOM_HALF + 0.12], rotationY: 0, size: [3.2, 4.4] },
      // Pared izquierda
      { position: [-ROOM_HALF + 0.12, 3.8, -2.5], rotationY: Math.PI / 2, size: [2.8, 3.7] },
      // Pared derecha
      { position: [ROOM_HALF - 0.12, 3.8, -2.5], rotationY: -Math.PI / 2, size: [2.8, 3.7] },
      // Pared del fondo, segundo cuadro (banner ancho, arriba a un lado)
      { position: [0, 4.0, ROOM_HALF - 0.12], rotationY: Math.PI, size: [4.6, 2.6] },
      // Extra: izquierda 2
      { position: [-ROOM_HALF + 0.12, 3.8, 4.0], rotationY: Math.PI / 2, size: [2.8, 3.7] },
      // Extra: derecha 2
      { position: [ROOM_HALF - 0.12, 3.8, 4.0], rotationY: -Math.PI / 2, size: [2.8, 3.7] },
    ];
    return imgs.slice(0, slots.length).map((url, i) => ({ url, ...slots[i] }));
  }, [decorImages]);

  return (
    <>
      {/* Iluminación de boutique — cálida tipo hotel de lujo */}
      <ambientLight intensity={0.32} color="#fff4e2" />
      <hemisphereLight args={["#fff6e6", "#1a160f", 0.5]} />
      <spotLight position={[0, ROOM_H + 2, 0]} angle={0.95} penumbra={1} intensity={1.5} color="#fff1da" castShadow />
      {/* Acentos de marca, muy sutiles */}
      <pointLight position={[8, 5, 8]} intensity={0.35} color={theme.primary} />
      <pointLight position={[-8, 5, -8]} intensity={0.35} color={theme.secondary} />
      {/* Luz cove cálida del perímetro */}
      <pointLight position={[0, ROOM_H - 1, -ROOM_HALF + 2]} intensity={0.5} color="#ffe9c4" distance={14} />
      <pointLight position={[0, ROOM_H - 1, ROOM_HALF - 2]} intensity={0.5} color="#ffe9c4" distance={14} />
      <pointLight position={[-ROOM_HALF + 2, ROOM_H - 1, 0]} intensity={0.5} color="#ffe9c4" distance={14} />
      <pointLight position={[ROOM_HALF - 2, ROOM_H - 1, 0]} intensity={0.5} color="#ffe9c4" distance={14} />

      <Environment preset="lobby" environmentIntensity={0.5} />

      {/* Sala de la boutique */}
      <BoutiqueRoom theme={theme} wallTex={wallTex} />

      {/* Suelo de mármol reflectante (textura OpenAI del artista si existe) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_HALF * 2, ROOM_HALF * 2]} />
        <MeshReflectorMaterial
          blur={[300, 90]}
          resolution={1024}
          mixBlur={1}
          mixStrength={floorTex ? 4 : 10}
          roughness={floorTex ? 0.6 : 0.9}
          depthScale={1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
          {...(floorTex ? { map: floorTex } : {})}
          color={floorTex ? "#a89e8c" : theme.floor}
          metalness={floorTex ? 0.35 : 0.55}
          mirror={floorTex ? 0.32 : 0.4}
        />
      </mesh>

      {/* Incrustación dorada en el suelo alrededor del podio */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.35, 4.5, 96]} />
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.3} emissive={GOLD_EMISSIVE} emissiveIntensity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.62, 4.66, 96]} />
        <meshBasicMaterial color={CHAMPAGNE} toneMapped={false} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>

      {/* Sombra de contacto bajo el podio */}
      <ContactShadows position={[0, 0.02, 0]} opacity={0.55} scale={20} blur={2.4} far={9} color="#000000" />

      {/* Podio central con avatar / logo */}
      <CenterStage
        artistName={artistName}
        vibeLabel={theme.vibeLabel}
        theme={theme}
        logoUrl={logoUrl}
        avatarUrl={avatarUrl}
        avatarFormat={avatarFormat}
      />

      {/* Arte mural generado por OpenAI */}
      {wallArt.map((a, i) => (
        <WallArt key={`art-${i}`} url={a.url} position={a.position} rotationY={a.rotationY} theme={theme} size={a.size} />
      ))}

      {/* Props 3D generados con Meshy (candelabro, esculturas...) */}
      {(propModels || []).map((p, i) => {
        const placements = PROP_PLACEMENTS[p.key || ""] || PROP_PLACEMENTS.sculpture;
        return placements.map((pl, j) => (
          <BoutiqueProp key={`prop-${i}-${j}`} url={p.glbUrl} placement={pl} theme={theme} />
        ));
      })}

      {/* Productos en vitrinas/pedestales */}
      {ring.map(({ product, position, rotationY }) => (
        <ProductPedestal
          key={product.id}
          product={product}
          position={position}
          rotationY={rotationY}
          theme={theme}
          onClick={onProductClick}
        />
      ))}

      {/* Partículas — polvo dorado sutil, no confeti */}
      <Sparkles count={60} scale={[ROOM_HALF * 1.5, ROOM_H * 0.8, ROOM_HALF * 1.5]} size={2.2} speed={0.25} color={CHAMPAGNE} opacity={0.4} />
      <Sparkles count={25} scale={[9, 4.5, 9]} size={3.4} speed={0.18} color={GOLD_BRIGHT} opacity={0.35} />

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.4}
        minDistance={5}
        maxDistance={18}
        minPolarAngle={Math.PI / 7}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 1.8, 0]}
      />

      <EffectComposer>
        <Bloom intensity={0.42} luminanceThreshold={0.65} luminanceSmoothing={0.9} mipmapBlur radius={0.55} />
        <Vignette eskil={false} offset={0.16} darkness={0.88} />
      </EffectComposer>
    </>
  );
}

/* ────────────────────────────────────────────────────────────
 *  Voz de la boutique (ElevenLabs) — bienvenida + pitch por producto
 * ──────────────────────────────────────────────────────────── */
interface BoutiqueVoiceData {
  welcomeUrl?: string;
  pitches: Record<string, { url: string; text?: string; name?: string }>;
}

function useBoutiqueVoice(storeSlug: string | undefined, products: Virtual3DProduct[]) {
  const [data, setData] = useState<BoutiqueVoiceData>({ pitches: {} });
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(muted);
  const welcomePlayedRef = useRef(false);
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
    if (muted && audioRef.current) {
      audioRef.current.pause();
      setSpeaking(false);
    }
  }, [muted]);

  const play = useCallback((url?: string) => {
    if (!url || mutedRef.current) return;
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    a.src = url;
    a.volume = 0.95;
    a.onended = () => setSpeaking(false);
    a.onerror = () => setSpeaking(false);
    setSpeaking(true);
    a.play()
      .then(() => {
        setNeedsTap(false);
        pendingRef.current = null;
      })
      .catch(() => {
        // Autoplay bloqueado: guardar para reproducir al primer toque
        setSpeaking(false);
        setNeedsTap(true);
        pendingRef.current = url;
      });
  }, []);

  const resume = useCallback(() => {
    if (pendingRef.current) play(pendingRef.current);
    setNeedsTap(false);
  }, [play]);

  const playWelcome = useCallback(() => play(data.welcomeUrl), [play, data.welcomeUrl]);
  const playPitch = useCallback((id: string) => play(data.pitches[id]?.url), [play, data.pitches]);

  // Cargar (y generar si falta) el set de audios
  const productsKey = useMemo(() => products.map((p) => p.id).join(","), [products]);
  useEffect(() => {
    if (!storeSlug || products.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        let audio: any = null;
        const res = await fetch(`/api/artist-store/${storeSlug}/boutique-audio`);
        if (res.ok) {
          const json = await res.json();
          audio = json?.audio || null;
        }
        const missing =
          !audio?.welcome?.url || products.slice(0, 10).some((p) => !audio?.pitches?.[p.id]?.url);
        if (!cancelled && audio) {
          setData({ welcomeUrl: audio?.welcome?.url, pitches: audio?.pitches || {} });
        }
        if (missing) {
          const gen = await fetch(`/api/artist-store/${storeSlug}/boutique-audio/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              products: products.slice(0, 10).map((p) => ({ id: p.id, name: p.name, price: p.price })),
            }),
          });
          if (gen.ok) {
            const gj = await gen.json();
            if (!cancelled && gj?.audio) {
              setData({ welcomeUrl: gj.audio?.welcome?.url, pitches: gj.audio?.pitches || {} });
            }
          }
        }
      } catch {
        /* la boutique funciona igual sin voz */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeSlug, productsKey]);

  // Bienvenida automática (entrar al 3D fue un click → suele estar permitido)
  useEffect(() => {
    if (data.welcomeUrl && !welcomePlayedRef.current) {
      welcomePlayedRef.current = true;
      play(data.welcomeUrl);
    }
  }, [data.welcomeUrl, play]);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  return {
    muted,
    setMuted,
    speaking,
    needsTap,
    resume,
    playWelcome,
    playPitch,
    hasVoice: !!data.welcomeUrl || Object.keys(data.pitches).length > 0,
    pitchText: (id: string) => data.pitches[id]?.text,
  };
}

/* ────────────────────────────────────────────────────────────
 *  Componente principal
 * ──────────────────────────────────────────────────────────── */
const OVERLAY_FONTS_ID = "boutique-3d-fonts";

export default function Virtual3DStore({
  products,
  artistName,
  genre,
  brandColors,
  logoUrl,
  avatarUrl,
  avatarFormat,
  decorImages,
  wallTextureUrl,
  floorTextureUrl,
  propModels,
  storeSlug,
  onProductClick,
  className,
}: Virtual3DStoreProps) {
  const theme = useMemo(() => buildTheme(genre, brandColors), [genre, brandColors]);
  // Limitar a 16 productos en 3D por rendimiento
  const limited = useMemo(() => (products || []).filter((p) => !!p.imageUrl).slice(0, 16), [products]);
  const [selected, setSelected] = useState<Virtual3DProduct | null>(null);
  const voice = useBoutiqueVoice(storeSlug, limited);

  // Velo de entrada cinematográfico (se desvanece tras montar la escena).
  // Se omite si el usuario pidió movimiento reducido.
  const reduceIntro = useMemo(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );
  const [intro, setIntro] = useState(!reduceIntro);
  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(() => setIntro(false), 2300);
    return () => clearTimeout(t);
  }, [intro]);

  // Fuentes creativas para el overlay HTML (Google Fonts — permitidas por CSP)
  useEffect(() => {
    if (document.getElementById(OVERLAY_FONTS_ID)) return;
    const link = document.createElement("link");
    link.id = OVERLAY_FONTS_ID;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Audiowide&family=Orbitron:wght@500;700;900&family=Rajdhani:wght@500;600;700&family=Cinzel:wght@600;700;800&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap";
    document.head.appendChild(link);
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      const p = limited.find((x) => x.id === id) || null;
      setSelected(p);
      voice.playPitch(id);
    },
    [limited, voice]
  );

  return (
    <div
      className={className}
      style={{ width: "100%", height: "100%", position: "relative", background: theme.background }}
      onPointerDown={voice.needsTap ? voice.resume : undefined}
    >
      <style>{`
        @keyframes boutiqueEq {
          0%, 100% { transform: scaleY(0.35); }
          50% { transform: scaleY(1); }
        }
        @keyframes boutiquePulse {
          0%, 100% { box-shadow: 0 0 0 0 ${theme.primary}66; }
          50% { box-shadow: 0 0 0 10px transparent; }
        }
        @keyframes boutiqueCardIn {
          from { transform: translate(-50%, 24px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        .boutique-btn { transition: transform .15s ease, filter .15s ease, box-shadow .15s ease; cursor: pointer; }
        .boutique-btn:hover { transform: translateY(-2px) scale(1.04); filter: brightness(1.15); }
        .boutique-btn:active { transform: scale(0.97); }
        @keyframes boutiqueIntroOut {
          0% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; visibility: hidden; }
        }
        @keyframes boutiqueIntroRise {
          from { transform: translateY(14px); opacity: 0; letter-spacing: 0.5em; }
          to { transform: translateY(0); opacity: 1; letter-spacing: 0.22em; }
        }
        @keyframes boutiqueIntroLine {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>

      {/* ── Velo de entrada cinematográfico ── */}
      {intro && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            background: `radial-gradient(circle at 50% 42%, ${theme.secondary}26, ${theme.background} 62%), ${theme.background}`,
            animation: "boutiqueIntroOut 2.3s ease forwards",
          }}
        >
          <div
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 10,
              letterSpacing: "0.5em",
              color: theme.accent,
              textTransform: "uppercase",
              animation: "boutiqueIntroRise .9s ease both",
            }}
          >
            Boostify Boutique
          </div>
          <div
            style={{
              fontFamily: "'Cinzel', serif",
              fontWeight: 800,
              fontSize: "clamp(26px, 6vw, 52px)",
              color: "#fdf6e3",
              textAlign: "center",
              padding: "0 20px",
              textShadow: `0 0 28px ${theme.primary}66`,
              animation: "boutiqueIntroRise 1.1s ease both .12s",
            }}
          >
            {artistName}
          </div>
          <div
            style={{
              width: "min(220px, 50%)",
              height: 2,
              borderRadius: 2,
              transformOrigin: "center",
              background: `linear-gradient(90deg, transparent, ${theme.primary}, ${theme.accent}, transparent)`,
              animation: "boutiqueIntroLine 1.6s ease both .2s",
            }}
          />
        </div>
      )}

      <Canvas
        shadows
        dpr={[1, 1.8]}
        camera={{ position: [0, 3.4, 11.5], fov: 52 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
      >
        <Suspense
          fallback={
            <Html center>
              <div style={{ color: "#fff", fontSize: 13, opacity: 0.7 }}>Cargando experiencia 3D…</div>
            </Html>
          }
        >
          <StoreScene
            products={limited}
            artistName={artistName}
            theme={theme}
            logoUrl={logoUrl}
            avatarUrl={avatarUrl}
            avatarFormat={avatarFormat}
            decorImages={decorImages}
            wallTextureUrl={wallTextureUrl}
            floorTextureUrl={floorTextureUrl}
            propModels={propModels}
            onProductClick={handleSelect}
          />
        </Suspense>
      </Canvas>

      {/* ── Controles de voz (ElevenLabs) ── */}
      {voice.hasVoice && (
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 5,
          }}
        >
          <button
            className="boutique-btn"
            onClick={() => voice.setMuted(!voice.muted)}
            title={voice.muted ? "Activar voz" : "Silenciar voz"}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: `1px solid ${theme.primary}55`,
              background: "rgba(8,8,16,0.7)",
              backdropFilter: "blur(10px)",
              color: "#fff",
              fontSize: 17,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {voice.muted ? "🔇" : "🔊"}
          </button>
          <button
            className="boutique-btn"
            onClick={voice.playWelcome}
            title="Escuchar bienvenida"
            style={{
              height: 40,
              padding: "0 14px",
              borderRadius: 12,
              border: `1px solid ${theme.accent}44`,
              background: "rgba(8,8,16,0.7)",
              backdropFilter: "blur(10px)",
              color: "#fff",
              fontSize: 11,
              letterSpacing: 1.5,
              fontFamily: "'Orbitron', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {voice.speaking ? (
              <span style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 14 }}>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: 3,
                      height: 14,
                      borderRadius: 2,
                      background: theme.accent,
                      transformOrigin: "bottom",
                      animation: `boutiqueEq 0.${5 + i}s ease-in-out infinite`,
                    }}
                  />
                ))}
              </span>
            ) : (
              "✦"
            )}
            ANFITRIÓN AI
          </button>
          {voice.needsTap && (
            <button
              className="boutique-btn"
              onClick={voice.resume}
              style={{
                height: 40,
                padding: "0 14px",
                borderRadius: 12,
                border: "none",
                background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
                fontFamily: "'Orbitron', sans-serif",
                animation: "boutiquePulse 1.6s infinite",
              }}
            >
              ▶ ACTIVAR AUDIO
            </button>
          )}
        </div>
      )}

      {/* ── Tarjeta de producto seleccionado ── */}
      {selected && (
        <div
          style={{
            position: "absolute",
            bottom: 46,
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(480px, calc(100% - 28px))",
            borderRadius: 20,
            padding: 16,
            background: "linear-gradient(160deg, rgba(12,12,22,0.92), rgba(8,8,16,0.96))",
            border: `1px solid ${theme.primary}55`,
            boxShadow: `0 18px 60px rgba(0,0,0,0.6), 0 0 32px ${theme.primary}22`,
            backdropFilter: "blur(14px)",
            zIndex: 6,
            display: "flex",
            gap: 14,
            alignItems: "center",
            animation: "boutiqueCardIn .25s ease",
          }}
        >
          <div
            style={{
              width: 86,
              height: 86,
              flexShrink: 0,
              borderRadius: 14,
              background: `radial-gradient(circle at 50% 35%, ${theme.secondary}33, transparent 75%)`,
              border: `1px solid ${theme.accent}33`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <img
              src={selected.imageUrl}
              alt={selected.name}
              style={{ width: "100%", height: "100%", objectFit: "contain", mixBlendMode: "lighten" }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "'Cinzel', serif",
                fontWeight: 700,
                fontSize: 14,
                color: "#fdf6e3",
                letterSpacing: 0.6,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {selected.name}
            </div>
            <div
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 900,
                fontSize: 20,
                color: theme.accent,
                margin: "2px 0 8px",
              }}
            >
              {selected.price > 0 ? `$${selected.price.toFixed(2)}` : "Exclusivo"}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="boutique-btn"
                onClick={() => onProductClick?.(selected.id)}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
                  color: "#fff",
                  fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: 1.2,
                  boxShadow: `0 6px 22px ${theme.primary}55`,
                }}
              >
                🛒 COMPRAR AHORA
              </button>
              <button
                className="boutique-btn"
                onClick={() => setSelected(null)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "transparent",
                  color: "rgba(255,255,255,0.75)",
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 600,
                  fontSize: 12,
                  letterSpacing: 0.5,
                }}
              >
                Seguir explorando
              </button>
            </div>
          </div>
          <button
            onClick={() => setSelected(null)}
            className="boutique-btn"
            aria-label="Cerrar"
            style={{
              position: "absolute",
              top: 8,
              right: 10,
              width: 24,
              height: 24,
              borderRadius: 8,
              border: "none",
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.7)",
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Hint de interacción */}
      {!selected && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "6px 14px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(8px)",
            color: "rgba(255,255,255,0.8)",
            fontSize: 10,
            letterSpacing: 1.5,
            fontFamily: "'Orbitron', sans-serif",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          ARRASTRA PARA EXPLORAR · TOCA UN PRODUCTO PARA ESCUCHARLO
        </div>
      )}
    </div>
  );
}
