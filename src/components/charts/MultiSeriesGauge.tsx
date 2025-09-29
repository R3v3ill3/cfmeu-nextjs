"use client"
import { ChartContainer } from "@/components/ui/chart"
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts"

export type GaugeSeries = {
  label: string
  value: number
  max: number
  color?: string
  trackColor?: string
}

export function MultiSeriesGauge({
  series,
  startAngle = 210,
  endAngle = -30,
  height = 220,
  innerRadius = 40,
  ringWidth = 10,
  gap = 6,
  showLegend = true,
}: {
  series: GaugeSeries[]
  startAngle?: number
  endAngle?: number
  height?: number
  innerRadius?: number
  ringWidth?: number
  gap?: number
  showLegend?: boolean
}) {
  const safeSeries = (series || []).map(s => ({
    ...s,
    value: Math.max(0, s.value || 0),
    max: Math.max(0, s.max || 0),
  }))

  const percentData = [safeSeries.reduce((acc, s, i) => {
    const key = `s${i}`
    const pct = s.max > 0 ? Math.max(0, Math.min(100, Math.round((s.value / s.max) * 100))) : 0
    ;(acc as any)[key] = pct
    return acc
  }, {} as Record<string, number>)]

  const chartConfig = safeSeries.reduce((acc, s, i) => {
    acc[`s${i}`] = { label: s.label, color: s.color || defaultColors[i % defaultColors.length] }
    return acc
  }, {} as Record<string, { label: string; color: string }>)

  const rings = safeSeries.map((s, i) => {
    const r0 = innerRadius + i * (ringWidth + gap)
    const r1 = r0 + ringWidth
    return { index: i, inner: r0, outer: r1, color: chartConfig[`s${i}`].color, label: s.label, value: s.value, max: s.max, track: s.trackColor || "#e5e7eb" }
  })

  return (
    <div className="w-full">
      <div style={{ height, minHeight: height, minWidth: 300 }}>
        <ChartContainer config={chartConfig as any} className="mx-auto h-full w-full">
          <RadialBarChart
            data={percentData as any}
            startAngle={startAngle}
            endAngle={endAngle}
            innerRadius={innerRadius}
            outerRadius={innerRadius + rings.length * (ringWidth + gap)}
            width={300}
            height={height}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            {rings.map((r) => (
              <RadialBar
                key={r.index}
                dataKey={`s${r.index}`}
                cornerRadius={8}
                background={{ fill: r.track }}
                fill={r.color}
                stroke="none"
                barSize={ringWidth}
              />
            ))}
          </RadialBarChart>
        </ChartContainer>
      </div>

      {showLegend && (
        <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-700">
          {safeSeries.map((s, i) => {
            const pct = s.max > 0 ? Math.round((s.value / s.max) * 100) : 0
            return (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-sm" style={{ background: chartConfig[`s${i}`].color }} />
                  <span className="truncate">{s.label}</span>
                </div>
                <span className="tabular-nums">{s.value} / {s.max} ({pct}%)</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const defaultColors = [
  "hsl(221 83% 53%)", // blue
  "hsl(142 71% 45%)", // green
  "hsl(39 89% 49%)",  // yellow/orange
  "hsl(262 83% 58%)", // purple
  "hsl(215 16% 47%)", // gray
]


