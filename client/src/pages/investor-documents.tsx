// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: /investor-documents
// Investor Negotiation UI — Full Negotiation Thread with Juno 2.0 Analysis
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { Header } from '../components/layout/header';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FileText, Send, Download, CheckCircle, AlertCircle, Clock, Zap, DollarSign, Users } from 'lucide-react';
import { useAuth } from '../hooks/use-auth';
import { useLocation } from 'wouter';

const InvestorDocumentsPage = () => {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedNegotiationId, setSelectedNegotiationId] = useState<string | null>(null);
  const [proposedTerms, setProposedTerms] = useState<any>({});
  const [submittingProposal, setSubmittingProposal] = useState(false);

  // Note: Allow unauthenticated access in dev mode for testing
  // In production, protected by API layer (resolveNumericUserId checks auth)

  // Demo data for unauthenticated users
  const demoDocuments = {
    documents: [
      {
        id: 'demo-1',
        title: 'Series A - Round 1',
        status: 'counter',
        negotiationId: 'demo-neg-1'
      },
      {
        id: 'demo-2',
        title: 'SAFE Agreement',
        status: 'pending',
        negotiationId: 'demo-neg-2'
      }
    ]
  };

  // Fetch investor documents (from Firestore via API)
  const { data: docs, isLoading } = useQuery({
    queryKey: ['investor-documents', user?.id],
    queryFn: async () => {
      // Use demo endpoint if not authenticated; otherwise use real user endpoint
      const endpoint = user?.id 
        ? `/api/investor-docs/${user.id}`
        : '/api/investor-docs/demo/all';
      
      const headers: any = {};
      if (user?.id && user.getIdToken) {
        headers.Authorization = `Bearer ${await user.getIdToken()}`;
      }
      
      const response = await fetch(endpoint, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: true // Always enabled
  });

  // Demo negotiation data
  const demoNegotiations: Record<string, any> = {
    'demo-neg-1': {
      success: true,
      currentProposal: {
        proposedBy: 'LEAD INVESTOR',
        proposedTerms: {
          valuation: '$50M',
          discount: '25%',
          boardSeat: true,
          proRata: '2x'
        },
        cloVerdict: {
          verdict: 'counter_propose',
          riskScore: 0.42,
          reasoning: 'Valuation is below our $40.9M minimum threshold and discount exceeds our 22% policy limit. Recommend counter-propose with market-standard terms.',
          counterProposal: {
            valuation: '$52M',
            discount: '18%',
            boardSeat: false,
            proRata: '1.5x'
          }
        }
      },
      proposals: [
        {
          id: 'p1',
          proposedBy: 'INVESTOR',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'p2',
          proposedBy: 'BOOSTIFY',
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    },
    'demo-neg-2': {
      success: true,
      currentProposal: {
        proposedBy: 'BOOSTIFY',
        proposedTerms: {
          cap: '$75M',
          discount: '15%',
          mfn: true
        },
        cloVerdict: {
          verdict: 'auto_approve',
          riskScore: 0.12,
          reasoning: 'Terms align perfectly with SAFE best practices. Valuation cap is reasonable, discount is conservative, and MFN is standard. Recommend immediate approval.',
          counterProposal: null
        }
      },
      proposals: [
        {
          id: 'p3',
          proposedBy: 'INVESTOR',
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    }
  };

  // Fetch negotiation thread (from API)
  const { data: negotiation } = useQuery({
    queryKey: ['investor-negotiation', selectedNegotiationId],
    queryFn: async () => {
      if (selectedNegotiationId?.startsWith('demo-')) {
        return demoNegotiations[selectedNegotiationId] || { success: false };
      }
      const response = await fetch(`/api/investor-docs/${selectedNegotiationId}/negotiation`);
      if (!response.ok) {
        throw new Error(`Failed to fetch negotiation: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!selectedNegotiationId
  });

  // Submit proposal mutation
  const submitProposal = useMutation({
    mutationFn: async ({ docId, terms }: any) => {
      const response = await fetch(`/api/investor-docs/${docId}/proposals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user?.getIdToken?.()}`
        },
        body: JSON.stringify({ proposedTerms: terms })
      });
      return response.json();
    },
    onSuccess: () => {
      // Refresh negotiation
      setProposedTerms({});
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white">Loading documents...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🏛️ Investment Documents
          </h1>
          <p className="text-gray-400">
            Review and negotiate terms with Juno 2.0, our AI Chief Legal Officer
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar: Document List */}
          <div className="lg:col-span-1">
            <Card className="bg-black/40 border-orange-500/20 h-fit sticky top-20">
              <div className="p-6">
                <h2 className="text-lg font-bold text-white mb-4">📋 Documents</h2>
                
                {docs?.documents?.length ? (
                  <div className="space-y-2">
                    {docs.documents.map((doc: any) => (
                      <button
                        key={doc.id}
                        onClick={() => setSelectedNegotiationId(doc.negotiationId)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selectedNegotiationId === doc.negotiationId
                            ? 'bg-orange-500/20 border-orange-500/50'
                            : 'border-white/10 hover:border-orange-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="w-4 h-4 text-orange-400" />
                          <span className="text-sm font-medium text-white">{doc.title}</span>
                        </div>
                        <span className={`text-xs ${
                          doc.status === 'signed' ? 'text-green-400' :
                          doc.status === 'accepted' ? 'text-green-400' :
                          doc.status === 'counter' ? 'text-yellow-400' :
                          'text-gray-400'
                        }`}>
                          {doc.status}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No documents yet</p>
                )}
              </div>
            </Card>
          </div>

          {/* Main Area: Negotiation Thread */}
          <div className="lg:col-span-2">
            {selectedNegotiationId && negotiation?.success ? (
              <div className="space-y-6">
                {/* Current Proposal */}
                {negotiation.currentProposal && (
                  <Card className="bg-black/40 border-orange-500/20 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Clock className="w-5 h-5 text-orange-400" />
                      <h3 className="text-lg font-bold text-white">Current Proposal</h3>
                    </div>

                    <div className="space-y-4 mb-6">
                      {/* CLO Analysis */}
                      {negotiation.currentProposal.cloVerdict && (
                        <div className={`p-4 rounded-lg border ${
                          negotiation.currentProposal.cloVerdict.verdict === 'auto_approve' ? 'bg-green-500/10 border-green-500/30' :
                          negotiation.currentProposal.cloVerdict.verdict === 'counter_propose' ? 'bg-yellow-500/10 border-yellow-500/30' :
                          'bg-red-500/10 border-red-500/30'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className={`w-5 h-5 ${
                              negotiation.currentProposal.cloVerdict.verdict === 'auto_approve' ? 'text-green-400' :
                              negotiation.currentProposal.cloVerdict.verdict === 'counter_propose' ? 'text-yellow-400' :
                              'text-red-400'
                            }`} />
                            <span className={`font-semibold ${
                              negotiation.currentProposal.cloVerdict.verdict === 'auto_approve' ? 'text-green-300' :
                              negotiation.currentProposal.cloVerdict.verdict === 'counter_propose' ? 'text-yellow-300' :
                              'text-red-300'
                            }`}>
                              Juno 2.0 Analysis: {negotiation.currentProposal.cloVerdict.verdict.toUpperCase()}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-300 mb-3">
                            {negotiation.currentProposal.cloVerdict.reasoning}
                          </p>

                          {negotiation.currentProposal.cloVerdict.counterProposal && (
                            <div className="mt-4 p-3 bg-black/40 rounded border border-orange-500/20">
                              <p className="text-xs font-semibold text-orange-300 mb-2">✨ Juno's Counter-Proposal:</p>
                              <div className="text-sm text-gray-400 space-y-1">
                                {Object.entries(negotiation.currentProposal.cloVerdict.counterProposal).map(([key, value]) => (
                                  <div key={key} className="flex justify-between">
                                    <span>{key}:</span>
                                    <span className="text-orange-300 font-semibold">{JSON.stringify(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Investor Proposed Terms */}
                      <div className="bg-black/40 p-4 rounded-lg border border-white/10">
                        <h4 className="text-sm font-semibold text-white mb-2">📊 Investor Proposed Terms:</h4>
                        <div className="text-sm text-gray-400 space-y-1">
                          {Object.entries(negotiation.currentProposal.proposedTerms).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-gray-500">{key}:</span>
                              <span className="text-white">{JSON.stringify(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => alert('Acceptance flow TBD')}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Accept Proposal
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-orange-500/50 text-orange-300 hover:bg-orange-500/10"
                        onClick={() => alert('Counter-propose flow TBD')}
                      >
                        💬 Make Counter-Offer
                      </Button>
                    </div>
                  </Card>
                )}

                {/* Negotiation History */}
                {negotiation.proposals?.length > 0 && (
                  <Card className="bg-black/40 border-orange-500/20 p-6">
                    <h3 className="text-lg font-bold text-white mb-4">📜 Negotiation History</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {negotiation.proposals.map((proposal: any, idx: number) => (
                        <div key={proposal.id} className="p-3 bg-black/40 rounded border border-white/5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-orange-400">Round {idx + 1}</span>
                            <span className="text-xs text-gray-500">•</span>
                            <span className="text-xs text-gray-500">
                              {new Date(proposal.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400">
                            <strong className="text-orange-300">{proposal.proposedBy}:</strong> Proposed new terms
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="bg-black/40 border-orange-500/20 p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">Select a document to view negotiation details</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvestorDocumentsPage;
