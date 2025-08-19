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
import { LogOut, Users, Building, FolderOpen, FileCheck, Shield } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"

const cfmeuLogoLight = "/icon.svg" as unknown as string
const cfmeuLogoDark = "/icon.svg" as unknown as string

type NavItem = { path: string; label: string; icon: any }

const baseNavItems: NavItem[] = [
  { path: "/projects", label: "Projects", icon: FolderOpen },
  { path: "/employers", label: "Employers", icon: Building },
  { path: "/workers", label: "Workers", icon: Users },
  { path: "/site-visits", label: "Site Visits", icon: FileCheck },
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
  if (userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin") {
    items.splice(1, 0, { path: "/patch", label: "Patch", icon: Users })
  }
  if (!(userRole === "organiser" || userRole === "lead_organiser" || userRole === "admin")) {
    const siteVisitsIndex = items.findIndex((i) => i.path === "/site-visits")
    if (siteVisitsIndex > -1) items.splice(siteVisitsIndex, 1)
  }
  if (userRole === "admin") {
    items.push({ path: "/admin", label: "Administration", icon: Shield })
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
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1">
            <Image src={cfmeuLogoLight} alt="CFMEU Construction Union Logo" width={28} height={28} className="h-7 w-auto dark:hidden" />
            <Image src={cfmeuLogoDark} alt="CFMEU Construction Union Logo" width={28} height={28} className="h-7 w-auto hidden dark:block" />
            <span className="font-semibold">CFMEU Organiser</span>
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.path
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.path}>
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="px-2 py-1 text-xs text-muted-foreground">
            {user?.email}
          </div>
          <Button variant="outline" size="sm" onClick={signOut} className="mx-2">
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b px-3 bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur">
          <SidebarTrigger />
          <div className="flex items-center gap-2 min-w-0">
            <Image src={cfmeuLogoLight} alt="CFMEU Construction Union Logo" width={24} height={24} className="h-6 w-auto dark:hidden" />
            <Image src={cfmeuLogoDark} alt="CFMEU Construction Union Logo" width={24} height={24} className="h-6 w-auto hidden dark:block" />
            <span className="font-medium truncate max-w-[40vw]">CFMEU Organiser</span>
          </div>
          <div className="ml-auto text-sm text-muted-foreground hidden md:block truncate max-w-[40%]">{user?.email}</div>
        </header>
        <main className="flex-1 p-6 min-w-0">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}

