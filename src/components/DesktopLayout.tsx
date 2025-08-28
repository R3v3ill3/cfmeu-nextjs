"use client"
import { useEffect, useState } from "react"
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
} from "@/components/ui/sidebar"
import { LogOut, Users, Building, FolderOpen, FileCheck, Shield, BarChart3, Settings, Home, Upload } from "lucide-react"
import AdminPatchSelector from "@/components/admin/AdminPatchSelector"
import { supabase } from "@/integrations/supabase/client"
import { desktopDesignSystem } from "@/lib/desktop-design-system"

const cfmeuLogoLight = "/favicon.svg" as unknown as string
const cfmeuLogoDark = "/favicon.svg" as unknown as string

type NavItem = { path: string; label: string; icon: any; description?: string }

const baseNavItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: Home, description: "Overview and analytics" },
  { path: "/projects", label: "Projects", icon: FolderOpen, description: "Manage construction projects" },
  { path: "/employers", label: "Employers", icon: Building, description: "Employer information and mapping" },
  { path: "/workers", label: "Workers", icon: Users, description: "Worker database and membership" },
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
  const items = [...baseNavItems]
  
  // Add Patch for organisers and above
  if (userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin") {
    items.splice(2, 0, { path: "/patch", label: "Patch", icon: Users, description: "Patch management and organization" })
  }
  
  // Remove site visits for delegates and viewers
  if (!(userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin")) {
    const siteVisitsIndex = items.findIndex((i) => i.path === "/site-visits")
    if (siteVisitsIndex > -1) items.splice(siteVisitsIndex, 1)
  }
  
  // Add Data Upload based on role
  if (userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin") {
    items.push({ 
      path: "/upload", 
      label: "Data Upload", 
      icon: Upload, 
      description: userRole === "organiser" 
        ? "Import worker data" 
        : "Import workers, projects, and other data" 
    })
  }
  
  // Add Campaigns for organisers and above
  if (userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin") {
    items.push({ path: "/campaigns", label: "Campaigns", icon: BarChart3, description: "Campaign activities and tracking" })
  }
  
  // Add Administration for admins only
  if (userRole === "admin") {
    items.push({ path: "/admin", label: "Administration", icon: Shield, description: "System administration and user management" })
  }
  
  return items
}

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const userRole = useUserRole()
  const items = useVisibleNavItems(userRole)

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r border-gray-300 bg-white shadow-sm">
        <SidebarHeader className="border-b border-gray-300 bg-gray-100">
          <div className="flex items-center gap-3 px-4 py-4">
            <Image 
              src={cfmeuLogoLight} 
              alt="CFMEU Construction Union Logo" 
              width={32} 
              height={32} 
              className="h-8 w-8 flex-shrink-0" 
            />
            <div className="min-w-0 flex-1">
              <span className="block font-semibold text-gray-900 text-sm">CFMEU Organiser</span>
              <span className="block text-xs text-gray-700">Union Platform</span>
            </div>
          </div>
        </SidebarHeader>
        
        <SidebarContent className="px-3 py-4">
          <SidebarGroup>
            <SidebarGroupLabel className="px-3 py-2 text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Navigation
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.path
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive}
                        className={`w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                          isActive 
                            ? 'bg-gray-800 text-white border border-gray-700 shadow-md' 
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900 bg-white'
                        }`}
                      >
                        <Link href={item.path} className="flex items-center gap-3 w-full">
                          <Icon className={`h-4 w-4 flex-shrink-0 ${
                            isActive ? 'text-white' : 'text-gray-500'
                          }`} />
                          <div className="min-w-0 flex-1">
                            <span className="block truncate">{item.label}</span>
                            {item.description && (
                              <span className={`block text-xs truncate mt-0.5 ${
                                isActive ? 'text-gray-300' : 'text-gray-500'
                              }`}>
                                {item.description}
                              </span>
                            )}
                          </div>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        
        <SidebarFooter className="border-t border-gray-300 bg-gray-100 px-3 py-4">
          <div className="space-y-3">
            <div className="px-3 py-2">
              <div className="text-xs text-gray-700 mb-1">Signed in as</div>
              <div className="text-sm font-medium text-gray-900 truncate">{user?.email}</div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={signOut} 
                className="flex-1 justify-center gap-2 text-xs"
              >
                <LogOut className="h-3 w-3" /> 
                Sign Out
              </Button>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      
      <SidebarInset>
        <header className="sticky top-0 z-30 border-b border-gray-300 bg-white shadow-sm">
          <div className="flex h-14 items-center gap-4 px-6">
            <SidebarTrigger className="h-8 w-8 rounded-md border border-gray-300 bg-white p-1.5 text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors shadow-sm" />
            
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Image 
                src={cfmeuLogoLight} 
                alt="CFMEU Construction Union Logo" 
                width={24} 
                height={24} 
                className="h-6 w-6 flex-shrink-0" 
              />
              <span className="font-medium text-gray-900 truncate max-w-[40vw]">
                CFMEU Organiser Platform
              </span>
            </div>
            
            <div className="flex items-center gap-3 ml-auto">
              {userRole === "admin" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-700 hidden xl:block">Patch:</span>
                  {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                  {/* @ts-ignore */}
                  <AdminPatchSelector />
                </div>
              )}
              
              <div className="hidden lg:flex items-center gap-2 text-sm text-gray-700">
                <span className="hidden xl:block">Welcome back,</span>
                <span className="font-medium text-gray-900 truncate max-w-[200px]">
                  {user?.email?.split('@')[0]}
                </span>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
        
        <main className="flex-1 min-w-0 bg-white">
          <div className="p-6">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

