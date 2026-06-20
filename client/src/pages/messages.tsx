import { Header } from "../components/layout/header";
import { MessagingPanel } from "../components/messaging/messaging-panel";

export default function MessagesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Messages</h1>
        <MessagingPanel />
      </main>
    </div>
  );
}
