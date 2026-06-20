/**
 * Custom hook to verify access to advisors based on subscription plan
 */

import { useState, useEffect, useMemo } from 'react';
import { useSubscription } from '../lib/context/subscription-context';
import { advisorCallService } from '../lib/services/advisor-call-service';

/**
 * Interface for access verification result
 */
export interface AdvisorAccessResult {
  // Whether the user has access to the specific advisor
  hasAccess: boolean;
  // Whether they've reached the call limit
  hasReachedLimit: boolean;
  // Number of calls used
  callsUsed: number;
  // Total call limit
  callLimit: number;
  // Remaining calls
  callsRemaining: number;
  // Whether verification is loading
  isLoading: boolean;
  // Error if any
  error: string | null;
  // Descriptive message about the access
  message: string;
}

// Constant initial state to avoid recreations
const INITIAL_STATE: AdvisorAccessResult = {
  isLoading: true,
  error: null,
  hasAccess: false,
  hasReachedLimit: false,
  callsUsed: 0,
  callLimit: 0,
  callsRemaining: 0,
  message: 'Checking access...'
};

/**
 * Hook to verify if a user has access to a specific advisor
 * @param advisorId ID of the advisor to verify
 * @param freePlanAdvisors List of advisor IDs available in the free plan
 * @returns Result of the access verification
 */
export function useAdvisorAccess(
  advisorId: string,
  freePlanAdvisors: string[] = []
): AdvisorAccessResult {
  // Define all hooks first to maintain consistent order
  // Single state with initial state defined outside the function to avoid recreations
  const [state, setState] = useState<AdvisorAccessResult>(INITIAL_STATE);
  
  // Get subscription information
  const { subscription, isLoading: isSubscriptionLoading, currentPlan } = useSubscription();
  
  // Ensure consistent freePlanAdvisors
  const normalizedFreePlanAdvisors = useMemo(() => {
    return Array.isArray(freePlanAdvisors) ? freePlanAdvisors : [];
  }, [freePlanAdvisors]);
  
  // Effect to verify access
  useEffect(() => {
    let isMounted = true;
    
    const checkAccess = async () => {
      if (!isMounted) return;
      
      // Update loading state
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      try {
        // If we're still loading the subscription, wait
        if (isSubscriptionLoading) return;
        
        // Get current plan
        const plan = currentPlan || 'free';
        
        // Verify if the advisor is available in the current plan
        const advisorAvailable = advisorCallService.isAdvisorAvailableInPlan(
          advisorId,
          plan,
          normalizedFreePlanAdvisors
        );
        
        // Verify call limit and handle possible errors
        let limitCheck;
        try {
          limitCheck = await advisorCallService.hasReachedCallLimit(plan);
        } catch (limitError) {
          console.error('Error checking call limits:', limitError);
          
          if (!isMounted) return;
          
          // Use safe values in case of error
          limitCheck = {
            hasReachedLimit: false,
            callsUsed: 0,
            callLimit: advisorCallService.getMonthlyCallLimit(plan),
            callsRemaining: advisorCallService.getMonthlyCallLimit(plan)
          };
        }
        
        if (!isMounted) return;
        
        // Generate appropriate message according to the result
        let resultMessage = '';
        if (!advisorAvailable) {
          resultMessage = `This advisor is only available on higher tier plans. Upgrade your subscription to access.`;
        } else if (limitCheck.hasReachedLimit) {
          resultMessage = `You've reached your limit of ${limitCheck.callLimit} monthly calls. Upgrade your plan for more.`;
        } else {
          resultMessage = `You have ${limitCheck.callsRemaining} calls available this month.`;
        }
        
        // Update complete state
        setState({
          isLoading: false,
          error: null,
          hasAccess: advisorAvailable,
          hasReachedLimit: limitCheck.hasReachedLimit,
          callsUsed: limitCheck.callsUsed,
          callLimit: limitCheck.callLimit,
          callsRemaining: limitCheck.callsRemaining,
          message: resultMessage
        });
      } catch (err: any) {
        console.error('Error verifying advisor access:', err);
        
        if (!isMounted) return;
        
        // Update state in case of general error
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: err.message || 'Error verifying access',
          message: 'Unable to verify your access. Please try again.'
        }));
      }
    };
    
    // Execute verification
    checkAccess();
    
    // Cleanup when unmounting
    return () => {
      isMounted = false;
    };
  }, [advisorId, normalizedFreePlanAdvisors, subscription, isSubscriptionLoading, currentPlan]);
  
  return state;
}