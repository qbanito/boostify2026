import { useState } from 'react';
import { openRouterService } from '../../lib/api/openrouter-service';
import { BaseAgent } from './base-agent';
import { Brain } from 'lucide-react';
import { useAuth } from '../../hooks/use-auth';
import { useToast } from '../../hooks/use-toast';

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export function SuperAgent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{
    role: 'system',
    content: 'You are a helpful AI assistant for musicians and music industry professionals. Provide clear, practical advice based on industry experience.'
  }]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const handleOptionSelect = async (option: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to interact with the AI agent.",
        variant: "destructive"
      });
      return;
    }

    try {
      const newMessage: Message = { role: 'user', content: option };
      setMessages(prev => [...prev, newMessage]);
      setIsTyping(true);

      const response = await openRouterService.chatWithAgent(
        option,
        'manager',
        user.uid,
        messages[0].content
      );

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.response 
      }]);

      setCurrentQuestion(prev => prev + 1);

      toast({
        title: "Response Generated",
        description: "The AI has processed your request successfully."
      });
    } catch (error) {
      console.error('Error in chat:', error);
      toast({
        title: "Error",
        description: "Failed to generate response. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setMessages([{
        role: 'system',
        content: 'You are a helpful AI assistant for musicians and music industry professionals. Provide clear, practical advice based on industry experience.'
      }]);
      setCurrentQuestion(0);
      setIsTyping(false);
    }, 300);
  };

  return (
    <BaseAgent
      title="Super Agent AI"
      description="Your personal AI assistant for music industry guidance"
      icon={<Brain className="h-6 w-6 text-orange-500" />}
      onActivate={() => setIsOpen(true)}
      onClose={handleClose}
    />
  );
}