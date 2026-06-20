import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Label } from "../ui/label";
import { Card } from "../ui/card";
import { 
  Award, CheckCircle2, XCircle, Loader2, 
  Trophy, Sparkles 
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface QuizDialogProps {
  lessonId: number;
  courseId: string;
  onClose: () => void;
}

export function QuizDialog({ lessonId, courseId, onClose }: QuizDialogProps) {
  const { toast } = useToast();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  const { data: quiz, isLoading } = useQuery({
    queryKey: ["/api/education/quizzes", lessonId],
    enabled: !!lessonId
  });

  const quizData: any = quiz || {};

  const { data: questions = [] } = useQuery({
    queryKey: ["/api/education/quiz-questions", quizData.id],
    enabled: !!quizData.id
  });

  const questionsData = (questions as any[]) || [];

  const submitQuizMutation = useMutation({
    mutationFn: async (data: { quizId: number; answers: Record<number, number> }) => {
      return apiRequest({
        url: "/api/education/submit-quiz",
        method: "POST",
        body: data
      });
    },
    onSuccess: (result) => {
      setScore(result.score);
      setShowResults(true);
      queryClient.invalidateQueries({ queryKey: [`/api/education/progress/${courseId}`] });
      
      if (result.passed) {
        toast({
          title: "🎉 Quiz Passed!",
          description: `You scored ${result.score}%. Great job!`
        });
      } else {
        toast({
          title: "Keep Trying",
          description: `You scored ${result.score}%. Review the lesson and try again.`,
          variant: "destructive"
        });
      }
    }
  });

  if (isLoading || !quizData.id) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (questionsData.length === 0) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No Quiz Available</DialogTitle>
            <DialogDescription>
              This lesson doesn't have a quiz yet. Content is being generated progressively.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const currentQuestion = questionsData[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questionsData.length) * 100;

  const handleAnswerSelect = (questionId: number, optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questionsData.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    if (Object.keys(answers).length < questionsData.length) {
      toast({
        title: "Incomplete Quiz",
        description: "Please answer all questions before submitting",
        variant: "destructive"
      });
      return;
    }

    submitQuizMutation.mutate({
      quizId: quizData.id,
      answers
    });
  };

  if (showResults) {
    const passed = score >= (quizData.passingScore || 70);
    
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex flex-col items-center text-center space-y-4 py-6">
              {passed ? (
                <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Trophy className="w-10 h-10 text-green-500" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Award className="w-10 h-10 text-orange-500" />
                </div>
              )}
              
              <div>
                <DialogTitle className="text-2xl mb-2">
                  {passed ? "Congratulations! 🎉" : "Keep Learning! 📚"}
                </DialogTitle>
                <DialogDescription>
                  You scored {score}% on this quiz
                </DialogDescription>
              </div>

              <div className="w-full max-w-xs">
                <div className="text-5xl font-bold text-primary mb-2">
                  {score}%
                </div>
                <Progress value={score} className="h-3" />
              </div>

              <div className="text-sm text-muted-foreground">
                {passed ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    You've passed this quiz!
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-orange-500" />
                    Passing score: {quizData.passingScore || 70}%
                  </span>
                )}
              </div>
            </div>
          </DialogHeader>

          <DialogFooter>
            {!passed && (
              <Button
                variant="outline"
                onClick={() => {
                  setShowResults(false);
                  setCurrentQuestionIndex(0);
                  setAnswers({});
                }}
              >
                Retry Quiz
              </Button>
            )}
            <Button onClick={onClose} data-testid="button-close-quiz">
              {passed ? "Continue Learning" : "Review Lesson"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <DialogTitle>Lesson Quiz</DialogTitle>
          </div>
          <DialogDescription>
            Question {currentQuestionIndex + 1} of {questionsData.length}
          </DialogDescription>
          <Progress value={progress} className="mt-2" />
        </DialogHeader>

        <div className="py-6">
          <h3 className="text-lg font-semibold mb-4">
            {currentQuestion.questionText}
          </h3>

          <RadioGroup
            value={answers[currentQuestion.id]?.toString()}
            onValueChange={(value) => handleAnswerSelect(currentQuestion.id, parseInt(value))}
          >
            {currentQuestion.options.map((option: string, index: number) => (
              <Card key={index} className="p-4 cursor-pointer hover:border-primary transition-colors">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                  <Label 
                    htmlFor={`option-${index}`} 
                    className="flex-1 cursor-pointer"
                  >
                    {option}
                  </Label>
                </div>
              </Card>
            ))}
          </RadioGroup>
        </div>

        <DialogFooter className="flex-row justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
          >
            Previous
          </Button>

          <div className="flex gap-2">
            {currentQuestionIndex === questionsData.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={submitQuizMutation.isPending}
                data-testid="button-submit-quiz"
              >
                {submitQuizMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Quiz"
                )}
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Next
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
