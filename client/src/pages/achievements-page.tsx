import { useQuery } from "@tanstack/react-query";
import { AchievementBadge } from "../components/ui/achievement-badge";
import { Loader2 } from "lucide-react";

export default function AchievementsPage() {
  const { data: achievements, isLoading } = useQuery<{
    achievement: {
      id: number;
      name: string;
      description: string;
      badgeImage: string;
      type: string;
    };
    earnedAt: string;
    metadata: any;
  }[]>({
    queryKey: ["/api/user/achievements"],
  });

  const { data: allAchievements, isLoading: isLoadingAll } = useQuery<{
    id: number;
    name: string;
    description: string;
    badgeImage: string;
    type: string;
  }[]>({
    queryKey: ["/api/achievements"],
  });

  if (isLoading || isLoadingAll) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const earnedMap = new Map(
    achievements?.map(a => [a.achievement.id, { 
      earned: true, 
      earnedAt: a.earnedAt 
    }])
  );

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Achievement Badges</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {allAchievements?.map((achievement) => {
          const earnedInfo = earnedMap.get(achievement.id);
          return (
            <AchievementBadge
              key={achievement.id}
              name={achievement.name}
              description={achievement.description}
              badgeImage={achievement.badgeImage}
              earned={!!earnedInfo}
              earnedAt={earnedInfo?.earnedAt}
            />
          );
        })}
      </div>
    </div>
  );
}
