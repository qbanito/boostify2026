/**
 * Modal para realizar llamadas a asesores de IA
 * Versión ultra simplificada para evitar bucles infinitos
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { useToast } from '../../hooks/use-toast';
import { useSubscription } from '../../lib/context/subscription-context';
import { advisorCallService, Advisor, ADVISOR_PHONE_NUMBER } from '../../lib/services/advisor-call-service';
import { motion } from 'framer-motion';
import { useCallLimits } from '../../hooks/use-advisor-call-history';

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
  // State
  const { user } = useAuth();
  const { subscription, currentPlan } = useSubscription();
  const [calling, setCalling] = React.useState(false);
  const [connected, setConnected] = React.useState(false);
  const [notes, setNotes] = React.useState('');
  const [callDuration, setCallDuration] = React.useState(0);
  const [callTimer, setCallTimer] = React.useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  
  // Ref to prevent multiple simultaneous calls
  const hasCalledRef = useRef(false);
  
  // Check access permissions
  const { hasReachedLimit, callsRemaining, isLoading } = useCallLimits(currentPlan);
  
  // Determine if advisor is available in current plan
  const hasAccess = React.useMemo(() => {
    // Only publicist is available in free plan
    if (currentPlan === 'free') {
      return advisor?.id === 'publicist';
    }
    // Basic plan gets access to first 4 advisors
    else if (currentPlan === 'basic') {
      return ['publicist', 'manager', 'producer', 'creative'].includes(advisor?.id || '');
    }
    // Pro and premium get access to all advisors
    else {
      return true;
    }
  }, [advisor?.id, currentPlan]);
  
  // Clean up when unmounting or closing
  React.useEffect(() => {
    if (!open) {
      // Reset state when modal is closed
      setCalling(false);
      setConnected(false);
      setNotes('');
      setCallDuration(0);
      hasCalledRef.current = false;
      
      // Clear any timers
      if (callTimer) {
        clearInterval(callTimer);
        setCallTimer(null);
      }
    }
    
    // Clean up on unmount
    return () => {
      if (callTimer) {
        clearInterval(callTimer);
      }
    };
  }, [open, callTimer]);
  
  // Format duration helper
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // Calculate percentage of time
  const durationPercentage = (callDuration / MAX_CALL_DURATION) * 100;
  
  // Simple handlers without dependencies
  const handleStartCall = () => {
    if (!user || !advisor) return;
    
    setCalling(true);
    
    // Simulate connection time
    setTimeout(() => {
      setCalling(false);
      setConnected(true);
      
      // Start timer
      const timer = setInterval(() => {
        setCallDuration(prev => {
          if (prev >= MAX_CALL_DURATION) {
            // End call if time is up
            clearInterval(timer);
            return MAX_CALL_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
      
      setCallTimer(timer);
      
      // Show toast
      toast({
        title: "Call connected",
        description: `You're talking with ${advisor.name}, your ${advisor.title.toLowerCase()}.`,
      });
      
      // Simulate phone call
      try {
        const phoneNumber = ADVISOR_PHONE_NUMBER.replace(/\s+/g, '');
        window.open(`tel:${phoneNumber}`, '_blank');
      } catch (error) {
        console.error('Error initiating phone call:', error);
      }
    }, 2000);
  };
  
  const handleEndCall = async () => {
    // Stop timer
    if (callTimer) {
      clearInterval(callTimer);
      setCallTimer(null);
    }
    
    // Save call record
    if (connected && user && advisor) {
      try {
        await advisorCallService.registerCall(
          advisor,
          callDuration,
          notes,
          [],
          'completed',
          currentPlan
        );
        
        toast({
          title: "Call ended",
          description: `Your call with ${advisor.name} has been recorded.`,
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
    
    // Close modal and reset
    onOpenChange(false);
  };
  
  const handleCancelCall = () => {
    // Stop timer
    if (callTimer) {
      clearInterval(callTimer);
      setCallTimer(null);
    }
    
    // Close and reset
    onOpenChange(false);
  };
  
  // If advisor is not defined, don't show the modal
  if (!advisor) return null;
  
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
                onClick={handleEndCall}
              >
                <PhoneOff className="h-4 w-4 mr-2" />
                End Call
              </Button>
              <Button
                type="button" 
                variant="default"
                className="bg-orange-500 hover:bg-orange-600"
                onClick={handleEndCall}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Save Notes
              </Button>
            </div>
          ) : calling ? (
            <Button
              type="button" 
              variant="destructive"
              onClick={handleCancelCall}
            >
              Cancel
            </Button>
          ) : !isLoading && hasAccess ? (
            <Button
              type="button" 
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              onClick={handleStartCall}
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