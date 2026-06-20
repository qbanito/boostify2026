import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Legacy route. The standalone "affiliates-new" page used hardcoded mock data and
 * has been superseded by the real, fully-wired affiliate dashboard at /affiliates.
 * This component just redirects to the canonical page so old links keep working.
 */
export default function AffiliatesNewPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/affiliates");
  }, [setLocation]);

  return null;
}
