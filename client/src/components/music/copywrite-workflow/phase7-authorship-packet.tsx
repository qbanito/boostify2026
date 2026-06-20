import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Textarea } from "../../ui/textarea";
import { Label } from "../../ui/label";
import { Progress } from "../../ui/progress";
import { Separator } from "../../ui/separator";
import { 
  Shield, Download, ArrowLeft, FileText, CheckCircle2, 
  Lock, ExternalLink, Loader2, Fingerprint, Copy, Link2
} from "lucide-react";
import type { LyricsProject } from "../../../../../shared/lyrics-workflow-types";
import { SECTION_LABELS } from "../../../../../shared/lyrics-workflow-types";
import { apiRequest } from "../../../lib/queryClient";
import { useToast } from "../../../hooks/use-toast";

interface CertificationResult {
  documentHash: string;
  txHash: string | null;
  blockNumber: number | null;
  contractRecordId: number | null;
  polygonscanUrl: string | null;
  verifyUrl: string;
  certification: {
    id: number;
    status: string;
    certifiedAt: string;
  };
}

interface Phase7AuthorshipPacketProps {
  project: LyricsProject;
  onUpdate: (updates: Partial<LyricsProject>) => void;
  onBack: () => void;
  onComplete: () => void;
}

export function Phase7AuthorshipPacket({ project, onUpdate, onBack, onComplete }: Phase7AuthorshipPacketProps) {
  const [declaration, setDeclaration] = useState(
    project.authorDeclaration || getDefaultDeclaration(project)
  );
  const [certResult, setCertResult] = useState<CertificationResult | null>(null);
  const [isCertifying, setIsCertifying] = useState(false);
  const { toast } = useToast();

  const metrics = project.authorshipMetrics;
  const versions = project.draftVersions || [];
  const finalVersion = versions.find((d: any) => d.type === "final");

  const saveDeclaration = () => {
    onUpdate({ authorDeclaration: declaration, status: "completed", currentPhase: 7 });
  };

  // ── Blockchain Certification ──
  const handleCertify = async () => {
    if (!project.id) {
      toast({ title: "Save project first", description: "Please save the project before certifying.", variant: "destructive" });
      return;
    }
    setIsCertifying(true);
    try {
      saveDeclaration();
      const res = await apiRequest("POST", "/api/copyright/certify", {
        lyricsProjectId: project.id,
      });
      const data = await res.json();
      setCertResult(data);
      toast({
        title: "Copyright Certified!",
        description: data.txHash
          ? `Hash registered on Polygon. TX: ${data.txHash.slice(0, 10)}...`
          : `Document hash: ${data.documentHash.slice(0, 16)}... — saved and timestamped.`,
      });
    } catch (err: any) {
      toast({ title: "Certification failed", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsCertifying(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied!` });
  };

  const downloadPacket = () => {
    const packet = generatePacketText(project, declaration);
    const blob = new Blob([packet], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lyrics-copyright-support-${project.songTitle.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadJSON = () => {
    const data = {
      title: project.songTitle,
      language: project.language,
      genre: project.genre,
      theme: project.theme,
      emotion: project.emotion,
      messageCore: project.messageCore,
      personalStory: project.personalStory,
      humanOriginalPhrases: project.humanOriginalPhrases,
      humanIdeas: project.humanIdeas,
      keywords: project.keywords,
      styleReferences: project.styleReferences,
      structureMap: project.structureMap,
      draftVersions: project.draftVersions,
      authorshipMetrics: project.authorshipMetrics,
      finalLyrics: project.finalLyrics,
      authorDeclaration: declaration,
      generatedAt: new Date().toISOString(),
      platform: "Boostify Music — AI-Assisted Human Creation",
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lyrics-authorship-evidence-${project.songTitle.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-xl">Phase 7: Authorship Evidence Packet</CardTitle>
              <CardDescription>
                Your complete creation process documented. This strengthens your copyright position.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">

          {/* Summary Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <SummaryCard icon="💡" label="Original Ideas" value={project.humanIdeas?.length || 0} />
            <SummaryCard icon="✍️" label="Human Phrases" value={project.humanOriginalPhrases?.length || 0} />
            <SummaryCard icon="📝" label="Loose Lines" value={project.looseLines?.length || 0} />
            <SummaryCard icon="🎤" label="Hooks" value={project.hookBank?.length || 0} />
            <SummaryCard icon="📚" label="Draft Versions" value={versions.length} />
            <SummaryCard icon="✅" label="Decisions Made" value={metrics?.totalDecisions || 0} />
          </div>

          {/* Human Intervention Score */}
          {metrics && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Human Authorship Score</span>
                <span className="font-bold text-xl text-primary">{metrics.rewritePercentage}%</span>
              </div>
              <Progress value={metrics.rewritePercentage} className="h-4" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{metrics.humanOriginalLines} original + {metrics.humanEditedLines} edited + {metrics.humanRewrittenLines} rewritten</span>
                <span>{metrics.aiAcceptedLines} AI accepted</span>
              </div>
            </div>
          )}

          {/* Final Lyrics Preview */}
          {finalVersion && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">Final Approved Lyrics</Label>
              <div className="p-4 rounded-lg border bg-muted/30 font-mono text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                {finalVersion.content}
              </div>
            </div>
          )}

          {/* Author Declaration */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Author's Declaration</Label>
            <Textarea 
              value={declaration}
              onChange={(e) => setDeclaration(e.target.value)}
              className="min-h-[120px]"
              placeholder="Write your author declaration..."
            />
            <p className="text-xs text-muted-foreground">
              This statement is included in your authorship evidence packet.
            </p>
          </div>

          {/* Packet Contents Checklist */}
          <div className="p-4 rounded-lg border bg-muted/50 space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Lyrics Copyright Support Packet Includes:</span>
            </div>
            <CheckItem checked={!!project.songTitle}>Original idea & theme</CheckItem>
            <CheckItem checked={(project.humanOriginalPhrases?.length || 0) >= 3}>Human original phrases ({project.humanOriginalPhrases?.length || 0})</CheckItem>
            <CheckItem checked={!!project.structureMap}>Structure chosen by user</CheckItem>
            <CheckItem checked={versions.some(d => d.type === "ai-draft")}>AI suggestions (used & unused)</CheckItem>
            <CheckItem checked={versions.some(d => d.type === "human-edit")}>Lines manually edited</CheckItem>
            <CheckItem checked={versions.length >= 2}>Versioned drafts with timestamps ({versions.length})</CheckItem>
            <CheckItem checked={declaration.trim().length > 0}>Author's final declaration</CheckItem>
          </div>

          {/* Download Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="gap-2" 
              onClick={() => { saveDeclaration(); downloadPacket(); }}
            >
              <Download className="h-4 w-4" />
              Download Text Report
            </Button>
            <Button 
              variant="outline" 
              className="gap-2" 
              onClick={() => { saveDeclaration(); downloadJSON(); }}
            >
              <Download className="h-4 w-4" />
              Download JSON Evidence
            </Button>
          </div>

          <Separator />

          {/* ═══ BLOCKCHAIN CERTIFICATION SECTION ═══ */}
          <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-md">
                  <Lock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">Blockchain Copyright Certification</CardTitle>
                  <CardDescription>
                    Permanently register your authorship on the Polygon blockchain
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="flex items-start gap-2 p-3 rounded-lg border bg-card">
                  <Fingerprint className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">SHA-256 Hash</p>
                    <p className="text-xs text-muted-foreground">Unique fingerprint of your evidence packet</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg border bg-card">
                  <Shield className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Polygon On-Chain</p>
                    <p className="text-xs text-muted-foreground">Immutable timestamp on blockchain</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg border bg-card">
                  <Link2 className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Public Verification</p>
                    <p className="text-xs text-muted-foreground">Anyone can verify your authorship claim</p>
                  </div>
                </div>
              </div>

              {!certResult ? (
                <Button
                  className="w-full gap-2 py-5 text-base bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white"
                  onClick={handleCertify}
                  disabled={isCertifying || !project.id}
                >
                  {isCertifying ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Certifying on Blockchain...
                    </>
                  ) : (
                    <>
                      <Lock className="h-5 w-5" />
                      Certify Copyright on Polygon
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-3 p-4 rounded-lg border-2 border-green-500/30 bg-green-500/5">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-semibold">Copyright Certified Successfully!</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                      {certResult.certification.status}
                    </Badge>
                  </div>

                  {/* Document Hash */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Document Hash (SHA-256)</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-muted p-2 rounded font-mono break-all">
                        {certResult.documentHash}
                      </code>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(certResult.documentHash, "Hash")}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Blockchain TX */}
                  {certResult.txHash && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Polygon Transaction</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-muted p-2 rounded font-mono break-all">
                          {certResult.txHash}
                        </code>
                        <a
                          href={certResult.polygonscanUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                        >
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Block Number */}
                  {certResult.blockNumber && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Block: #{certResult.blockNumber}</span>
                      {certResult.contractRecordId && (
                        <span>On-chain Record: #{certResult.contractRecordId}</span>
                      )}
                    </div>
                  )}

                  {/* Verification Link */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => copyToClipboard(
                        `${window.location.origin}/verify/${certResult.documentHash}`,
                        "Verification link"
                      )}
                    >
                      <Link2 className="h-3 w-3" />
                      Copy Verification Link
                    </Button>
                    {certResult.polygonscanUrl && (
                      <a href={certResult.polygonscanUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                          <ExternalLink className="h-3 w-3" />
                          View on Polygonscan
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                The SHA-256 hash of your complete authorship evidence is registered on the Polygon blockchain, 
                creating an immutable proof of existence at this specific date and time.
              </p>
            </CardContent>
          </Card>

          <Separator />

          {/* Complete */}
          <Button 
            className="w-full gap-2 py-6 text-base bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600"
            onClick={() => { saveDeclaration(); onComplete(); }}
          >
            <CheckCircle2 className="h-5 w-5" />
            Complete Copywrite Workflow
          </Button>

          {/* Back */}
          <div className="flex justify-start">
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Version Control
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="p-3 rounded-lg border text-center">
      <p className="text-lg">{icon}</p>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function CheckItem({ checked, children }: { checked: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {checked ? (
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
      ) : (
        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
      )}
      <span className={checked ? "" : "text-muted-foreground"}>{children}</span>
    </div>
  );
}

function getDefaultDeclaration(project: LyricsProject): string {
  return `I, the author, hereby declare that the lyrics for "${project.songTitle}" were created through a human-directed creative process assisted by AI tools provided by Boostify Music.

The creative origin, thematic direction, emotional intent, structural decisions, and final editorial choices were made by me. AI was used as an assistive tool under my creative direction, not as the autonomous creator of this work.

All original ideas, phrases, and creative decisions documented in this packet are my own.

Date: ${new Date().toLocaleDateString()}`;
}

function generatePacketText(project: LyricsProject, declaration: string): string {
  const sections = [
    "═══════════════════════════════════════════════════",
    "  LYRICS COPYRIGHT SUPPORT PACKET",
    "  Generated by Boostify Music — AI-Assisted Human Creation",
    "═══════════════════════════════════════════════════",
    "",
    `Song Title: ${project.songTitle}`,
    `Language: ${project.language}`,
    `Genre: ${project.genre}`,
    `Date Created: ${project.createdAt || new Date().toISOString()}`,
    `Date Finalized: ${new Date().toISOString()}`,
    "",
    "───────────────────────────────────────────────────",
    "  1. IDEA ORIGIN",
    "───────────────────────────────────────────────────",
    `Theme: ${project.theme}`,
    `Emotion: ${project.emotion}`,
    `Core Message: ${project.messageCore}`,
    `Desired Tone: ${project.desiredTone}`,
    `Personal Story: ${project.personalStory || "Not provided"}`,
    "",
    "Original Ideas:",
    ...(project.humanIdeas || []).map((idea, i) => `  ${i + 1}. ${idea}`),
    "",
    "Style References:",
    ...(project.styleReferences || []).map(r => `  - ${r}`),
    "",
    "───────────────────────────────────────────────────",
    "  2. HUMAN ORIGINAL PHRASES",
    "───────────────────────────────────────────────────",
    ...(project.humanOriginalPhrases || []).map((p, i) => `  ${i + 1}. "${p}"`),
    "",
    "Loose Lines:",
    ...(project.looseLines || []).map((l, i) => `  ${i + 1}. "${l}"`),
    "",
    "Hooks:",
    ...(project.hookBank || []).map((h, i) => `  ${i + 1}. "${h}"`),
    "",
    "───────────────────────────────────────────────────",
    "  3. STRUCTURE CHOSEN BY AUTHOR",
    "───────────────────────────────────────────────────",
    ...Object.entries(project.structureMap || {})
      .filter(([_, v]) => v)
      .map(([k]) => `  ✓ ${SECTION_LABELS[k] || k}`),
    `  Verses: ${project.verseCount}`,
    `  Chorus Length: ${project.chorusLength}`,
    `  Hook Repetition: ${project.hookRepetition}x`,
    "",
    "───────────────────────────────────────────────────",
    "  4. VERSION HISTORY",
    "───────────────────────────────────────────────────",
    ...(project.draftVersions || []).map(v => [
      `  Version ${v.version} (${v.type}) — ${v.timestamp}`,
      `  Lines: ${v.lines.length}`,
      "",
    ]).flat(),
    "",
    "───────────────────────────────────────────────────",
    "  5. AUTHORSHIP METRICS",
    "───────────────────────────────────────────────────",
    `  Human Original Lines: ${project.authorshipMetrics?.humanOriginalLines || 0}`,
    `  Human Edited Lines: ${project.authorshipMetrics?.humanEditedLines || 0}`,
    `  Human Rewritten Lines: ${project.authorshipMetrics?.humanRewrittenLines || 0}`,
    `  AI Accepted (unchanged): ${project.authorshipMetrics?.aiAcceptedLines || 0}`,
    `  Human Intervention: ${project.authorshipMetrics?.rewritePercentage || 0}%`,
    `  Total Decisions: ${project.authorshipMetrics?.totalDecisions || 0}`,
    "",
    "───────────────────────────────────────────────────",
    "  6. FINAL APPROVED LYRICS",
    "───────────────────────────────────────────────────",
    project.finalLyrics || "(Not yet finalized)",
    "",
    "───────────────────────────────────────────────────",
    "  7. AUTHOR'S DECLARATION",
    "───────────────────────────────────────────────────",
    declaration,
    "",
    "═══════════════════════════════════════════════════",
    "  This document was generated by Boostify Music",
    "  It does not constitute legal registration but",
    "  serves as supporting evidence of human authorship.",
    "═══════════════════════════════════════════════════",
  ];
  return sections.join("\n");
}
