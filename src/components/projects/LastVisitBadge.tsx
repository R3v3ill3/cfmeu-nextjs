"use client"

import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { Clock } from "lucide-react"

interface LastVisitBadgeProps {
  projectId: string
  variant?: "default" | "compact"
  showIcon?: boolean
}

export function LastVisitBadge({ 
  projectId, 
  variant = "default",
  showIcon = true 
}: LastVisitBadgeProps) {
  const { data: visitData, isLoading } = useQuery({
    queryKey: ["project-last-visit", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_project_last_visit")
        .select("last_visit_date, total_visits")
        .eq("project_id", projectId)
        .maybeSingle()
      
      if (error) throw error
      return data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  if (isLoading) {
    return <Badge variant="outline" className="text-xs">Loading...</Badge>
  }

  const lastVisitDate = visitData?.last_visit_date 
    ? new Date(visitData.last_visit_date) 
    : null

  const { color, text, description } = getVisitRecencyInfo(lastVisitDate)
  
  if (variant === "compact") {
    return (
      <Badge 
        variant="outline" 
        className={`text-xs ${getColorClasses(color)}`}
        title={description}
      >
        {showIcon && <Clock className="h-3 w-3 mr-1" />}
        {text}
      </Badge>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant="outline" 
        className={`${getColorClasses(color)}`}
      >
        {showIcon && <Clock className="h-3 w-3 mr-1" />}
        {description}
      </Badge>
      {visitData?.total_visits && visitData.total_visits > 0 && (
        <span className="text-xs text-muted-foreground">
          ({visitData.total_visits} visit{visitData.total_visits !== 1 ? 's' : ''})
        </span>
      )}
    </div>
  )
}

function getVisitRecencyInfo(lastVisitDate: Date | null): {
  color: string
  text: string
  description: string
} {
  if (!lastVisitDate) {
    return {
      color: "grey",
      text: "Never",
      description: "Never visited"
    }
  }

  const now = new Date()
  const monthsAgo = (now.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24 * 30)

  if (monthsAgo > 12) {
    return {
      color: "red",
      text: formatDistanceToNow(lastVisitDate, { addSuffix: true }),
      description: `Last visit: ${formatDistanceToNow(lastVisitDate, { addSuffix: true })}`
    }
  } else if (monthsAgo > 6) {
    return {
      color: "orange",
      text: formatDistanceToNow(lastVisitDate, { addSuffix: true }),
      description: `Last visit: ${formatDistanceToNow(lastVisitDate, { addSuffix: true })}`
    }
  } else if (monthsAgo > 3) {
    return {
      color: "light-green",
      text: formatDistanceToNow(lastVisitDate, { addSuffix: true }),
      description: `Last visit: ${formatDistanceToNow(lastVisitDate, { addSuffix: true })}`
    }
  } else {
    return {
      color: "bright-green",
      text: formatDistanceToNow(lastVisitDate, { addSuffix: true }),
      description: `Last visit: ${formatDistanceToNow(lastVisitDate, { addSuffix: true })}`
    }
  }
}

function getColorClasses(color: string): string {
  switch (color) {
    case "grey":
      return "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300"
    case "red":
      return "bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300"
    case "orange":
      return "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300"
    case "light-green":
      return "bg-lime-50 text-lime-700 border-lime-300 dark:bg-lime-950 dark:text-lime-300"
    case "bright-green":
      return "bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300"
    default:
      return ""
  }
}

