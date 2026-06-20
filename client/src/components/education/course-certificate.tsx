import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Award, Download, Printer, Share2, Loader2 } from "lucide-react";
import { useToast } from "../../hooks/use-toast";

// ════════════════════════════════════════════════════════════════
// Course Certificate
// Renders a printable / downloadable completion certificate.
// No external dependencies — uses HTML5 Canvas for PNG export.
// ════════════════════════════════════════════════════════════════

export interface CourseCertificateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseTitle: string;
  courseLevel?: string;
  estimatedHours?: number;
  userName: string;
  completedAt?: Date;
}

interface IssuedCertificate {
  courseId: string;
  courseTitle: string;
  userName: string;
  certificateId: string;
  issuedAt: string; // ISO
}

const STORAGE_KEY = "earned_certificates";

// ──────────────────────────────────────────────────────────────
// Storage helpers
// ──────────────────────────────────────────────────────────────

function loadCertificates(): Record<string, IssuedCertificate> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveCertificate(cert: IssuedCertificate) {
  try {
    const all = loadCertificates();
    all[cert.courseId] = cert;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota errors */
  }
}

export function getEarnedCertificate(
  courseId: string
): IssuedCertificate | null {
  return loadCertificates()[courseId] ?? null;
}

function generateCertificateId(courseId: string): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  const slug = courseId.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase();
  return `BTF-${slug || "CERT"}-${ts}-${rand}`;
}

// ──────────────────────────────────────────────────────────────
// Canvas drawing
// ──────────────────────────────────────────────────────────────

interface DrawArgs {
  userName: string;
  courseTitle: string;
  courseLevel?: string;
  estimatedHours?: number;
  certificateId: string;
  issuedAt: Date;
}

function drawCertificate(
  canvas: HTMLCanvasElement,
  args: DrawArgs
): void {
  const W = 1600;
  const H = 1100;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Background gradient (slate / dark)
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0a0a0a");
  bg.addColorStop(0.5, "#18181b");
  bg.addColorStop(1, "#0a0a0a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle radial orange glow
  const glow = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 800);
  glow.addColorStop(0, "rgba(249,115,22,0.18)");
  glow.addColorStop(1, "rgba(249,115,22,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Outer border
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  // Inner border
  ctx.strokeStyle = "rgba(249,115,22,0.35)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(70, 70, W - 140, H - 140);

  // Decorative corner accents
  const drawCorner = (x: number, y: number, sx: number, sy: number) => {
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 60 * sx, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + 60 * sy);
    ctx.stroke();
  };
  drawCorner(95, 95, 1, 1);
  drawCorner(W - 95, 95, -1, 1);
  drawCorner(95, H - 95, 1, -1);
  drawCorner(W - 95, H - 95, -1, -1);

  // Header brand
  ctx.fillStyle = "#f97316";
  ctx.font = "bold 28px 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("BOOSTIFY MUSIC ACADEMY", W / 2, 170);

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 72px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("Certificate of Completion", W / 2, 280);

  // Divider
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 120, 320);
  ctx.lineTo(W / 2 + 120, 320);
  ctx.stroke();

  // "This is to certify that"
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "italic 28px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("This certificate is proudly presented to", W / 2, 400);

  // User Name
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 96px 'Georgia', serif";
  const safeName = args.userName.trim() || "Boostify Learner";
  ctx.fillText(safeName, W / 2, 510);

  // Underline under name
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1.5;
  const nameWidth = Math.min(ctx.measureText(safeName).width + 80, W - 300);
  ctx.beginPath();
  ctx.moveTo((W - nameWidth) / 2, 540);
  ctx.lineTo((W + nameWidth) / 2, 540);
  ctx.stroke();

  // Body
  ctx.fillStyle = "#d4d4d8";
  ctx.font = "26px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(
    "for successfully completing the course",
    W / 2,
    610
  );

  // Course title (wrap if too long)
  ctx.fillStyle = "#f97316";
  ctx.font = "bold 48px 'Helvetica Neue', Arial, sans-serif";
  const courseLines = wrapText(ctx, `"${args.courseTitle}"`, W - 320);
  let y = 680;
  for (const line of courseLines) {
    ctx.fillText(line, W / 2, y);
    y += 60;
  }

  // Level + duration
  if (args.courseLevel || args.estimatedHours) {
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "22px 'Helvetica Neue', Arial, sans-serif";
    const meta = [
      args.courseLevel ? `Level: ${args.courseLevel}` : null,
      args.estimatedHours ? `Duration: ${args.estimatedHours}h` : null,
    ]
      .filter(Boolean)
      .join("   •   ");
    ctx.fillText(meta, W / 2, y + 10);
  }

  // Footer: signature + date + ID
  const footerY = H - 180;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;

  // Left: date
  ctx.beginPath();
  ctx.moveTo(180, footerY);
  ctx.lineTo(520, footerY);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(formatDate(args.issuedAt), 350, footerY + 36);
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "16px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("Date Issued", 350, footerY + 64);

  // Right: signature
  ctx.beginPath();
  ctx.moveTo(W - 520, footerY);
  ctx.lineTo(W - 180, footerY);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "italic bold 26px 'Georgia', serif";
  ctx.fillText("Boostify Music", W - 350, footerY + 36);
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "16px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("Authorized Signature", W - 350, footerY + 64);

  // Center: certificate ID
  ctx.fillStyle = "#71717a";
  ctx.font = "14px 'Courier New', monospace";
  ctx.fillText(
    `Certificate ID: ${args.certificateId}`,
    W / 2,
    H - 70
  );
  ctx.fillText(
    "Verify at boostify.music/verify",
    W / 2,
    H - 48
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2); // hard cap at 2 lines
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ──────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────

