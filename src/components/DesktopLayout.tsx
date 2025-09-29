"use client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
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
import { LogOut, Users, Building, FolderOpen, FileCheck, Shield, BarChart3, Settings, Home, MapPin, Crown, QrCode, Search as SearchIcon, HelpCircle } from "lucide-react"
import AdminPatchSelector from "@/components/admin/AdminPatchSelector"
import { supabase } from "@/integrations/supabase/client"
import { useNavigationVisibility } from "@/hooks/useNavigationVisibility"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"
import { JoinQrDialog } from "@/components/JoinQrDialog"

const cfmeuLogoLight = "/favicon.svg" as unknown as string

type NavItem = { path: string; label: string; icon: any; description?: string }

const baseNavItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: Home, description: "Overview and analytics" },
  { path: "/projects", label: "Projects", icon: FolderOpen, description: "Manage construction projects" },
  { path: "/employers", label: "Employers", icon: Building, description: "Employer information and mapping" },
  { path: "/workers", label: "Workers", icon: Users, description: "Worker database and membership" },
  { path: "/map", label: "Map", icon: MapPin, description: "Interactive patch and job site maps" },
  { path: "/site-visits", label: "Site Visits", icon: FileCheck, description: "Site visit records and reports" },
]

function useUserRole() {
  const { user } = useAuth()
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) return
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
      setUserRole((profile as { role?: string } | null)?.role || null)
    }
    checkUserRole()
  }, [user])

  return userRole
}

function useVisibleNavItems(userRole: string | null): NavItem[] {
  const { visibility } = useNavigationVisibility()
  const items: NavItem[] = []
  
  // Always show Dashboard
  items.push({ path: "/", label: "Dashboard", icon: Home, description: "Overview and analytics" })
  
  // Always show Projects
  items.push({ path: "/projects", label: "Projects", icon: FolderOpen, description: "Manage construction projects" })
  
  // Patch - check role and visibility
  if ((userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin") && visibility.patch) {
    items.push({ path: "/patch", label: "Patch", icon: Users, description: "Patch management and organization" })
  }
  
  // Employers - check visibility
  if (visibility.employers) {
    items.push({ path: "/employers", label: "Employers", icon: Building, description: "Employer information and mapping" })
  }
  
  // Workers - check visibility
  if (visibility.workers) {
    items.push({ path: "/workers", label: "Workers", icon: Users, description: "Worker database and membership" })
  }
  
  // Map - check visibility
  if (visibility.map) {
    items.push({ path: "/map", label: "Map", icon: MapPin, description: "Interactive patch and job site maps" })
  }
  
  // Site Visits - check role and visibility
  if ((userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin") && visibility.site_visits) {
    items.push({ path: "/site-visits", label: "Site Visits", icon: FileCheck, description: "Site visit records and reports" })
  }
  
  // Campaigns - check role and visibility
  if ((userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin") && visibility.campaigns) {
    items.push({ path: "/campaigns", label: "Campaigns", icon: BarChart3, description: "Campaign activities and tracking" })
  }
  
  // User Guide - always show
  items.push({ path: "/guide", label: "User Guide", icon: HelpCircle, description: "Platform documentation and user guide" })

  // Lead Console - show for lead organisers and admins when enabled
  if ((userRole === "lead_organiser" || userRole === "admin") && visibility.lead_console) {
    items.push({ path: "/lead", label: "Co-ordinator Console", icon: Crown, description: "Manage organisers and patch assignments" })
  }

  // Administration - show for admins and lead organisers
  if (userRole === "admin" || userRole === "lead_organiser") {
    const label = userRole === "admin" ? "Administration" : "Management"
    const description = userRole === "admin" 
      ? "System administration and user management" 
      : "Co-ordinator management and data operations"
    items.push({ path: "/admin", label, icon: Shield, description })
  }
  
  return items
}

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const userRole = useUserRole()
  const items = useVisibleNavItems(userRole)
  const { isNavigating, startNavigation } = useNavigationLoading()
  const [query, setQuery] = useState("")
  const [joinQrOpen, setJoinQrOpen] = useState(false)

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
                  const isActive = pathname === item.path
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
                          href={item.path}
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
    </SidebarProvider>
  )
}
