"use client"

import { cn } from "@/lib/utils"

interface TrafficLightStackedBarProps {
  red: number
  amber: number
  yellow: number
  green: number
  total: number
  onClick?: () => void
  className?: string
}

export function TrafficLightStackedBar({
  red,
  amber,
  yellow,
  green,
  total,
  onClick,
  className
}: TrafficLightStackedBarProps) {
  if (total === 0) {
    return (
      <div className={cn("w-full h-4 sm:h-5 rounded-md border border-gray-200 bg-gray-100", className)}>
        <div className="flex items-center justify-center h-full text-xs text-gray-500">
          No ratings
        </div>
      </div>
    )
  }

  const redPct = (red / total) * 100
  const amberPct = (amber / total) * 100
  const yellowPct = (yellow / total) * 100
  const greenPct = (green / total) * 100

  const Component = onClick ? 'button' : 'div'
  const props = onClick ? { onClick, type: 'button' as const } : {}

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Traffic Light Ratings</span>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {red}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {amber}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            {yellow}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {green}
          </span>
        </div>
      </div>
      
      <Component
        {...props}
        className={cn(
          "w-full h-4 sm:h-5 rounded-md border border-gray-200 bg-gray-100 overflow-hidden flex",
          onClick && "cursor-pointer hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          className
        )}
        title={`Ratings: ${red} red, ${amber} amber, ${yellow} yellow, ${green} green`}
      >
        {redPct > 0 && (
          <div
            className="bg-red-500 h-full transition-all"
            style={{ width: `${redPct}%` }}
            title={`Red: ${red} (${Math.round(redPct)}%)`}
          />
        )}
        {amberPct > 0 && (
          <div
            className="bg-amber-500 h-full transition-all"
            style={{ width: `${amberPct}%` }}
            title={`Amber: ${amber} (${Math.round(amberPct)}%)`}
          />
        )}
        {yellowPct > 0 && (
          <div
            className="bg-yellow-500 h-full transition-all"
            style={{ width: `${yellowPct}%` }}
            title={`Yellow: ${yellow} (${Math.round(yellowPct)}%)`}
          />
        )}
        {greenPct > 0 && (
          <div
            className="bg-green-500 h-full transition-all"
            style={{ width: `${greenPct}%` }}
            title={`Green: ${green} (${Math.round(greenPct)}%)`}
          />
        )}
      </Component>

      <div className="flex justify-between text-xs text-gray-600">
        <span>{total} key contractor{total !== 1 ? 's' : ''} rated</span>
        <span>
          {green > 0 && `${Math.round(greenPct)}% green`}
          {green === 0 && red > 0 && `${Math.round(redPct)}% red`}
        </span>
      </div>
    </div>
  )
}





