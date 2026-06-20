import { cn } from "../../lib/utils";
import { logger } from "../../lib/logger";
import { Button } from "../ui/button";
import { Link, useLocation } from "wouter";
import { 
  BarChart3, 
  Music2, 
  FileText, 
  Users2,
  Settings,
  LogOut,
  Menu,
  X,
  Youtube,
  Users,
  Brain,
  Globe,
  Puzzle,
  Sparkles,
  Disc3
} from "lucide-react";

// BTF Token icon component
const BTFIcon = ({ className }: { className?: string }) => (
  <img src="/btf_logo.png" alt="BTF" className={cn("object-contain", className)} />
);

import { useFirebaseAuth } from "../../hooks/use-firebase-auth";
import { useToast } from "../../hooks/use-toast";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { name: "Distribution", href: "/artist-dashboard", icon: Disc3 },
  { name: "Spotify", href: "/spotify", icon: Music2 },
  { name: "Contracts", href: "/contracts", icon: FileText },
  { name: "PR Management", href: "/pr", icon: Users2 },
  { name: "YouTube Views", href: "/youtube-views", icon: Youtube },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "AI Agents", href: "/ai-agents", icon: Brain },
  { name: "Plugins", href: "/plugins", icon: Puzzle },
  { name: "BTF Wallet", href: "/btf-wallet", icon: BTFIcon },
  { name: "AI Artist Mint", href: "/btf-artist-mint", icon: Sparkles },
  { name: "Real-Time Translator", href: "/translator", icon: Globe },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { logout } = useFirebaseAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo cerrar sesión",
        variant: "destructive",
      });
    }
  };

  const NavigationContent = () => (
    <nav className="flex-1 space-y-1">
      {navigation.map((item) => {
        const isActive = location === item.href;
        const Icon = item.icon;

        return (
          <Link key={item.name} href={item.href}>
            <Button
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-x-3",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
              onClick={() => setIsOpen(false)}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.name}
            </Button>
          </Link>
        );
      })}
    </nav>
  );

  // Mobile Navigation
  const MobileNav = () => (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[240px] p-0">
        <div className="flex h-full flex-col bg-sidebar">
          <div className="flex items-center justify-between px-4 py-4">
            <h2 className="text-lg font-semibold text-sidebar-foreground">
              Artist Marketing
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 px-2 py-2">
            <NavigationContent />
          </div>
          <div className="px-2 py-4">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => {
                handleLogout();
                setIsOpen(false);
              }}
            >
              <LogOut className="h-5 w-5" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  // Desktop Navigation
  const DesktopNav = () => (
    <div className="hidden md:flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex flex-1 flex-col gap-y-4 pt-5">
        <div className="px-4 py-2">
          <h2 className="text-lg font-semibold text-sidebar-foreground">
            Artist Marketing
          </h2>
        </div>
        <div className="px-2">
          <NavigationContent />
        </div>
        <div className="mt-auto px-2 mb-4">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            Cerrar Sesión
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <MobileNav />
      <DesktopNav />
    </>
  );
}