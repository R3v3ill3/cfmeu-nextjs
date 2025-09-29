"use client"
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, LogOut, Users, Building, MapPin, Activity, Upload, BarChart3, FolderOpen, FileCheck, Shield, AlertTriangle, QrCode } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import AdminPatchSelector from "@/components/admin/AdminPatchSelector";
import { useNavigationVisibility } from "@/hooks/useNavigationVisibility";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import { JoinQrDialog } from "@/components/JoinQrDialog";
// Fallback to generic icon from public since original assets are not present
const cfmeuLogoLight = "/favicon.svg" as unknown as string;

const navItems = [
  { path: "/projects", label: "Projects", icon: FolderOpen },
  { path: "/employers", label: "Employers", icon: Building },
  { path: "/workers", label: "Workers", icon: Users },
  { path: "/map", label: "Map", icon: MapPin },
  { path: "/site-visits", label: "Site Visits", icon: FileCheck },
];

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const { visibility } = useNavigationVisibility();
  const { isNavigating, startNavigation } = useNavigationLoading();
  const [joinQrOpen, setJoinQrOpen] = useState(false);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) return;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      
      setUserRole((profile as { role?: string } | null)?.role || null);
    };

    checkUserRole();
  }, [user]);

  const getVisibleNavItems = () => {
    const items = [];
    
    // Always show Projects
    items.push({ path: "/projects", label: "Projects", icon: FolderOpen });
    
    // Patch - check role and visibility
    if ((userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin") && visibility.patch) {
      items.push({ path: "/patch", label: "Patch", icon: Users });
    }
    
    // Employers - check visibility
    if (visibility.employers) {
      items.push({ path: "/employers", label: "Employers", icon: Building });
    }
    
    // Workers - check visibility
    if (visibility.workers) {
      items.push({ path: "/workers", label: "Workers", icon: Users });
    }
    
    // Map - check visibility
    if (visibility.map) {
      items.push({ path: "/map", label: "Map", icon: MapPin });
    }
    
    // Site Visits - check role and visibility
    if ((userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin") && visibility.site_visits) {
      items.push({ path: "/site-visits", label: "Site Visits", icon: FileCheck });
    }
    
    // Campaigns - check role and visibility
    if ((userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin") && visibility.campaigns) {
      items.push({ path: "/campaigns", label: "Campaigns", icon: BarChart3 });
    }
    
    // Administration - always show for admins
    if (userRole === "admin") {
      items.push({ path: "/admin", label: "Administration", icon: Shield });
    }
    
    return items;
  };

  const NavItems = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex ${mobile ? "flex-col" : "flex-row"} gap-2`}>
      {getVisibleNavItems().map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path;
        return (
            <Link
            key={item.path}
            href={item.path}
            onClick={(e) => {
              if (item.path !== pathname) {
                startNavigation(item.path)
              }
              if (mobile) setIsOpen(false)
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent hover:text-accent-foreground"
            } ${isNavigating ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-40 bg-white shadow-md">
        <div className="flex h-16 items-center px-4">
          {/* Mobile menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 !bg-white z-50 text-foreground shadow-lg">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Image
                    src={cfmeuLogoLight}
                    alt="CFMEU Construction Union Logo"
                    width={32}
                    height={32}
                    className="h-8 w-auto"
                  />
                  <h2 className="text-lg font-semibold">CFMEU Organiser</h2>
                </div>
                <NavItems mobile />
                <div className="mt-auto pt-4">
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setJoinQrOpen(true)
                      setIsOpen(false)
                    }}
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    Join
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

          {/* Desktop navigation */}
          <nav className="hidden md:flex ml-8">
            <NavItems />
          </nav>

          {/* User menu */}
          <div className="ml-auto flex items-center gap-2">
            {userRole === "admin" && (
              // Admin-only patch selector next to user name
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              <AdminPatchSelector />
            )}
            <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[100px]">
              {user?.email?.split('@')[0]}
            </span>
            <Button variant="outline" size="sm" onClick={signOut} className="h-8 px-2">
              <LogOut className="h-3 w-3 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className={`flex-1 px-safe py-4 transition-opacity duration-200 ${
        isNavigating ? 'opacity-50 pointer-events-none' : 'opacity-100'
      }`}>
        {children}
      </main>
      <JoinQrDialog open={joinQrOpen} onOpenChange={setJoinQrOpen} />
    </div>
  );
};

export default Layout;
