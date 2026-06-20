import { useQuery } from "@tanstack/react-query";
import { logger } from "../../lib/logger";
import { Card } from "../ui/card";
import { Loader2, Calendar, Music2, Video, BarChart2 } from "lucide-react";
import { auth, db } from "../../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  type: 'video' | 'song' | 'strategy';
  action: string;
  title: string;
  createdAt: Date;
}

export function ActivityFeed() {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["activities", auth.currentUser?.uid],
    queryFn: async () => {
      if (!auth.currentUser?.uid) return [];

      try {
        const activitiesRef = collection(db, "activities");
        const q = query(
          activitiesRef,
          where("userId", "==", auth.currentUser.uid)
        );

        const querySnapshot = await getDocs(q);
        const allActivities = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as Activity[];

        // Ordenar por fecha de creación descendente
        allActivities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Retornar solo las últimas 5 actividades
        return allActivities.slice(0, 5);
      } catch (error) {
        logger.error("Error fetching activities:", error);
        return [];
      }
    },
    enabled: !!auth.currentUser?.uid,
  });

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'song':
        return <Music2 className="h-4 w-4" />;
      case 'strategy':
        return <BarChart2 className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
          <Calendar className="h-6 w-6 text-orange-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Recent Activity</h2>
          <p className="text-sm text-muted-foreground">Track your latest updates</p>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
              >
                <div className="h-8 w-8 rounded bg-orange-500/10 flex items-center justify-center">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{activity.action}</p>
                  <p className="text-xs text-muted-foreground truncate">{activity.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(activity.createdAt, { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            No recent activity
          </div>
        )}
      </div>
    </Card>
  );
}