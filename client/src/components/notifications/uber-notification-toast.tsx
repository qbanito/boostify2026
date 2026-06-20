import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { useLocation } from "wouter";
import { 
  Bell, Guitar, Drum, Piano, Mic2, Headphones, Music,
  DollarSign, CheckCircle, X, ChevronRight, Zap
} from "lucide-react";

const INSTRUMENT_ICONS: Record<string, any> = {
  Guitar, Drums: Drum, Piano, Vocals: Mic2, Production: Headphones,
};

interface UberNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: any;
  createdAt: string;
}

export function UberNotificationToast() {
  const [, navigate] = useLocation();
  const [activeNotification, setActiveNotification] = useState<UberNotification | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const [lastCheckTime, setLastCheckTime] = useState(Date.now());

  // Poll for new notifications every 15 seconds
  const { data: notificationsData } = useQuery({
    queryKey: ["/api/notifications", "uber-poll"],
    queryFn: () => apiRequest("GET", "/api/notifications"),
    refetchInterval: 15000,
  });

  // Check for new service-related notifications
  useEffect(() => {
    if (!notificationsData?.notifications) return;

    const serviceTypes = ["SERVICE_REQUEST_NEW", "BID_RECEIVED", "BID_ACCEPTED", "BID_REJECTED"];
    const newNotifications = notificationsData.notifications.filter(
      (n: UberNotification) =>
        serviceTypes.includes(n.type) &&
        !n.read &&
        !dismissedIds.has(n.id) &&
        new Date(n.createdAt).getTime() > lastCheckTime - 60000
    );

    if (newNotifications.length > 0 && !activeNotification) {
      setActiveNotification(newNotifications[0]);
      // Play notification sound
      try {
        const audio = new Audio("data:audio/wav;base64,UklGRlgFAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTQFAACAgICAgICAgICAgICAgICAgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/v/+/f38+/r5+Pf29fTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPS0dDPzs3My8rJyMfGxcTDwsHAv769vLu6ubm4t7a1tLOysbCvrq2sq6qpqKempaSjoqGgn56dnJuamZiXlpWUk5KRkI+OjYyLiomIh4aFhIOCgYCAgICAgICAgIA=");
        audio.volume = 0.3;
        audio.play().catch(() => {});
      } catch {}
    }
  }, [notificationsData, dismissedIds, activeNotification, lastCheckTime]);

  const handleDismiss = useCallback(() => {
    if (activeNotification) {
      setDismissedIds(prev => new Set([...prev, activeNotification.id]));
      setActiveNotification(null);
      setLastCheckTime(Date.now());
    }
  }, [activeNotification]);

  const handleAction = useCallback(() => {
    if (activeNotification?.link) {
      navigate(activeNotification.link);
    }
    handleDismiss();
  }, [activeNotification, navigate, handleDismiss]);

  // Auto-dismiss after 12 seconds
  useEffect(() => {
    if (!activeNotification) return;
    const timer = setTimeout(handleDismiss, 12000);
    return () => clearTimeout(timer);
  }, [activeNotification, handleDismiss]);

  const getNotificationStyle = (type: string) => {
    switch (type) {
      case "SERVICE_REQUEST_NEW":
        return { gradient: "from-orange-500 to-amber-600", icon: Zap, label: "NEW GIG" };
      case "BID_RECEIVED":
        return { gradient: "from-blue-500 to-cyan-600", icon: DollarSign, label: "NEW BID" };
      case "BID_ACCEPTED":
        return { gradient: "from-green-500 to-emerald-600", icon: CheckCircle, label: "BID WON" };
      default:
        return { gradient: "from-purple-500 to-pink-600", icon: Bell, label: "UPDATE" };
    }
  };

  return (
    <AnimatePresence>
      {activeNotification && (
        <motion.div
          initial={{ y: -100, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -100, opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[95vw] max-w-md"
        >
          <div className={`bg-gradient-to-r ${getNotificationStyle(activeNotification.type).gradient} rounded-2xl shadow-2xl overflow-hidden`}>
            {/* Progress bar */}
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 12, ease: "linear" }}
              className="h-1 bg-white/30"
            />
            
            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  {(() => {
                    const Icon = getNotificationStyle(activeNotification.type).icon;
                    return <Icon className="h-6 w-6 text-white" />;
                  })()}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-white/20 text-white text-[10px] font-bold border-0">
                      {getNotificationStyle(activeNotification.type).label}
                    </Badge>
                  </div>
                  <h4 className="text-white font-bold text-sm mt-1 truncate">
                    {activeNotification.title}
                  </h4>
                  <p className="text-white/80 text-xs mt-0.5 line-clamp-2">
                    {activeNotification.message}
                  </p>
                </div>

                {/* Close */}
                <button
                  onClick={handleDismiss}
                  className="text-white/60 hover:text-white p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Action button */}
              {activeNotification.link && (
                <Button
                  onClick={handleAction}
                  className="w-full mt-3 bg-white/20 hover:bg-white/30 text-white border-0 rounded-xl"
                  size="sm"
                >
                  View Details <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
