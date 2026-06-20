// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: /investors
// Investor Portal Entry Point — Redirects to Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { useLocation } from 'wouter';

const InvestorsPage = () => {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect to investors dashboard
    setLocation('/investors-dashboard');
  }, [setLocation]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <p className="text-white text-lg">Redirecting to Investor Dashboard...</p>
      </div>
    </div>
  );
};

export default InvestorsPage;
