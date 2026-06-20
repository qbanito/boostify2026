import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import {
  Shield, CheckCircle2, XCircle, Loader2, Fingerprint, ExternalLink,
  Search, Clock, User, Music, Link2, Copy
} from "lucide-react";
import { useToast } from "../hooks/use-toast";

interface VerificationResult {
  verified: boolean;
  certification: {
    id: number;
    documentHash: string;
    songTitle: string;
    authorshipScore: number;
    txHash: string | null;
    blockNumber: number | null;
    blockTimestamp: string | null;
    walletAddress: string | null;
    status: string;
    certifiedAt: string;
    createdAt: string;
  } | null;
  onChain?: {
    exists: boolean;
    author: string;
    timestamp: number;
    songTitle: string;
    authorshipScore: number;
  };
}

export default function CopyrightVerifyPage() {
  const [, params] = useRoute("/verify/:hash");
  const [hash, setHash] = useState(params?.hash || "");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (params?.hash) {
      setHash(params.hash);
      doVerify(params.hash);
    }
  }, [params?.hash]);

  const doVerify = async (docHash: string) => {
    if (!docHash.trim()) return;
    setIsLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/copyright/verify/${encodeURIComponent(docHash.trim())}`);
      if (!res.ok) throw new Error("Verification request failed");
      const data = await res.json();
      setResult(data);
    } catch {
      setResult(null);
      toast({ title: "Error", description: "Could not verify the document hash.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied!` });
  };

  const cert = result?.certification;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-2xl mx-auto py-12 px-4 space-y-8">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg mb-2">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Copyright Verification</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Verify the authenticity of a Boostify Music copyright certification by entering the document hash below.
          </p>
        </div>

        {/* Search Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <Label htmlFor="hash-input">Document Hash (SHA-256)</Label>
              <div className="flex gap-2">
                <Input
                  id="hash-input"
                  placeholder="Enter the 64-character document hash..."
                  value={hash}
                  onChange={(e) => setHash(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doVerify(hash)}
                  className="font-mono text-sm"
                />
                <Button
                  onClick={() => doVerify(hash)}
                  disabled={isLoading || !hash.trim()}
                  className="gap-2 shrink-0"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Verify
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <p className="text-sm text-muted-foreground">Verifying on database and blockchain...</p>
          </div>
        )}

        {searched && !isLoading && result && (
          <Card className={`border-2 ${result.verified ? "border-green-500/30" : "border-red-500/30"}`}>
            <CardHeader>
              <div className="flex items-center gap-3">
                {result.verified ? (
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-500" />
                )}
                <div>
                  <CardTitle className={result.verified ? "text-green-600" : "text-red-600"}>
                    {result.verified ? "Copyright Verified" : "Not Found"}
                  </CardTitle>
                  <CardDescription>
                    {result.verified
                      ? "This document hash has been certified on the Boostify platform."
                      : "No certification found for this document hash."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            {cert && (
              <CardContent className="space-y-4">
                <Separator />

                {/* Song Title */}
                <div className="flex items-center gap-3">
                  <Music className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Song Title</p>
                    <p className="font-semibold">{cert.songTitle}</p>
                  </div>
                </div>

                {/* Authorship Score */}
                <div className="flex items-center gap-3">
                  <Fingerprint className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Human Authorship Score</p>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{cert.authorshipScore}%</p>
                      <Badge variant="secondary" className="text-xs">
                        {cert.authorshipScore >= 70 ? "Primarily Human" : cert.authorshipScore >= 40 ? "Co-created" : "AI Assisted"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Certification Date */}
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Certified At</p>
                    <p className="font-semibold">{new Date(cert.certifiedAt).toLocaleString()}</p>
                  </div>
                </div>

                {/* Document Hash */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Document Hash</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted p-2 rounded font-mono break-all">
                      {cert.documentHash}
                    </code>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(cert.documentHash, "Hash")}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Blockchain TX */}
                {cert.txHash && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium">Blockchain Proof (Polygon)</span>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Transaction Hash</Label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs bg-muted p-2 rounded font-mono break-all">
                            {cert.txHash}
                          </code>
                          <a
                            href={`https://polygonscan.com/tx/${cert.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        </div>
                      </div>

                      {cert.blockNumber && (
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Block: #{cert.blockNumber}</span>
                          {cert.blockTimestamp && (
                            <span>Block Time: {new Date(cert.blockTimestamp).toLocaleString()}</span>
                          )}
                        </div>
                      )}

                      {cert.walletAddress && (
                        <div className="flex items-center gap-3">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Certifier Wallet</p>
                            <code className="text-xs font-mono">{cert.walletAddress}</code>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* On-Chain Verification */}
                {result.onChain?.exists && (
                  <>
                    <Separator />
                    <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                      <div className="flex items-center gap-2 text-green-600 text-sm font-medium mb-1">
                        <CheckCircle2 className="h-4 w-4" />
                        On-Chain Verification Confirmed
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This hash was independently verified on the Polygon blockchain smart contract.
                        Author: {result.onChain.author.slice(0, 8)}...{result.onChain.author.slice(-6)}
                      </p>
                    </div>
                  </>
                )}

                <Separator />

                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <Badge
                    variant={cert.status === "certified" ? "default" : "secondary"}
                    className={cert.status === "certified" ? "bg-green-600" : ""}
                  >
                    {cert.status.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Certification ID: #{cert.id}
                  </span>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {searched && !isLoading && !result && (
          <Card className="border-2 border-red-500/30">
            <CardContent className="py-8 text-center">
              <XCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
              <p className="font-medium text-red-600">Verification Failed</p>
              <p className="text-sm text-muted-foreground mt-1">
                Could not connect to the verification service. Please try again later.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>Powered by Boostify Music &bull; Polygon Blockchain</p>
          <p>Copyright certifications are permanent and publicly verifiable.</p>
        </div>
      </div>
    </div>
  );
}
