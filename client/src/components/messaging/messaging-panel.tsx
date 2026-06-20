import { useState, useEffect } from "react";
import { logger } from "../../lib/logger";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { useToast } from "../../hooks/use-toast";
import { messagingService, type Message, type Conversation } from "../../lib/messaging-service";
import { auth } from "../../lib/firebase";
import { MessageSquare, Send, User } from "lucide-react";

export function MessagingPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (currentConversation) {
      unsubscribe = messagingService.subscribeToConversation(
        currentConversation,
        (updatedMessages) => {
          setMessages(updatedMessages);
          // Mark received messages as read
          updatedMessages
            .filter(msg => !msg.read && msg.recipientId === auth.currentUser?.uid)
            .forEach(msg => messagingService.markMessageAsRead(msg.id));
        }
      );
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentConversation]);

  const loadConversations = async () => {
    try {
      const conversationList = await messagingService.getConversations();
      setConversations(conversationList);
    } catch (error) {
      logger.error("Error loading conversations:", error);
      toast({
        title: "Error",
        description: "Could not load conversations",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      await messagingService.sendMessage(
        currentConversation ? messages[0].recipientId : recipientId,
        newMessage
      );
      setNewMessage("");
      if (!currentConversation) {
        loadConversations();
      }
    } catch (error) {
      logger.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Could not send message",
        variant: "destructive",
      });
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('default', {
      hour: 'numeric',
      minute: 'numeric'
    }).format(date);
  };

  return (
    <Card className="flex h-[600px]">
      {/* Conversations List */}
      <div className="w-1/3 border-r">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Messages</h2>
        </div>
        <ScrollArea className="h-[calc(600px-65px)]">
          <div className="space-y-2 p-4">
            {conversations.map((conversation) => (
              <Button
                key={conversation.id}
                variant={currentConversation === conversation.id ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => setCurrentConversation(conversation.id)}
              >
                <User className="h-4 w-4 mr-2" />
                <div className="flex-1 text-left">
                  <p className="font-medium">
                    {Object.keys(conversation.participants)
                      .find(id => id !== auth.currentUser?.uid)}
                  </p>
                  {conversation.lastMessage && (
                    <p className="text-sm text-muted-foreground truncate">
                      {conversation.lastMessage}
                    </p>
                  )}
                </div>
                {conversation.lastMessageTime && (
                  <span className="text-xs text-muted-foreground">
                    {formatTime(conversation.lastMessageTime)}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">
            {currentConversation ? (
              messages[0]?.recipientId
            ) : (
              "New Message"
            )}
          </h3>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.senderId === auth.currentUser?.uid
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.senderId === auth.currentUser?.uid
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p>{message.content}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {formatTime(message.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          {!currentConversation && (
            <Input
              placeholder="Recipient ID"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="mb-2"
            />
          )}
          <div className="flex gap-2">
            <Input
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || (!currentConversation && !recipientId)}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
