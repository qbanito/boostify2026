import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { 
  BookOpen, Clock, Award, TrendingUp, Lock, Unlock,
  Sparkles, ChevronRight
} from "lucide-react";
import { Link } from "wouter";

interface CourseCardProps {
  course: {
    id: number;
    title: string;
    description: string;
    category: string;
    level: string;
    lessonsCount: number;
    duration: string;
    thumbnail: string | null;
    price: string;
    isAIGenerated: boolean;
    generationStatus: string | null;
    rating: string | null;
    totalReviews: number | null;
  };
  enrolled?: boolean;
  progress?: number;
  onEnroll?: () => void;
  onPurchase?: () => void;
  isEnrolled?: boolean;
}

export function CourseCard({ course, enrolled, progress, onEnroll, onPurchase, isEnrolled = false }: CourseCardProps) {
  const isGenerating = course.generationStatus === "generating";
  const levelColors = {
    Beginner: "bg-green-500/10 text-green-700 dark:text-green-400",
    Intermediate: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    Advanced: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  };

  return (
    <Card className="overflow-hidden hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300 group h-full flex flex-col bg-zinc-900/60 backdrop-blur-xl border-white/10 hover:border-orange-500/30 rounded-2xl shadow-lg shadow-black/20 hover:-translate-y-1 relative">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <div className="relative h-48 md:h-56 overflow-hidden bg-gradient-to-br from-orange-500/10 via-primary/5 to-zinc-900">
          {course.thumbnail ? (
            <img
              src={course.thumbnail}
              alt={course.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-16 h-16 text-primary/30" />
            </div>
          )}
          
          {course.isAIGenerated && (
            <Badge className="absolute top-3 left-3 bg-gradient-to-r from-primary to-orange-500">
              <Sparkles className="w-3 h-3 mr-1" />
              AI Generated
            </Badge>
          )}

          {enrolled && (
            <Badge className="absolute top-3 right-3 bg-green-500">
              <Unlock className="w-3 h-3 mr-1" />
              Enrolled
            </Badge>
          )}

          {isGenerating && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-sm">Generating...</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="text-xl font-bold group-hover:text-primary transition-colors line-clamp-2 flex-1">
              {course.title}
            </h3>
            <Badge className={(levelColors as any)[course.level] || levelColors.Beginner}>
              {course.level}
            </Badge>
          </div>

          <p className="text-muted-foreground text-sm mb-4 line-clamp-2 flex-1">
            {course.description}
          </p>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <div className="flex items-center gap-1">
              <BookOpen className="w-4 h-4" />
              <span>{course.lessonsCount} lessons</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{course.duration}</span>
            </div>
          </div>

          {enrolled && typeof progress === 'number' && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold">{progress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-orange-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-auto pt-4 border-t">
            <div className="text-2xl font-bold text-primary">
              {parseFloat(course.price) === 0 ? 'Free' : `$${parseFloat(course.price).toFixed(2)}`}
            </div>
            {!isEnrolled ? (
              <Button 
                className="group/btn" 
                data-testid={`button-enroll-course-${course.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onEnroll?.();
                }}
              >
                Enroll
                <ChevronRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
            ) : (
              <Button 
                className="group/btn" 
                data-testid={`button-continue-course-${course.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onPurchase?.();
                }}
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
            )}
          </div>
        </div>
      </Card>
  );
}
