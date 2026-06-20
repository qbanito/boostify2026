import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "../ui/card";
import { Progress } from "../ui/progress";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Trophy, Star, Music, Users, Mic2, Award, Target, TrendingUp } from "lucide-react";

interface Milestone {
  id: number;
  title: string;
  description: string;
  progress: number;
  category: string;
  icon: React.ReactNode;
  completed: boolean;
  nextStep?: string;
}

interface ArtistProgressTrackerProps {
  artistId: string;
}

export function ArtistProgressTracker({ artistId }: ArtistProgressTrackerProps) {
  // Mock data - In real app, this would come from an API
  const [milestones] = useState<Milestone[]>([
    {
      id: 1,
      title: "Artistic Development",
      description: "Track your musical growth and achievements",
      progress: 75,
      category: "Development",
      icon: <Star className="w-6 h-6 text-orange-500" />,
      completed: true,
      nextStep: "Complete next workshop session"
    },
    {
      id: 2,
      title: "Professional Network",
      description: "Build industry connections and collaborations",
      progress: 60,
      category: "Networking",
      icon: <Users className="w-6 h-6 text-orange-500" />,
      completed: false,
      nextStep: "Connect with 3 new producers"
    },
    {
      id: 3,
      title: "New Compositions",
      description: "Track your songwriting progress",
      progress: 40,
      category: "Development",
      icon: <Music className="w-6 h-6 text-orange-500" />,
      completed: false,
      nextStep: "Complete your next fusion track"
    },
    {
      id: 4,
      title: "Industry Memberships",
      description: "Professional associations and communities",
      progress: 80,
      category: "Networking",
      icon: <Award className="w-6 h-6 text-orange-500" />,
      completed: true,
      nextStep: "Attend next industry meetup"
    }
  ]);

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3 }
    }
  };

  return (
    <Card className="p-6">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="w-6 h-6 text-orange-500" />
              Artist Journey Progress
            </h2>
            <p className="text-muted-foreground">
              Track your musical development and networking
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-orange-500/10 text-orange-500">
              Current Level: Rising Star
            </Badge>
            <Badge variant="outline" className="bg-green-500/10 text-green-500">
              4 Achievements Unlocked
            </Badge>
          </div>
        </div>

        <div className="grid gap-6">
          {milestones.map((milestone) => (
            <motion.div
              key={milestone.id}
              variants={itemVariants}
              className="relative"
            >
              <Card className={`p-4 ${
                milestone.completed ? 'bg-orange-500/5 border-orange-500/20' : ''
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${
                    milestone.completed ? 'bg-orange-500/10' : 'bg-muted'
                  }`}>
                    {milestone.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">{milestone.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {milestone.description}
                        </p>
                      </div>
                      <Badge
                        variant={milestone.completed ? "default" : "outline"}
                        className={milestone.completed ? "bg-orange-500" : ""}
                      >
                        {milestone.progress}%
                      </Badge>
                    </div>
                    <Progress
                      value={milestone.progress}
                      className="h-2 mb-2"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm text-muted-foreground">
                        Next step: {milestone.nextStep}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-orange-500 hover:text-orange-600"
                      >
                        <Target className="w-4 h-4 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-orange-500/5 rounded-lg border border-orange-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              <span className="font-medium">Overall Progress:</span>
              <span className="text-orange-500 font-bold">63%</span>
            </div>
            <Button variant="outline" className="border-orange-500/50 text-orange-500">
              <Award className="w-4 h-4 mr-2" />
              View All Achievements
            </Button>
          </div>
        </div>
      </motion.div>
    </Card>
  );
}