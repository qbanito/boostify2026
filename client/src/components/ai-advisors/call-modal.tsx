/**
 * Modal for making calls to AI advisors
 * Fixed version with optimized useEffect hooks to prevent infinite loops
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { useToast } from '../../hooks/use-toast';
import { useSubscription } from '../../lib/context/subscription-context';
import { advisorCallService, Advisor, ADVISOR_PHONE_NUMBER } from '../../lib/services/advisor-call-service';
import { useAdvisorAccess } from '../../hooks/use-advisor-access';
import { motion } from 'framer-motion';

// UI Components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Progress } from '../../components/ui/progress';
import { Badge } from '../../components/ui/badge';

// Icons
import {
  Phone,
  PhoneOff,
  MessageSquare,
  Clock,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// Maximum call duration in seconds (5 minutes)
const MAX_CALL_DURATION = 300;

interface CallModalProps {
  advisor: Advisor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CallModal({ advisor, open, onOpenChange }: CallModalProps) {
  // Define all hooks first in the same order on every render
  const { user } = useAuth();
  const { subscription, currentPlan } = useSubscription();
  const [calling, setCalling] = useState(false);
  const [connected, setConnected] = useState(false);
  const [notes, setNotes] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [callTimer, setCallTimer] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  
  // Create a ref to track if we've already triggered the call simulation
  // This helps prevent the infinite loop by ensuring we only trigger once
  const hasCalledRef = useRef(false);
  
  // Verify access to the advisor based on the plan
  // Using empty string as fallback when advisor is null to maintain hook call
  const { hasAccess, hasReachedLimit, callsRemaining, isLoading } = useAdvisorAccess(
    advisor?.id || '', // Safe access with fallback
    ['publicist'] // Advisors available in the free plan
  );
  
  // Create stable advisor values first that won't change every render (preventing infinite loops)
  const advisorId = useMemo(() => advisor?.id || '', [advisor?.id]);
  const advisorName = useMemo(() => advisor?.name || 'Advisor', [advisor?.id]);
  const advisorTitle = useMemo(() => advisor?.title || 'Specialist', [advisor?.id]);
  
  // End call function declaration - memoized with stable values
  const endCall = useCallback(async () => {
    // Stop the timer
    if (callTimer) {
      clearInterval(callTimer);
      setCallTimer(null);
    }
    
    // If the call was connected, register in Firestore
    if (connected && user && advisor) {
      try {
        // Register the call in Firestore
        await advisorCallService.registerCall(
          advisor,
          callDuration,
          notes,
          [], // No specific topics for now
          'completed',
          currentPlan
        );
        
        toast({
          title: "Call ended",
          description: `Your call with ${advisorName} has been recorded.`,
        });
      } catch (error) {
        console.error('Error registering call:', error);
        toast({
          title: "Error registering call",
          description: "Could not save the call record.",
          variant: "destructive"
        });
      }
    }
    
    // Close the modal
    onOpenChange(false);
    
    // Reset the state
    setCalling(false);
    setConnected(false);
    setNotes('');
    setCallDuration(0);
    hasCalledRef.current = false;
  }, [callTimer, connected, user, advisorId, advisorName, callDuration, notes, currentPlan, toast, onOpenChange]);
  
  // Start call timer function
  const startCallTimer = useCallback(() => {
    // Start an interval to update duration every second
    const timer = setInterval(() => {
      setCallDuration(prev => {
        // If maximum duration is reached, end the call
        if (prev >= MAX_CALL_DURATION) {
          endCall();
          return MAX_CALL_DURATION;
        }
        return prev + 1;
      });
    }, 1000);
    
    setCallTimer(timer);
  }, [endCall]);
  
  // Simulate call function - memoized with stable dependencies
  const simulateCall = useCallback(() => {
    if (!user || !advisor) return;
    
    setCalling(true);
    
    // Simulate connection time (2 seconds)
    setTimeout(() => {
      setCalling(false);
      setConnected(true);
      
      // Start call duration timer
      startCallTimer();
      
      toast({
        title: "Call connected",
        description: `You're talking with ${advisorName}, your ${advisorTitle.toLowerCase()}.`,
      });
      
      // Start the actual phone call to the configured number
      try {
        const phoneNumber = ADVISOR_PHONE_NUMBER.replace(/\s+/g, '');
        window.open(`tel:${phoneNumber}`, '_blank');
        console.log(`Simulating call to: ${advisorName} (${advisorId})`);
      } catch (error) {
        console.error('Error initiating phone call:', error);
      }
      
    }, 2000);
  }, [user, advisorId, advisorName, advisorTitle, startCallTimer, toast]);
  
  // Cancel the call - memoized with stable dependencies
  const cancelCall = useCallback(async () => {
    // Stop the timer
    if (callTimer) {
      clearInterval(callTimer);
      setCallTimer(null);
    }
    
    // If the call was connected, register as canceled
    if (connected && user && advisor) {
      try {
        // Register the canceled call in Firestore
        await advisorCallService.registerCall(
          advisor,
          callDuration,
          notes,
          [],
          'cancelled',
          currentPlan
        );
      } catch (error) {
        console.error('Error registering cancelled call:', error);
      }
    }
    
    // Close the modal
    onOpenChange(false);
    
    // Reset the state
    setCalling(false);
    setConnected(false);
    setNotes('');
    setCallDuration(0);
    hasCalledRef.current = false;
  }, [callTimer, connected, user, advisorId, callDuration, notes, currentPlan, onOpenChange]);
  
  // Reset call state function
  const resetCallState = useCallback(() => {
    setCalling(false);
    setConnected(false);
    setNotes('');
    setCallDuration(0);
    if (callTimer) {
      clearInterval(callTimer);
      setCallTimer(null);
    }
    hasCalledRef.current = false;
  }, [callTimer]);
  
  // Effect to initiate the call when the modal opens
  useEffect(() => {
    // Only run the simulation when the modal is open, the user has access,
    // and we haven't already triggered the call
    if (open && advisor && hasAccess && !isLoading && !hasCalledRef.current) {
      hasCalledRef.current = true; // Mark that we've triggered the call
      simulateCall();
    } 
    // If the modal is closed, clean up the state
    else if (!open) {
      resetCallState();
    }
    
    // Clean up when unmounting
    return () => {
      if (callTimer) {
        clearInterval(callTimer);
      }
    };
  // Remove simulateCall from dependencies to avoid infinite renders 
  // since it changes on every render due to advisor dependency
  // We use hasCalledRef to track if we've run it already
  }, [open, advisor?.id, hasAccess, isLoading, resetCallState]);
  
  // If advisor is not defined, don't show the modal but after all hooks are called
  if (!advisor) return null;
  
  // Format duration in minutes:seconds
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // Calculate percentage of elapsed time
  const durationPercentage = (callDuration / MAX_CALL_DURATION) * 100;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md border-[#27272A] bg-[#16161A] text-white" 
        aria-describedby="advisor-dialog-description"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center text-white">
            {calling ? (
              <span className="flex items-center">
                <span className="animate-pulse mr-2">📞</span> 
                Calling...
              </span>
            ) : connected ? (
              <div className="flex items-center justify-between w-full">
                <span>Connected with {advisor.name}</span>
                <Badge variant="outline" className="ml-2">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatDuration(callDuration)}
                </Badge>
              </div>
            ) : (
              <span>
                {hasAccess ? 'Connecting to advisor...' : 'Restricted Access'}
              </span>
            )}
          </DialogTitle>
          <DialogDescription id="advisor-dialog-description" className="text-gray-400">
            {calling ? (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="relative w-24 h-24 mb-4">
                  <motion.div 
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 to-pink-500"
                    animate={{ 
                      scale: [1, 1.1, 1],
                      opacity: [0.5, 0.8, 0.5]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-12 w-12 text-white animate-spin" />
                  </div>
                </div>
                <p className="text-center text-sm text-gray-400">
                  Connecting with {advisor.name}, your {advisor.title.toLowerCase()}...
                </p>
                <p className="text-center text-sm font-medium text-gray-200 mt-4">
                  Dialing: {ADVISOR_PHONE_NUMBER}
                </p>
              </div>
            ) : connected ? (
              <div className="py-4 space-y-4">
                <div className="flex items-start gap-4">
                  <div className={`flex p-3 rounded-full bg-gradient-to-br ${advisor.color}`}>
                    <Phone className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{advisor.name}</h3>
                    <p className="text-xs font-medium text-gray-400">{advisor.title}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {advisor.description}
                    </p>
                    <p className="text-xs font-medium text-gray-300 mt-2">
                      Contact number: {ADVISOR_PHONE_NUMBER}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between text-xs">
                    <span>Remaining call time</span>
                    <span>{formatDuration(MAX_CALL_DURATION - callDuration)}</span>
                  </div>
                  <Progress 
                    value={durationPercentage} 
                    className={`h-2 ${
                      durationPercentage > 80 ? 'bg-red-200' : 
                      durationPercentage > 60 ? 'bg-amber-200' : 'bg-muted'
                    }`}
                  />
                </div>
                
                <div className="mt-4">
                  <Textarea
                    placeholder="Take notes of your conversation here..."
                    className="h-24 text-sm bg-[#1C1C24] border-[#27272A] resize-none"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div>
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <Loader2 className="h-12 w-12 text-gray-400 animate-spin" />
                    <p className="text-center text-sm text-gray-400 mt-4">
                      Verifying your access...
                    </p>
                  </div>
                ) : !hasAccess ? (
                  <div className="flex flex-col items-center py-6">
                    {hasReachedLimit ? (
                      <div className="text-center space-y-2">
                        <PhoneOff className="h-12 w-12 text-orange-500 mx-auto mb-2" />
                        <h3 className="text-lg font-medium text-white">Call limit reached</h3>
                        <p className="text-sm text-gray-400">
                          You've reached your limit of {advisorCallService.getMonthlyCallLimit(currentPlan)} monthly calls with your {currentPlan} plan.
                        </p>
                        <p className="text-sm text-gray-400">
                          Upgrade to a higher plan to get more calls.
                        </p>
                      </div>
                    ) : (
                      <div className="text-center space-y-2">
                        <PhoneOff className="h-12 w-12 text-orange-500 mx-auto mb-2" />
                        <h3 className="text-lg font-medium text-white">Advisor not available on your plan</h3>
                        <p className="text-sm text-gray-400">
                          This advisor is only available on the PRO plan or higher.
                        </p>
                        <p className="text-sm text-gray-400">
                          Upgrade your plan to access the full team of advisors.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm italic text-gray-400 space-y-4">
                    <p>
                      This advisor will provide professional advice in their area of expertise.
                    </p>
                    <div className="flex items-center justify-center bg-gradient-to-r from-gray-800 to-gray-900 p-3 rounded-md">
                      <Phone className="h-4 w-4 mr-2 text-amber-500" />
                      <span className="text-white">Contact number: {ADVISOR_PHONE_NUMBER}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          {!hasAccess && !isLoading ? (
            <Button
              type="button" 
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
              onClick={() => window.location.href = '/pricing'}
            >
              Upgrade Plan
            </Button>
          ) : connected ? (
            <div className="w-full grid grid-cols-2 gap-2">
              <Button
                type="button" 
                variant="outline" 
                className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                onClick={endCall}
              >
                <PhoneOff className="h-4 w-4 mr-2" />
                End Call
              </Button>
              <Button
                type="button" 
                variant="default"
                className="bg-orange-500 hover:bg-orange-600"
                onClick={endCall}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Save Notes
              </Button>
            </div>
          ) : calling ? (
            <Button
              type="button" 
              variant="destructive"
              onClick={cancelCall}
            >
              Cancel
            </Button>
          ) : !isLoading && hasAccess ? (
            <Button
              type="button" 
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              onClick={simulateCall}
            >
              <Phone className="h-4 w-4 mr-2" />
              Call Now
            </Button>
          ) : (
            <Button
              type="button" 
              variant="outline" 
              className="border-gray-600 text-gray-400 hover:bg-gray-800"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}