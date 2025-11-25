"use client"
import { useMemo, useState, useEffect, useCallback, type ComponentType, type ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useUserRole } from "@/hooks/useUserRole"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  SidebarInput,
} from "@/components/ui/sidebar"
import { LogOut, Users, Building, FolderOpen, FileCheck, Shield, BarChart3, Settings, Home, MapPin, Crown, QrCode, Search as SearchIcon, HelpCircle, AlertTriangle, ClipboardList } from "lucide-react"
import AdminPatchSelector from "@/components/admin/AdminPatchSelector"
import { useNavigationVisibility } from "@/hooks/useNavigationVisibility"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"
import { JoinQrDialog } from "@/components/JoinQrDialog"
import { HelpLauncher } from '@/components/help/HelpLauncher'
import { AiHelpDialog } from '@/components/help/AiHelpDialog'
import { MessageSquare } from 'lucide-react'
import { useAdminPatchContext } from "@/context/AdminPatchContext"

const cfmeuLogoLight = "/favicon.svg" as unknown as string

type NavItem = { path: string; label: string; icon: ComponentType<{ className?: string }>; description?: string; external?: boolean }

const baseNavItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: Home, description: "Overview and analytics" },
  { path: "/projects", label: "Projects", icon: FolderOpen, description: "Manage construction projects" },
  { path: "/employers", label: "Employers", icon: Building, description: "Employer information and mapping" },
  { path: "/workers", label: "Workers", icon: Users, description: "Worker database and membership" },
  { path: "/map", label: "Map", icon: MapPin, description: "Interactive patch and job site maps" },
  { path: "/site-visits", label: "Site Visits", icon: FileCheck, description: "Site visit records and reports" },
]

function useVisibleNavItems(userRole: string | null, isLoadingRole: boolean, cachedRole?: string | null): NavItem[] {
  const { visibility } = useNavigationVisibility()
  // Use cached role if available to prevent menu flicker during refetch
  const effectiveRole = userRole ?? cachedRole ?? null;
  const effectiveIsLoading = isLoadingRole && !cachedRole;
  
  const items: NavItem[] = []
  
  // Always show Dashboard
  items.push({ path: "/", label: "Dashboard", icon: Home, description: "Overview and analytics" })
  
  // Always show Projects
  items.push({ path: "/projects", label: "Projects", icon: FolderOpen, description: "Manage construction projects" })
  
  // Wait for role to load before showing role-dependent items (but use cached role if available)
  if (!effectiveIsLoading && effectiveRole) {
    // Patch - check role and visibility
    if ((effectiveRole === "organiser" || effectiveRole === "lead_organiser" || effectiveRole === "admin") && visibility.patch) {
      items.push({ path: "/patch", label: "Patch", icon: Users, description: "Patch management and organization" })
    }
  }
  
  // Employers - check visibility
  if (visibility.employers) {
    items.push({ path: "/employers", label: "Employers", icon: Building, description: "Employer information and mapping" })
  }
  
  // EBA Employers - check visibility
  if (visibility.eba_employers) {
    items.push({ path: "/eba-employers", label: "EBA Employers", icon: FileCheck, description: "EBA-active employers by contractor role/trade" })
  }
  
  // Workers - check visibility
  if (visibility.workers) {
    items.push({ path: "/workers", label: "Workers", icon: Users, description: "Worker database and membership" })
  }
  
  // Map - check visibility
  if (visibility.map) {
    items.push({ path: "/map", label: "Map", icon: MapPin, description: "Interactive patch and job site maps" })
  }
  
  // Wait for role to load before showing role-dependent items (but use cached role if available)
  if (!effectiveIsLoading && effectiveRole) {
    // Site Visits - check role and visibility
    if ((effectiveRole === "organiser" || effectiveRole === "lead_organiser" || effectiveRole === "admin") && visibility.site_visits) {
      items.push({ path: "/site-visits", label: "Site Visits", icon: FileCheck, description: "Site visit records and reports" })
    }
    
    // Campaigns - check role and visibility
    if ((effectiveRole === "organiser" || effectiveRole === "lead_organiser" || effectiveRole === "admin") && visibility.campaigns) {
      items.push({ path: "/campaigns", label: "Campaigns", icon: BarChart3, description: "Campaign activities and tracking" })
    }
    
    // Delegated Tasks - show for organiser+ roles
    if ((effectiveRole === "organiser" || effectiveRole === "lead_organiser" || effectiveRole === "admin")) {
      items.push({ path: "/delegated-tasks", label: "Delegated Tasks", icon: ClipboardList, description: "Track webform links and submissions" })
    }
  }
  
  // User Guide - always show
  items.push({ path: "/guide", label: "User Guide", icon: HelpCircle, description: "Platform documentation and user guide" })

  // Bug Report - external link
  items.push({ path: "https://fider.uconstruct.app", label: "Bug Report", icon: AlertTriangle, description: "Report bugs and platform issues", external: true })

  // Settings - always show for authenticated users
  items.push({ path: "/settings", label: "Settings", icon: Settings, description: "Account settings and preferences" })

  // Wait for role to load before showing role-dependent items (but use cached role if available)
  if (!effectiveIsLoading && effectiveRole) {
    // Lead Console - show for lead organisers and admins when enabled
    if ((effectiveRole === "lead_organiser" || effectiveRole === "admin") && visibility.lead_console) {
      items.push({ path: "/lead", label: "Co-ordinator Console", icon: Crown, description: "Manage organisers and patch assignments" })
    }

    // Administration - show for admins and lead organisers
    // Use cached role to prevent flicker during refetch - Fixed race condition
    if (effectiveRole === "admin" || effectiveRole === "lead_organiser") {
      const label = effectiveRole === "admin" ? "Administration" : "Management"
      const description = effectiveRole === "admin"
        ? "System administration and user management"
        : "Co-ordinator management and data operations"
      items.push({ path: "/admin", label, icon: Shield, description })
    }
  }
  
  return items
}