export function CourseCertificate({
  open,
  onOpenChange,
  courseId,
  courseTitle,
  courseLevel,
  estimatedHours,
  userName,
  completedAt,
}: CourseCertificateProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Issue (or load) the certificate exactly once per course
  const cert = useMemo<IssuedCertificate>(() => {
    const existing = getEarnedCertificate(courseId);
    if (existing) return existing;
    const fresh: IssuedCertificate = {
      courseId,
      courseTitle,
      userName,
      certificateId: generateCertificateId(courseId),
      issuedAt: (completedAt ?? new Date()).toISOString(),
    };
    saveCertificate(fresh);
    return fresh;
    // Only re-issue if courseId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // Render onto canvas whenever dialog opens
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      drawCertificate(canvas, {
        userName: cert.userName,
        courseTitle: cert.courseTitle,
        courseLevel,
        estimatedHours,
        certificateId: cert.certificateId,
        issuedAt: new Date(cert.issuedAt),
      });
    } catch (err) {
      console.error("Failed to render certificate:", err);
    }
  }, [open, cert, courseLevel, estimatedHours]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      toast({
        title: "Unable to download",
        description: "Certificate canvas not ready. Please try again.",
        variant: "destructive",
      });
      return;
    }
    setIsDownloading(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      const safeTitle = courseTitle
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()
        .slice(0, 60);
      a.download = `boostify-certificate-${safeTitle || "course"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({
        title: "📥 Certificate downloaded",
        description: "Saved as PNG to your device.",
      });
    } catch (err) {
      console.error("Download failed:", err);
      toast({
        title: "Download failed",
        description: "Your browser blocked the download. Try Print instead.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const win = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
      if (!win) {
        toast({
          title: "Pop-up blocked",
          description: "Please allow pop-ups to print the certificate.",
          variant: "destructive",
        });
        return;
      }
      win.document.write(`<!doctype html><html><head><title>Certificate — ${escapeHtml(
        courseTitle
      )}</title><style>html,body{margin:0;padding:0;background:#000}img{display:block;width:100%;height:auto}@media print{@page{size:landscape;margin:0}}</style></head><body><img src="${dataUrl}" alt="Certificate" onload="setTimeout(()=>{window.focus();window.print();},250)"/></body></html>`);
      win.document.close();
    } catch (err) {
      console.error("Print failed:", err);
      toast({
        title: "Print failed",
        description: "Try downloading instead.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    const shareText = `🎓 I just earned a Certificate of Completion for "${courseTitle}" on Boostify Music Academy! Cert ID: ${cert.certificateId}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "My Boostify Certificate",
          text: shareText,
          url: typeof window !== "undefined" ? window.location.href : undefined,
        });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        toast({
          title: "📋 Copied to clipboard",
          description: "Share text copied — paste anywhere!",
        });
      }
    } catch {
      /* user cancelled share */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-zinc-950 border-orange-500/20 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Award className="w-6 h-6 text-orange-400" />
            Your Certificate of Completion
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Congratulations! You've completed every lesson in this course.
          </DialogDescription>
        </DialogHeader>

        {/* Certificate preview */}
        <div className="rounded-xl overflow-hidden border border-orange-500/20 bg-black shadow-2xl shadow-orange-500/10">
          <canvas
            ref={canvasRef}
            className="w-full h-auto block"
            aria-label={`Certificate for ${courseTitle}`}
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-zinc-500 font-mono">
            ID: {cert.certificateId}
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="border-white/10 hover:border-orange-500/40 hover:text-orange-400"
            >
              <Share2 className="w-4 h-4 mr-1.5" />
              Share
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="border-white/10 hover:border-orange-500/40 hover:text-orange-400"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Print
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-1.5" />
              )}
              Download PNG
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
