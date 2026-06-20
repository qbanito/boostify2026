import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Award, Loader2, Download, GraduationCap, Lock } from "lucide-react";

interface CertificateDialogProps {
  courseIdentifier: string;
  onClose: () => void;
}

export function CertificateDialog({ courseIdentifier, onClose }: CertificateDialogProps) {
  const certRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/education/certificate/${courseIdentifier}`],
    enabled: !!courseIdentifier,
  });

  const cert: any = data || {};

  const handleDownload = () => {
    const node = certRef.current;
    if (!node) return;
    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${cert.courseTitle || "Certificate"} — Boostify Academy</title>
      <style>
        body{margin:0;font-family:Georgia,'Times New Roman',serif;background:#0b0a08;display:flex;align-items:center;justify-content:center;min-height:100vh}
        .diploma{width:1000px;max-width:94vw;box-sizing:border-box;padding:56px;color:#1b1b1b;background:linear-gradient(135deg,#fdf8ee,#f4e8cf);border:14px solid #c9a96a;border-radius:18px;text-align:center;position:relative}
        .eyebrow{letter-spacing:.42em;font-size:13px;color:#9a7b39;text-transform:uppercase;margin-bottom:8px}
        h1{font-size:46px;margin:6px 0 2px;color:#7a5d23;letter-spacing:.04em}
        .sub{font-size:15px;color:#6b6b6b;margin-bottom:34px}
        .name{font-size:40px;margin:18px 0 6px;color:#1b1b1b;font-style:italic}
        .rule{width:280px;height:2px;background:#c9a96a;margin:6px auto 22px}
        .course{font-size:24px;font-weight:bold;color:#7a5d23;margin:10px 0 26px}
        .meta{display:flex;justify-content:space-between;margin-top:46px;font-size:13px;color:#555}
        .seal{position:absolute;right:54px;bottom:54px;width:96px;height:96px;border-radius:50%;border:3px solid #c9a96a;display:flex;align-items:center;justify-content:center;color:#9a7b39;font-weight:bold;font-size:12px;text-align:center;line-height:1.2}
      </style></head><body>${node.outerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  };

  const fmtDate = (d?: string | null) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); }
    catch { return "—"; }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            Course Certificate
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !cert.eligible ? (
          <div className="flex flex-col items-center text-center py-12 px-6 gap-3">
            <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold">Certificate not unlocked yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Complete all {cert.totalLessons || "the"} lessons to earn your diploma.
              You've finished {cert.lessonsCompleted || 0} of {cert.totalLessons || 0}
              {" "}({cert.progressPct || 0}%).
            </p>
          </div>
        ) : (
          <>
            {/* On-screen diploma (also used for the printable window) */}
            <div
              ref={certRef}
              className="diploma relative rounded-2xl border-[10px] border-[#c9a96a] bg-gradient-to-br from-[#fdf8ee] to-[#f4e8cf] p-8 text-center text-[#1b1b1b]"
            >
              <div className="eyebrow text-[11px] tracking-[0.4em] uppercase text-[#9a7b39] mb-1">
                Boostify Academy
              </div>
              <h1 className="text-3xl font-bold text-[#7a5d23] mb-1">Certificate of Completion</h1>
              <p className="sub text-sm text-[#6b6b6b] mb-6">This is proudly presented to</p>
              <div className="name text-3xl italic mb-1">{cert.recipientName}</div>
              <div className="rule mx-auto mb-5 h-[2px] w-64 bg-[#c9a96a]" />
              <p className="text-sm text-[#555] mb-2">for successfully completing the course</p>
              <div className="course text-xl font-bold text-[#7a5d23] mb-6">{cert.courseTitle}</div>
              <div className="meta flex justify-between mt-10 text-xs text-[#555]">
                <div>
                  <div className="font-semibold">{fmtDate(cert.issuedAt || cert.completedAt)}</div>
                  <div>Date issued</div>
                </div>
                <div>
                  <div className="font-semibold">{cert.certificateId}</div>
                  <div>Certificate ID</div>
                </div>
              </div>
              <div className="seal absolute right-8 bottom-8 hidden sm:flex w-20 h-20 rounded-full border-2 border-[#c9a96a] items-center justify-center text-[10px] font-bold text-[#9a7b39] text-center leading-tight">
                <Award className="w-8 h-8" />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={handleDownload} className="gap-2">
                <Download className="w-4 h-4" />
                Download / Print
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
