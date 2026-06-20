/**
 * Follow Button — Follow/unfollow a social_users profile
 * Shows follower count; notifies the target user via email on follow
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  /** social_users.id (varchar) of the target */
  targetSocialUserId: string;
  /** social_users.id (varchar) of the current user */
  currentSocialUserId?: string;
  followersCount?: number;
  className?: string;
}

export function FollowButton({ targetSocialUserId, currentSocialUserId, followersCount = 0, className }: FollowButtonProps) {
  const [localCount, setLocalCount] = useState(followersCount);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Check if already following
  const { data: followers = [] } = useQuery({
    queryKey: [`/api/social-integration/followers/${targetSocialUserId}`],
    enabled: !!currentSocialUserId,
  });
  const isFollowing = Array.isArray(followers) && followers.some((f: any) => f.id === currentSocialUserId);

  const follow = useMutation({
    mutationFn: () => apiRequest("POST", "/api/social-integration/follow", {
      followerId: currentSocialUserId,
      followingId: targetSocialUserId,
    }),
    onSuccess: () => {
      setLocalCount((c) => c + 1);
      qc.invalidateQueries({ queryKey: [`/api/social-integration/followers/${targetSocialUserId}`] });
      toast({ title: "✅ Following" });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const unfollow = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/social-integration/follow", {
      followerId: currentSocialUserId,
      followingId: targetSocialUserId,
    }),
    onSuccess: () => {
      setLocalCount((c) => Math.max(0, c - 1));
      qc.invalidateQueries({ queryKey: [`/api/social-integration/followers/${targetSocialUserId}`] });
      toast({ title: "Unfollowed" });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  if (!currentSocialUserId) return null;
  if (currentSocialUserId === targetSocialUserId) return null;

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      size="sm"
      onClick={() => isFollowing ? unfollow.mutate() : follow.mutate()}
      disabled={follow.isPending || unfollow.isPending}
      className={cn(
        "gap-1.5 text-xs",
        isFollowing
          ? "border-white/20 text-gray-300 hover:text-red-400 hover:border-red-400/40"
          : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0",
        className
      )}
    >
      {isFollowing ? (
        <><UserCheck className="h-3.5 w-3.5" /> Following</>
      ) : (
        <><UserPlus className="h-3.5 w-3.5" /> Follow</>
      )}
      {localCount > 0 && (
        <span className="ml-1 text-[10px] opacity-70">{localCount}</span>
      )}
    </Button>
  );
}
