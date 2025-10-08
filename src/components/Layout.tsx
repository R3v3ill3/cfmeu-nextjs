"use client"
import { useState, useEffect, type ComponentType } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Menu, LogOut, Users, Building, MapPin, BarChart3, FolderOpen, FileCheck, Shield, AlertTriangle, QrCode, HelpCircle, Crown
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import AdminPatchSelector from "@/components/admin/AdminPatchSelector";
import { useNavigationVisibility } from "@/hooks/useNavigationVisibility";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import { JoinQrDialog } from "@/components/JoinQrDialog";
import { HelpLauncher } from "@/components/help/HelpLauncher";
// Fallback to generic icon from public since original assets are not present
const cfmeuLogoLight = "/favicon.svg" as unknown as string;

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

  type NavItem = {
    path: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
    external?: boolean;
  };

  const getVisibleNavItems = (): NavItem[] => {
    const items: NavItem[] = [];
    
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
    
    // EBA Employers - check visibility
    if (visibility.eba_employers) {
      items.push({ path: "/eba-employers", label: "EBA Employers", icon: FileCheck });
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

    if ((userRole === "lead_organiser" || userRole === "admin") && visibility.lead_console) {
      items.push({ path: "/lead", label: "Co-ordinator Console", icon: Crown });
    }

    // User Guide - always show
    items.push({ path: "/guide", label: "User Guide", icon: HelpCircle });

    // Bug Report - external link
    items.push({ path: "https://fider.uconstruct.app", label: "Bug Report", icon: AlertTriangle, external: true });
    
    // Administration / Management - show for admins and lead organisers
    if (userRole === "admin" || userRole === "lead_organiser") {
      const label = userRole === "admin" ? "Administration" : "Management";
      items.push({ path: "/admin", label, icon: Shield });
    }
    
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

        return (
          <Link
            key={item.path}
            href={item.path}
            onClick={() => {
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