export default function DesktopLayout({ children }: { children: ReactNode }) {
  const [aiHelpOpen, setAiHelpOpen] = useState(false)
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { role: userRole, isLoading: isLoadingRole, error: roleError } = useUserRole()
  
  // Get cached role from sessionStorage to prevent menu flicker
  const [cachedRole, setCachedRole] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    const stored = window.sessionStorage.getItem("cfmeu:user-role")
    return stored ? stored : null
  })
  
  // Update cached role when role changes
  useEffect(() => {
    if (userRole) {
      setCachedRole(userRole)
    }
  }, [userRole])
  
  const items = useVisibleNavItems(userRole ?? null, isLoadingRole, cachedRole)
  
  // Log role loading failures and handle gracefully
  useEffect(() => {
    if (roleError) {
      const errorMessage = roleError instanceof Error ? roleError.message : String(roleError);
      const isRLSError = 
        errorMessage.includes('permission denied') ||
        errorMessage.includes('row-level security') ||
        errorMessage.includes('RLS') ||
        (roleError as any)?.code === '42501' ||
        (roleError as any)?.code === 'PGRST301';
      
      console.error('[DesktopLayout] Role loading failed:', {
        userId: user?.id,
        error: roleError,
        errorMessage,
        isRLSError,
        pathname,
        cachedRole,
        timestamp: new Date().toISOString(),
      });
      
      // If we have a cached role, continue using it even if query fails
      // This prevents admin tab from disappearing due to transient RLS errors
      if (cachedRole && isRLSError) {
        console.warn('[DesktopLayout] Using cached role due to RLS error:', {
          cachedRole,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, [roleError, user?.id, pathname, cachedRole]);
  
  // Log when Administration menu should appear/disappear
  useEffect(() => {
    const shouldShowAdmin = !isLoadingRole && userRole && (userRole === "admin" || userRole === "lead_organiser");
    const hasAdminItem = items.some(item => item.path === "/admin");
    
    if (shouldShowAdmin && !hasAdminItem) {
      console.warn('[DesktopLayout] Administration menu should be visible but is missing', {
        userRole,
        isLoadingRole,
        pathname,
        timestamp: new Date().toISOString(),
      });
    } else if (!shouldShowAdmin && hasAdminItem) {
      console.warn('[DesktopLayout] Administration menu should not be visible but is present', {
        userRole,
        isLoadingRole,
        pathname,
        timestamp: new Date().toISOString(),
      });
    }
  }, [userRole, isLoadingRole, items, pathname]);
  const { isNavigating, startNavigation } = useNavigationLoading()
  const [query, setQuery] = useState("")
  const [joinQrOpen, setJoinQrOpen] = useState(false)
  const searchParams = useSearchParams()
  const adminPatchContext = useAdminPatchContext()

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

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) =>
      [item.label, item.description]?.some((v) => v?.toLowerCase().includes(q))
    )
  }, [items, query])

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r bg-background text-foreground">
        <SidebarHeader className="border-b">
          <div className="px-3 py-3">
            <div className="flex items-center gap-3 rounded-xl border bg-sidebar-accent/40 px-3 py-3">
              <Image
                src={cfmeuLogoLight}
                alt="CFMEU Construction Union Logo"
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 rounded-md"
              />
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <div className="text-sm font-semibold truncate">CFMEU Organiser</div>
                <div className="text-xs text-muted-foreground truncate">Union platform</div>
              </div>
            </div>
            <div className="mt-3 group-data-[collapsible=icon]:hidden">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <SidebarInput
                  placeholder="Search..."
                  className="pl-9"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 py-2">
          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredItems.map((item) => {
                  const Icon = item.icon
                  const isActive = !item.external && pathname === item.path

                  if (item.external) {
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          size="lg"
                          tooltip={item.label}
                          className="justify-start rounded-full text-[var(--brand-blue)] hover:text-[var(--brand-blue)]"
                        >
                          <a
                            href={item.path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 w-full"
                          >
                            <Icon className="h-4 w-4" />
                            <span className="truncate">{item.label}</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  }

                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        size="lg"
                        tooltip={item.label}
                        disabled={isNavigating}
                        className="justify-start rounded-full data-[active=true]:bg-[var(--brand-blue)] data-[active=true]:text-white data-[active=true]:shadow data-[active=true]:ring-1 data-[active=true]:ring-[var(--brand-blue)]"
                      >
                        <Link
                          href={getNavigationUrl(item.path)}
                          className="flex items-center gap-3 w-full"
                          onClick={() => {
                            if (item.path !== pathname) {
                              startNavigation(item.path)
                            }
                          }}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    size="lg"
                    tooltip="Join CFMEU"
                    className="justify-start rounded-full font-medium text-[var(--brand-blue)]"
                    onClick={() => setJoinQrOpen(true)}
                  >
                    <QrCode className="h-4 w-4" />
                    <span className="truncate">Join CFMEU</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t px-3 py-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <div className="text-xs text-muted-foreground">Signed in as</div>
                <div className="truncate text-sm font-medium">{user?.email}</div>
              </div>
              <Button variant="outline" size="sm" onClick={signOut} className="gap-2">
                <LogOut className="h-3 w-3" />
                <span className="group-data-[collapsible=icon]:hidden">Logout</span>
              </Button>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      
      <SidebarInset>
        <header className="sticky top-0 z-50 border-b bg-white">
          <div className="flex h-14 items-center gap-4 px-6">
            <SidebarTrigger className="h-8 w-8 rounded-md border p-1.5 transition-colors" />
            
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Image 
                src={cfmeuLogoLight} 
                alt="CFMEU Construction Union Logo" 
                width={24} 
                height={24} 
                className="h-6 w-6 flex-shrink-0" 
              />
              <span className="font-medium truncate max-w-[40vw]">
                CFMEU Organiser Platform
              </span>
            </div>
            
            <div className="flex items-center gap-3 ml-auto">
              {userRole === "admin" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground hidden xl:block">Patch:</span>
                  {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                  {/* @ts-ignore */}
                  <AdminPatchSelector />
                </div>
              )}
              
              <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
                <span className="hidden xl:block">Welcome back,</span>
                <span className="font-medium truncate max-w-[200px]">
                  {user?.email?.split('@')[0]}
                </span>
              </div>
              
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setAiHelpOpen(true)}
                title="AI Help Assistant"
              >
                <MessageSquare className="h-5 w-5" />
              </Button>
              <HelpLauncher triggerVariant="ghost" size="icon" />
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
        
        <main className={`flex-1 min-w-0 bg-background transition-opacity duration-200 ${
          isNavigating ? 'opacity-50 pointer-events-none' : 'opacity-100'
        }`}>
          <div className="p-6">
            {children}
          </div>
        </main>
      </SidebarInset>
      <JoinQrDialog open={joinQrOpen} onOpenChange={setJoinQrOpen} />
      <AiHelpDialog open={aiHelpOpen} onOpenChange={setAiHelpOpen} />
    </SidebarProvider>
  )
}
