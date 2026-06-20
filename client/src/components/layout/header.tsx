import React from "react";
import { logger } from "../../lib/logger";
import { Link, useLocation } from "wouter";
import { 
  Menu, 
  X,
  ChevronDown,
  Search,
  LogIn,
  UserCircle 
} from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { Button } from "../../components/ui/button";
import { NotificationBell } from "../notifications/notification-bell";

export function Header() {
  const [location] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const { user, logout } = useAuth() || {};

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Redirect to search page with query
    window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const isActive = (path: string) => {
    return location === path;
  };

  return (
    <header className="bg-background border-b border-border sticky top-0 z-50 backdrop-blur-sm bg-background/95">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0">
            <Link href="/" className="flex items-center space-x-2">
              <img 
                src="/assets/freepik__boostify_music_organe_abstract_icon.png" 
                alt="Boostify Music" 
                className="h-7 w-7 sm:h-8 sm:w-8" 
              />
              <span className="text-base sm:text-lg lg:text-xl font-bold whitespace-nowrap">
                Boostify Music
              </span>
            </Link>
          </div>

          {/* Desktop Navigation - Solo pantallas grandes (1024px+) */}
          <nav className="hidden lg:flex items-center space-x-4 xl:space-x-6">
            <Link 
              href="/" 
              className={`text-sm font-medium transition-colors ${isActive("/") ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="nav-home"
            >
              Home
            </Link>
            <Link 
              href="/features" 
              className={`text-sm font-medium transition-colors ${isActive("/features") ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="nav-features"
            >
              Features
            </Link>
            <Link 
              href="/pricing" 
              className={`text-sm font-medium transition-colors ${isActive("/pricing") ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="nav-pricing"
            >
              Pricing
            </Link>
            <Link 
              href="/social-network" 
              className={`text-sm font-medium transition-colors ${isActive("/social-network") ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="nav-social"
            >
              Social Network
            </Link>
            <Link 
              href="/affiliates" 
              className={`text-sm font-medium transition-colors ${isActive("/affiliates") ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="nav-affiliates"
            >
              Affiliates
            </Link>
          </nav>

          {/* User actions - Desktop */}
          <div className="hidden lg:flex items-center space-x-2 xl:space-x-4">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Search..."
                className="w-36 xl:w-48 py-1.5 px-3 pr-8 text-sm rounded-md bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-desktop"
              />
              <button type="submit" className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <Search className="h-4 w-4 text-muted-foreground" />
              </button>
            </form>

            {user ? (
              <div className="flex items-center space-x-2">
                {/* NotificationBell hidden by request */}
                <Link href="/affiliates">
                  <Button variant="default" size="sm" className="gap-1 text-xs bg-primary hover:bg-primary/90">
                    <span className="hidden xl:inline">🎯 Affiliate Dashboard</span>
                    <span className="xl:hidden">Affiliate</span>
                  </Button>
                </Link>
                <Link href="/my-artists">
                  <Button variant="outline" size="sm" className="gap-1 text-xs">
                    <UserCircle className="h-3.5 w-3.5" />
                    <span className="hidden xl:inline">My Artists</span>
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline" size="sm" className="gap-1 text-xs">
                    <UserCircle className="h-3.5 w-3.5" />
                    <span className="hidden xl:inline">Dashboard</span>
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-xs"
                  onClick={() => logout && logout()}
                >
                  Logout
                </Button>
              </div>
            ) : (
              <Link href="/auth">
                <Button size="sm" className="gap-1 text-xs">
                  <LogIn className="h-3.5 w-3.5" />
                  Login
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile/Tablet Menu Button - Para pantallas < 1024px */}
          <div className="lg:hidden flex items-center gap-2">
            {/* Search icon for mobile */}
            <button 
              className="text-muted-foreground hover:text-foreground p-2"
              onClick={() => {
                const searchInput = document.getElementById('mobile-search-input');
                if (searchInput) searchInput.focus();
              }}
            >
              <Search className="h-5 w-5" />
            </button>
            
            <button 
              className="text-muted-foreground hover:text-foreground p-2"
              onClick={toggleMenu}
              data-testid="button-menu-toggle"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Menu - Para pantallas < 1024px */}
      {isMenuOpen && (
        <div className="lg:hidden bg-background/98 backdrop-blur-md border-b border-border shadow-lg animate-in slide-in-from-top-2 duration-200">
          <div className="container mx-auto px-4 py-4 space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {/* Search bar */}
            <form onSubmit={handleSearch} className="relative">
              <input
                id="mobile-search-input"
                type="text"
                placeholder="Buscar..."
                className="w-full py-2.5 px-4 pr-10 text-sm rounded-lg bg-muted/50 border border-input focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-mobile"
              />
              <button type="submit" className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Search className="h-4 w-4 text-muted-foreground" />
              </button>
            </form>
            
            {/* Navigation Links */}
            <nav className="flex flex-col space-y-1">
              <Link 
                href="/" 
                className={`py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/") 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={closeMenu}
                data-testid="mobile-nav-home"
              >
                Home
              </Link>
              <Link 
                href="/features" 
                className={`py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/features") 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={closeMenu}
                data-testid="mobile-nav-features"
              >
                Features
              </Link>
              <Link 
                href="/pricing" 
                className={`py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/pricing") 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={closeMenu}
                data-testid="mobile-nav-pricing"
              >
                Pricing
              </Link>
              <Link 
                href="/affiliates" 
                className="py-3 px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
                onClick={closeMenu}
                data-testid="mobile-nav-affiliates"
              >
                🎯 Affiliate Dashboard
              </Link>
              <Link 
                href="/social-network" 
                className={`py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/social-network") 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={closeMenu}
                data-testid="mobile-nav-social"
              >
                Social Network
              </Link>
              <Link 
                href="/affiliates" 
                className={`py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/affiliates") 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={closeMenu}
                data-testid="mobile-nav-affiliates"
              >
                Affiliates
              </Link>
            </nav>

            {/* User Actions */}
            <div className="pt-4 border-t border-border space-y-2">
              {user ? (
                <>
                  <Link href="/my-artists" onClick={closeMenu}>
                    <Button variant="outline" className="w-full gap-2 justify-start">
                      <UserCircle className="h-4 w-4" />
                      My Artists
                    </Button>
                  </Link>
                  <Link href="/dashboard" onClick={closeMenu}>
                    <Button variant="outline" className="w-full gap-2 justify-start">
                      <UserCircle className="h-4 w-4" />
                      Dashboard
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start"
                    onClick={() => {
                      if (logout) {
                        logout();
                        closeMenu();
                      }
                    }}
                  >
                    Logout
                  </Button>
                </>
              ) : (
                <Link href="/auth" onClick={closeMenu}>
                  <Button className="w-full gap-2">
                    <LogIn className="h-4 w-4" />
                    Login
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
