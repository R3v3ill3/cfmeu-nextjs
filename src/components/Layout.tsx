"use client"
import { ReactNode, useState, useRef, useEffect, useCallback, type ComponentType } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Menu, LogOut, Users, Building, MapPin, BarChart3, FolderOpen, FileCheck, Shield, AlertTriangle, QrCode, HelpCircle, Crown, Settings, TrendingUp, ArrowLeft, Home, Search, ClipboardList, RotateCcw
} from "lucide-react";
import { WizardFloatingButton } from "@/components/siteVisitWizard/WizardFloatingButton";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminPatchSelector from "@/components/admin/AdminPatchSelector";
import { useNavigationVisibility } from "@/hooks/useNavigationVisibility";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import { JoinQrDialog } from "@/components/JoinQrDialog";
import { HelpLauncher } from "@/components/help/HelpLauncher";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAdminPatchContext } from "@/context/AdminPatchContext";
import { performHardReset } from "@/lib/auth/hardReset";

// Simple mobile detection
const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
};
// Fallback to generic icon from public since original assets are not present
const cfmeuLogoLight = "/favicon.svg" as unknown as string;

interface LayoutProps {
  children: ReactNode;
  onRefresh?: () => void;
}

type NavItem = {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  external?: boolean;
};

const Layout = ({ children, onRefresh }: LayoutProps) => {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const { role: userRole, isLoading: isLoadingRole, error: userRoleError } = useUserRole();
  const { visibility } = useNavigationVisibility();
  const { isNavigating, startNavigation } = useNavigationLoading();
  const [joinQrOpen, setJoinQrOpen] = useState(false);
  const [forceLogoutDialogOpen, setForceLogoutDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const { toast } = useToast();
  const [roleErrorNotified, setRoleErrorNotified] = useState(false);
  const adminPatchContext = useAdminPatchContext();

  // Routes where patch filtering should not be preserved
  const PATCH_FILTER_EXCLUDED_ROUTES = ['/admin', '/eba-employers']
  
  // Helper function to preserve patch parameter when navigating
  // For admins: reads from context (persistent across navigation)
  // For non-admins: reads from URL
  const getNavigationUrl = useCallback((targetPath: string): string => {
    const isExcludedRoute = PATCH_FILTER_EXCLUDED_ROUTES.some(route => targetPath.startsWith(route))
    
    // Don't preserve patch param for excluded routes
    if (isExcludedRoute) {
      return targetPath
    }
    
    // Check if target URL already has a patch parameter - if so, preserve it
    const targetUrl = new URL(targetPath, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    if (targetUrl.searchParams.has('patch')) {
      return targetPath
    }
    
    // Determine patch param based on role
    let patchParam: string | null = null
    
    if (adminPatchContext.isAdmin && adminPatchContext.selectedPatchIds && adminPatchContext.selectedPatchIds.length > 0) {
      // Admin with context-stored patches - use those
      patchParam = adminPatchContext.selectedPatchIds.join(',')
    } else if (typeof window !== 'undefined') {
      // Fallback: read from current URL
      const urlParams = new URLSearchParams(window.location.search)
      patchParam = urlParams.get('patch')
    }
    
    // Don't preserve if no patch param exists
    if (!patchParam) {
      return targetPath
    }
    
    // Preserve patch param for other routes
    const separator = targetPath.includes('?') ? '&' : '?'
    const result = `${targetPath}${separator}patch=${encodeURIComponent(patchParam)}`
    return result
  }, [adminPatchContext.isAdmin, adminPatchContext.selectedPatchIds])

  // Mobile navigation state
  const [canGoBack, setCanGoBack] = useState(false);
  useEffect(() => {
    if (userRoleError && !roleErrorNotified) {
      toast({
        title: "We couldn't confirm your access",
        description: "Some navigation items may be hidden temporarily. We'll retry automatically.",
        variant: "destructive",
      });
      setRoleErrorNotified(true);
    }

    if (!userRoleError && roleErrorNotified) {
      setRoleErrorNotified(false);
    }
  }, [userRoleError, roleErrorNotified, toast]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  
  // Pull-to-refresh state
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Check if we can go back in history
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCanGoBack(window.history.length > 1);
    }
  }, [pathname]);

  // Handle swipe gestures for navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile()) return;
    setTouchStartX(e.targetTouches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || !isMobile()) return;
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!isSwiping || !isMobile()) return;

    const swipeDistance = touchEndX - touchStartX;
    const minSwipeDistance = 50;

    // Swipe right from left edge - open navigation menu
    if (touchStartX < 20 && swipeDistance > minSwipeDistance) {
      setIsOpen(true);
    }
    // Swipe left from right edge - close navigation menu
    else if (touchStartX > window.innerWidth - 20 && swipeDistance < -minSwipeDistance) {
      setIsOpen(false);
    }

    setIsSwiping(false);
  };

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      // Check if we can go back and update state
      if (typeof window !== 'undefined') {
        setCanGoBack(window.history.length > 1);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Navigate to search results if query is substantial
    if (query.length > 2) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  // Mobile-specific navigation items (reduced for mobile UX)
  const getMobileNavItems = (): NavItem[] => {
    const items: NavItem[] = [];

    // Always show Projects and Home
    items.push({ path: "/", label: "Home", icon: Home });
    items.push({ path: "/projects", label: "Projects", icon: FolderOpen });

    // Essential mobile-only items
    if (visibility.employers) {
      items.push({ path: "/employers", label: "Employers", icon: Building });
    }

    if (visibility.eba_employers) {
      items.push({ path: "/eba-employers", label: "EBA", icon: FileCheck });
    }

    if (visibility.map) {
      items.push({ path: "/map", label: "Map", icon: MapPin });
    }

    // Site Visits for organisers
    if (!isLoadingRole && userRole && (userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin") && visibility.site_visits) {
      items.push({ path: "/mobile/site-visits/new", label: "Record Visit", icon: ClipboardList });
    }

    // Add Settings
    items.push({ path: "/settings", label: "Settings", icon: Settings });

    return items;
  };

  const getVisibleNavItems = (): NavItem[] => {
    const items: NavItem[] = [];
    
    // Always show Projects
    items.push({ path: "/projects", label: "Projects", icon: FolderOpen });
    
    // Wait for role to load before showing role-dependent items
    if (!isLoadingRole && userRole) {
      // Patch - check role and visibility
      if ((userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin") && visibility.patch) {
        items.push({ path: "/patch", label: "Patch", icon: Users });
      }
    }
    
    // Employers - check visibility
    if (visibility.employers) {
      items.push({ path: "/employers", label: "Employers", icon: Building });
    }
    
    // EBA Employers - check visibility
    if (visibility.eba_employers) {
      items.push({ path: "/eba-employers", label: "EBA Employers", icon: FileCheck });
    }

    // Settings - show for organiser+ roles (includes geofencing)
    if (!isLoadingRole && userRole && (userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin")) {
      items.push({ path: "/settings", label: "Settings", icon: Settings });
    }
    
    // Delegated Tasks - show for organiser+ roles
    if (!isLoadingRole && userRole && (userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin")) {
      items.push({ path: "/delegated-tasks", label: "Delegated Tasks", icon: ClipboardList });
    }
    
    // Workers - check visibility
    if (visibility.workers) {
      items.push({ path: "/workers", label: "Workers", icon: Users });
    }
    
    // Map - check visibility
    if (visibility.map) {
      items.push({ path: "/map", label: "Map", icon: MapPin });
    }
    
    // Wait for role to load before showing role-dependent items
    if (!isLoadingRole && userRole) {
      // Site Visits - check role and visibility
      if ((userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin") && visibility.site_visits) {
        items.push({ path: "/site-visits", label: "Site Visits", icon: FileCheck });
      }
      
      // Campaigns - check role and visibility
      if ((userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin") && visibility.campaigns) {
        items.push({ path: "/campaigns", label: "Campaigns", icon: BarChart3 });
      }

      // Lead Console - show for lead organisers and admins when enabled
      if ((userRole === "lead_organiser" || userRole === "admin") && visibility.lead_console) {
        items.push({ path: "/lead", label: "Co-ordinator Console", icon: Crown });
      }

      // Administration / Management - show for admins and lead organisers
      if (userRole === "admin" || userRole === "lead_organiser") {
        const label = userRole === "admin" ? "Administration" : "Management";
        items.push({ path: "/admin", label, icon: Shield });
      }
    }

    // User Guide - always show
    items.push({ path: "/guide", label: "User Guide", icon: HelpCircle });

    // Bug Report - external link
    items.push({ path: "https://fider.uconstruct.app", label: "Bug Report", icon: AlertTriangle, external: true });

    // Settings - always show for authenticated users
    items.push({ path: "/settings", label: "Settings", icon: Settings });
    
    return items;
  };

  const NavItems = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex ${mobile ? "flex-col" : "flex-row"} gap-2`}>
      {getVisibleNavItems().map((item) => {
        const Icon = item.icon;
        const isActive = !item.external && pathname === item.path;
        const className = `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-primary text-primary-foreground"
            : "hover:bg-accent hover:text-accent-foreground"
        } ${isNavigating ? 'opacity-50 pointer-events-none' : ''}`;

        if (item.external) {
          return (
            <a
              key={item.path}
              href={item.path}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (mobile) setIsOpen(false);
              }}
              className={className}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </a>
          );
        }

        const navigationUrl = getNavigationUrl(item.path)
        
        return (
          <Link
            key={item.path}
            href={navigationUrl}
            onClick={(e) => {
              if (item.path !== pathname) {
                startNavigation(item.path);
              }
              if (mobile) setIsOpen(false);
            }}
            className={className}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div
      className="min-h-screen bg-background"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <header
        ref={headerRef}
        className={`border-b ${isMobile() ? 'fixed' : 'sticky'} top-0 left-0 right-0 z-40 bg-white shadow-md safe-area-inset-top`}
        style={{ willChange: 'transform' }}
      >
        <div className="flex h-16 items-center px-4 max-lg:px-safe">
          {/* Mobile back button */}
          {isMobile() && canGoBack && pathname !== '/' && (
            <Button
              variant="ghost"
              size="sm"
              className="mr-2"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}

          {/* Mobile menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 !bg-white z-50 text-foreground shadow-lg">
              <div className="flex flex-col gap-4 h-full">
                <div className="flex items-center gap-3 pb-4 border-b">
                  <Image
                    src={cfmeuLogoLight}
                    alt="CFMEU Construction Union Logo"
                    width={32}
                    height={32}
                    className="h-8 w-auto"
                  />
                  <h2 className="text-lg font-semibold">CFMEU Organiser</h2>
                </div>

                {/* Mobile search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                </div>

                {/* Mobile navigation items */}
                <nav className="flex-1 overflow-y-auto">
                  <div className="space-y-1">
                    {getMobileNavItems().map((item) => {
                      const Icon = item.icon;
                      const isActive = !item.external && pathname === item.path;
                      const navigationUrl = getNavigationUrl(item.path)
                      
                      return (
                        <Link
                          key={item.path}
                          href={navigationUrl}
                          onClick={(e) => {
                            if (item.path !== pathname) {
                              startNavigation(item.path);
                            }
                            setIsOpen(false);
                          }}
                          className={cn(
                            'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </nav>

                <div className="pt-4 border-t space-y-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full min-h-[44px]"
                    onClick={() => {
                      setJoinQrOpen(true)
                      setIsOpen(false)
                    }}
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    Join
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full min-h-[44px]"
                    onClick={() => {
                      signOut()
                      setIsOpen(false)
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                  
                  {/* Force Logout - nuclear option when normal logout fails */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full min-h-[44px] text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setIsOpen(false)
                      setForceLogoutDialogOpen(true)
                    }}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Force Logout
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Image
              src={cfmeuLogoLight}
              alt="CFMEU Construction Union Logo"
              width={32}
              height={32}
              className="h-6 w-auto sm:h-8 flex-shrink-0"
            />
            <h1 className="text-sm sm:text-xl font-bold truncate">CFMEU Organiser</h1>
          </div>

          {/* Mobile search toggle */}
          {isMobile() && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSearch(!showSearch)}
            >
              <Search className="h-5 w-5" />
            </Button>
          )}

          {/* Desktop navigation */}
          <nav className="hidden md:flex ml-8">
            <NavItems />
          </nav>

          {/* User menu */}
          <div className="ml-auto flex items-center gap-2">
            <HelpLauncher triggerVariant="ghost" size="icon" />
            {userRole === "admin" && (
              // Admin-only patch selector next to user name
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              <AdminPatchSelector />
            )}
            <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[100px]">
              {user?.email?.split('@')[0]}
            </span>
            <Button variant="outline" size="sm" onClick={signOut} className="h-8 px-2 max-lg:hidden">
              <LogOut className="h-3 w-3 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>

        {/* Mobile search overlay */}
        {showSearch && isMobile() && (
          <div className="absolute top-full left-0 right-0 bg-white border-b shadow-lg z-30 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects, employers..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                onClick={() => setShowSearch(false)}
              >
                ×
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Main content - add padding-top on mobile to account for fixed header (64px = 4rem) */}
      <main 
        className={`flex-1 px-safe py-4 transition-opacity duration-200 relative ${
          isNavigating ? 'opacity-50 pointer-events-none' : 'opacity-100'
        }`}
        style={isMobile() ? { 
          paddingTop: `calc(4rem + env(safe-area-inset-top))` 
        } : undefined}
      >
        {/* Pull-to-refresh indicator */}
        {isMobile() && (
          <div
            className="absolute top-0 left-0 right-0 h-16 flex items-center justify-center bg-blue-50 text-blue-600 transition-transform duration-300 -z-10"
            style={{
              transform: pullDistance > 0 ? `translateY(${Math.min(pullDistance - 16, 0)}px)` : 'translateY(-100%)',
              opacity: pullDistance > 60 ? 1 : 0,
            }}
          >
            {isRefreshing ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Refreshing...</span>
              </div>
            ) : (
              <span className="text-sm">Pull to refresh</span>
            )}
          </div>
        )}

        {/* Content with pull-to-refresh handling */}
        <div
          className="min-h-full"
          onTouchStart={(e) => {
            if (isMobile() && onRefresh) {
              const touch = e.touches[0];
              setTouchStartX(touch.clientX);
              if (scrollContainerRef.current?.scrollTop === 0) {
                setTouchStartY(touch.clientY);
                setIsPulling(true);
              }
            }
          }}
          onTouchMove={(e) => {
            if (!isPulling || !isMobile()) return;

            const touch = e.touches[0];
            const currentY = touch.clientY;
            const distance = currentY - touchStartY;

            if (distance > 0 && scrollContainerRef.current?.scrollTop === 0) {
              setPullDistance(Math.min(distance, 120));
              e.preventDefault();
            }
          }}
          onTouchEnd={() => {
            if (!isPulling || !isMobile()) return;

            if (pullDistance > 80 && onRefresh) {
              setIsRefreshing(true);
              onRefresh();
              setTimeout(() => {
                setIsRefreshing(false);
                setPullDistance(0);
              }, 1000);
            } else {
              setPullDistance(0);
            }

            setIsPulling(false);
          }}
        >
          {children}
        </div>
      </main>

      {/* Mobile Tab Bar (for future enhancement) */}
      {isMobile() && false && ( // Disabled for now, can be enabled when needed
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom z-30">
          <div className="flex items-center justify-around py-2">
            {[
              { icon: Home, label: "Home", path: "/" },
              { icon: FolderOpen, label: "Projects", path: "/projects" },
              { icon: MapPin, label: "Map", path: "/map" },
              { icon: Settings, label: "Settings", path: "/settings" },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-h-[44px]',
                    isActive
                      ? "text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <JoinQrDialog open={joinQrOpen} onOpenChange={setJoinQrOpen} />
      
      {/* Force Logout Confirmation Dialog */}
      <Dialog open={forceLogoutDialogOpen} onOpenChange={setForceLogoutDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Force Logout
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>
                This will clear all app data and log you out completely.
              </p>
              <p className="font-medium">
                Use this if you're stuck and normal Sign Out doesn't work.
              </p>
              <p className="text-xs text-muted-foreground">
                You will need to sign in again after this action.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setForceLogoutDialogOpen(false)}
              disabled={isResetting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setIsResetting(true)
                try {
                  await performHardReset()
                } catch (error) {
                  console.error('Force logout failed:', error)
                  // performHardReset will redirect even on error
                }
              }}
              disabled={isResetting}
              className="w-full sm:w-auto"
            >
              {isResetting ? (
                <>
                  <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Force Logout
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Site Visit Wizard FAB - show for organisers on mobile (except on pages that have their own button) */}
      {isMobile() && !isLoadingRole && userRole && 
       (userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin") && 
       pathname !== '/site-visit-wizard' && 
       pathname !== '/patch' && (
        <WizardFloatingButton />
      )}
    </div>
  );
};

export default Layout;
