import React, { useState } from 'react';
import { useRoute, Link } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle2, AlertCircle, QrCode, ShieldCheck } from 'lucide-react';

export default function SmartMerchActivationPage() {
  const [match, params] = useRoute('/activate/:artistId/:productId/:serialId');
  const artistId = params?.artistId || '';
  const productId = params?.productId || '';
  const serialId = params?.serialId || '';

  const [fanName, setFanName] = useState('');
  const [fanEmail, setFanEmail] = useState('');

  const detailQuery = useQuery({
    queryKey: ['smart-merch-activation', artistId, productId, serialId],
    queryFn: async () => {
      const res = await fetch(`/api/smart-merch/activate/${artistId}/${productId}/${serialId}`, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Activation serial not found');
      return json;
    },
    enabled: !!match,
    staleTime: 30000,
  });

  const activate = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/smart-merch/activate/${artistId}/${productId}/${serialId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fanName: fanName || undefined, fanEmail: fanEmail || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not activate unlock');
      return json;
    },
    onSuccess: async () => {
      await detailQuery.refetch();
    },
  });

  if (!match) return null;

  const accent = '#22d3ee';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white px-4 py-10">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-semibold">
            <QrCode className="h-3.5 w-3.5" /> BOOSTIFY SMART MERCH ACTIVATION
          </div>
          <h1 className="text-2xl font-bold mt-3">Unlock Your Smart Product</h1>
          <p className="text-sm text-slate-400 mt-2">Scan validated. Activate your NFC/QR collectible to access exclusive content.</p>
        </div>

        <div className="rounded-2xl border border-cyan-400/30 bg-slate-900/70 backdrop-blur p-5">
          {detailQuery.isLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-cyan-300" /></div>
          ) : detailQuery.isError ? (
            <div className="text-center py-8">
              <AlertCircle className="h-9 w-9 text-red-400 mx-auto" />
              <p className="text-red-300 mt-2">{(detailQuery.error as Error)?.message || 'Activation serial not found'}</p>
              <Link href="/" className="text-cyan-300 text-sm mt-4 inline-block">Return home</Link>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-cyan-500/30 bg-black/30 p-3">
                <p className="text-xs text-slate-400">Product</p>
                <p className="text-sm font-semibold">{detailQuery.data?.unlock?.productTitle || 'Smart Merch Item'}</p>
                <p className="text-xs text-cyan-300 mt-1">Unlock type: {detailQuery.data?.unlock?.unlockType || 'exclusive-content'}</p>
              </div>

              {detailQuery.data?.serial?.isActivated ? (
                <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
                  <CheckCircle2 className="h-9 w-9 text-emerald-300 mx-auto" />
                  <p className="text-emerald-200 font-semibold mt-2">Already activated</p>
                  <p className="text-xs text-emerald-100/80 mt-1">Your unlock is linked and ready to use.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <input value={fanName} onChange={(e) => setFanName(e.target.value)} placeholder="Your name (optional)"
                    className="w-full px-3 py-2 rounded-lg bg-black/40 border border-cyan-500/30 text-sm outline-none" />
                  <input value={fanEmail} onChange={(e) => setFanEmail(e.target.value)} placeholder="Your email (optional)" type="email"
                    className="w-full px-3 py-2 rounded-lg bg-black/40 border border-cyan-500/30 text-sm outline-none" />

                  <button
                    onClick={() => activate.mutate()}
                    disabled={activate.isPending}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold bg-cyan-400 text-black disabled:opacity-60"
                  >
                    {activate.isPending ? (
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Activating...</span>
                    ) : 'Activate Unlock'}
                  </button>

                  {activate.isError && (
                    <p className="text-xs text-red-300 inline-flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> {(activate.error as Error)?.message || 'Activation failed'}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-5 rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                <p className="text-xs text-slate-300 inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Verified smart serial</p>
                <p className="text-[11px] text-slate-500 mt-1 break-all">{serialId}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
