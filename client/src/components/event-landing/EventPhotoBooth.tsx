/**
 * EventPhotoBooth.tsx
 * ────────────────────
 * Cinematic photo booth: 3 free shots, event frame overlay, download.
 * Uses MediaDevices API (requires HTTPS in production).
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { EventPublicData } from '../../lib/event-api';
import { EventSectionHeading } from './EventSectionHeading';

interface Props {
  event: EventPublicData;
}

const DEFAULT_FRAMES = [
  { id: 'gold', label: 'Dorado', color: '#c9a84c' },
  { id: 'silver', label: 'Plata', color: '#9ca3af' },
  { id: 'rose', label: 'Rosa', color: '#f9a8d4' },
  { id: 'none', label: 'Sin marco', color: 'transparent' },
];

export function EventPhotoBooth({ event }: Props) {
  const accentColor = event.accent_color || '#c9a84c';
  const primaryColor = event.primary_color || '#1a0533';

  const config = (event.interactive_config as any)?.photo_booth ?? {};
  const intro: string = config.intro || '';
  const hashtag: string = config.hashtag || '';
  const customFrames: Array<{ label: string; color: string }> = Array.isArray(config.frames)
    ? config.frames.filter((f: any) => f && f.label)
    : [];
  const FRAMES = customFrames.length > 0
    ? [
        ...customFrames.map((f, i) => ({ id: `custom-${i}`, label: f.label, color: f.color || accentColor })),
        { id: 'none', label: 'Sin marco', color: 'transparent' },
      ]
    : DEFAULT_FRAMES;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState(FRAMES[0]);
  const [shots, setShots] = useState<string[]>([]); // data URLs
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const maxShots = 3;

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setError('No se pudo acceder a la cámara. Verifica los permisos del navegador.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const takeShot = useCallback(() => {
    if (shots.length >= maxShots || countdown !== null) return;

    let count = 3;
    setCountdown(count);
    const id = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(id);
        setCountdown(null);
        captureFrame();
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, [shots.length, countdown]);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const W = video.videoWidth || 1280;
    const H = video.videoHeight || 720;
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame (mirrored)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -W, 0, W, H);
    ctx.restore();

    // Draw frame overlay — matches the live preview (8px border on a ~560px
    // wide stage ≈ 1.43% of width, with the same 10px rounded corners).
    if (selectedFrame.id !== 'none') {
      const borderW = Math.max(2, Math.round(W * 0.0143));
      const radius = Math.round(W * (10 / 560));
      const inset = borderW / 2;
      ctx.strokeStyle = selectedFrame.color;
      ctx.lineWidth = borderW;
      ctx.beginPath();
      // Rounded rectangle matching the preview's borderRadius.
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(inset, inset, W - borderW, H - borderW, radius);
      } else {
        ctx.rect(inset, inset, W - borderW, H - borderW);
      }
      ctx.stroke();

      // Event label in corner
      ctx.fillStyle = selectedFrame.color;
      ctx.font = `bold ${Math.round(H * 0.03)}px Georgia, serif`;
      ctx.fillText(event.event_title, borderW + 12, H - borderW - 12);
    }

    // Hashtag (top-right) — drawn regardless of frame for shareability.
    if (hashtag) {
      ctx.font = `bold ${Math.round(H * 0.028)}px Georgia, serif`;
      ctx.fillStyle = selectedFrame.id !== 'none' ? selectedFrame.color : accentColor;
      ctx.textAlign = 'right';
      ctx.fillText(hashtag, W - Math.round(W * 0.025), Math.round(H * 0.07));
      ctx.textAlign = 'left';
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setShots((prev) => [...prev, dataUrl]);
  }, [selectedFrame, event.event_title, hashtag, accentColor]);

  const downloadShot = (dataUrl: string, idx: number) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${event.slug}-foto-${idx + 1}.jpg`;
    a.click();
  };

  const sectionStyle: React.CSSProperties = {
    background: `${primaryColor}dd`,
    border: `1px solid ${accentColor}33`,
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '700px',
    margin: '0 auto',
    fontFamily: 'sans-serif',
  };

  return (
    <div id="photo-booth">
      <EventSectionHeading
        eyebrow="Photo Booth"
        title="Photo Booth"
        subtitle={intro || `Toma hasta ${maxShots} fotos con el marco del evento`}
        icon={<Camera size={14} />}
        accentColor={accentColor}
      />
      <section style={sectionStyle}>

      {hashtag && (
        <p className="text-center text-sm font-semibold mb-4" style={{ color: accentColor }}>
          {hashtag}
        </p>
      )}

      {/* Frame selector */}
      <div className="flex gap-2 justify-center mb-4 flex-wrap">
        {FRAMES.map((frame) => (
          <button
            key={frame.id}
            onClick={() => setSelectedFrame(frame)}
            className="px-3 py-1 rounded-full text-xs transition-all"
            style={{
              background: selectedFrame.id === frame.id ? accentColor : 'rgba(255,255,255,0.08)',
              color: selectedFrame.id === frame.id ? primaryColor : '#fff',
              border: `2px solid ${frame.color !== 'transparent' ? frame.color : accentColor + '44'}`,
            }}
          >
            {frame.label}
          </button>
        ))}
      </div>

      {/* Camera view */}
      <div
        className="relative rounded-xl overflow-hidden mx-auto mb-4"
        style={{
          aspectRatio: '16/9',
          maxWidth: '560px',
          background: '#000',
          border: `2px solid ${accentColor}44`,
        }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)', display: cameraActive ? 'block' : 'none' }}
          playsInline
          muted
        />
        {!cameraActive && (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-3">
            <div className="text-4xl">📷</div>
            <p className="text-sm" style={{ color: '#ffffff66' }}>
              Activa la cámara para empezar
            </p>
          </div>
        )}
        {/* Frame overlay visual preview */}
        {cameraActive && selectedFrame.id !== 'none' && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              border: `8px solid ${selectedFrame.color}`,
              borderRadius: '10px',
            }}
          />
        )}
        {/* Countdown overlay */}
        {countdown !== null && (
          <div
            className="absolute inset-0 flex items-center justify-center text-8xl font-bold"
            style={{ color: accentColor, textShadow: `0 0 40px ${accentColor}` }}
          >
            {countdown}
          </div>
        )}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {error && (
        <p className="text-xs text-red-400 text-center mb-3">{error}</p>
      )}

      {/* Controls */}
      <div className="flex gap-3 justify-center mb-6">
        {!cameraActive ? (
          <button
            onClick={startCamera}
            className="px-6 py-2 rounded-full text-sm font-medium"
            style={{ background: accentColor, color: primaryColor }}
          >
            Activar Cámara
          </button>
        ) : (
          <>
            <button
              onClick={stopCamera}
              className="px-4 py-2 rounded-full text-sm"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: `1px solid ${accentColor}44` }}
            >
              Detener
            </button>
            <button
              onClick={takeShot}
              disabled={shots.length >= maxShots || countdown !== null}
              className="px-6 py-2 rounded-full text-sm font-medium disabled:opacity-40 transition-all"
              style={{ background: accentColor, color: primaryColor }}
            >
              📸 Foto ({shots.length}/{maxShots})
            </button>
          </>
        )}
      </div>

      {/* Shot gallery */}
      {shots.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {shots.map((src, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={() => downloadShot(src, i)}
                  className="text-xs px-3 py-1 rounded-full"
                  style={{ background: accentColor, color: primaryColor }}
                >
                  Descargar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </section>
    </div>
  );
}
