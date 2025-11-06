import React, { useState, useEffect, useCallback, useMemo, useRef, forwardRef, createContext, useContext, useId, type ComponentType, type ComponentProps, type CSSProperties, type MutableRefObject } from 'react'
import type { ReactNode } from 'react'
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: ReactNode
    icon?: ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = createContext<ChartContextProps | null>(null)

function useChart() {
  const context = useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

const ChartContainer = forwardRef<
  HTMLDivElement,
  ComponentProps<"div"> & {
    config: ChartConfig
    children: ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
    >["children"]
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`
  const internalRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const awaitingSizeLogRef = useRef(false)
  const readyLogRef = useRef(false)

  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      internalRef.current = node

      if (typeof ref === "function") {
        ref(node)
      } else if (ref) {
        (ref as MutableRefObject<HTMLDivElement | null>).current = node
      }
    },
    [ref]
  )

  useEffect(() => {
    if (typeof window === "undefined" || typeof ResizeObserver === "undefined") {
      return
    }

    const node = internalRef.current
    if (!node) {
      return
    }

    let observer: ResizeObserver | null = null

    try {
      observer = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (!entry) return

        const { width, height } = entry.contentRect
        setContainerSize((prev) => {
          if (prev.width === width && prev.height === height) {
            return prev
          }
          return { width, height }
        })
      })

      observer.observe(node)
    } catch (error) {
      console.warn('[chart-container] ResizeObserver initialization failed:', error)
    }

    return () => {
      try {
        if (observer) {
          observer.disconnect()
          observer = null
        }
      } catch (error) {
        console.warn('[chart-container] ResizeObserver cleanup failed:', error)
      }
    }
  }, [])

  const hasValidSize = containerSize.width > 0 && containerSize.height > 0

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return
    }

    if (!hasValidSize) {
      if (!awaitingSizeLogRef.current) {
        console.warn("[chart-container] awaiting valid size", {
          chartId,
          width: containerSize.width,
          height: containerSize.height,
        })
        awaitingSizeLogRef.current = true
      }
      return
    }

    awaitingSizeLogRef.current = false

    if (!readyLogRef.current) {
      console.info("[chart-container] size resolved", {
        chartId,
        width: containerSize.width,
        height: containerSize.height,
      })
      readyLogRef.current = true
    }
  }, [chartId, containerSize.height, containerSize.width, hasValidSize])
  
  // Check if explicit height is provided (h-full, h-[300px], h-[200px] md:h-[300px], etc.) to override aspect-video
  const hasExplicitHeight = useMemo(() => {
    if (!className) return false
    // Use regex to detect height classes including responsive ones like h-[200px] md:h-[300px]
    const heightClassRegex = /\b(h-\S+|height-\S+|(sm|md|lg|xl|2xl):h-\S+)/i
    return heightClassRegex.test(className)
  }, [className])
  const baseClasses = hasExplicitHeight 
    ? "block text-xs" 
    : "flex aspect-video justify-center text-xs min-h-[200px] min-w-[300px]"
  const responsiveMinHeight = hasExplicitHeight ? undefined : 200
  const responsiveMinWidth = hasExplicitHeight ? undefined : 300

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={mergedRef}
        className={cn(
          baseClasses,
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className
        )}
        style={{
          width: '100%',
          height: hasExplicitHeight ? undefined : '100%',
          ...props.style
        }}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        {hasValidSize ? (
          <RechartsPrimitive.ResponsiveContainer 
            width={containerSize.width}
            height={containerSize.height}
            minHeight={responsiveMinHeight}
            minWidth={responsiveMinWidth}
            aspect={undefined}
          >
            {children}
          </RechartsPrimitive.ResponsiveContainer>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/80">
            <span className="text-[0.7rem] uppercase tracking-wide">Measuring chart container…</span>
          </div>
        )}
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "Chart"

type ColorEntry = [key: string, value: ChartConfig[string]]

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter((entry): entry is ColorEntry => {
    const [, value] = entry
    return Boolean(value.theme || value.color)
  })

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

type TooltipPayload = {
  value?: number | string
  color?: string
  payload: Record<string, unknown>
  dataKey?: string | number
  name?: string
}

type TooltipFormatter = (
  value: number | string,
  name: string,
  item: TooltipPayload,
  index: number,
  payload: Record<string, unknown>
) => ReactNode

type TooltipLabelFormatter = (
  value: string | number | Date | null | undefined,
  payload?: TooltipPayload[]
) => ReactNode

type TooltipLabel = string | number | Date | null | undefined

type CustomTooltipProps = {
  active?: boolean
  payload?: TooltipPayload[]
  label?: TooltipLabel
  className?: string
  hideLabel?: boolean
  hideIndicator?: boolean
  indicator?: "line" | "dot" | "dashed"
  nameKey?: string
  labelKey?: string
  color?: string
  formatter?: TooltipFormatter
  labelFormatter?: TooltipLabelFormatter
  labelClassName?: string
}

const ChartTooltipContent = forwardRef<
  HTMLDivElement,
  CustomTooltipProps
>(
  (rawProps, ref) => {
    const {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    } = rawProps
    const { config } = useChart()

    const tooltipLabel = useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null
      }

      const [item] = payload
      const key = `${labelKey || item.dataKey || item.name || "value"}`
      const itemConfig = getPayloadConfigFromPayload(config, item, key)
      const value =
        !labelKey && typeof label === "string"
          ? config[label as keyof typeof config]?.label || label
          : itemConfig?.label

      if (labelFormatter) {
        return (
          <div className={cn("font-medium", labelClassName)}>
            {labelFormatter(value, payload)}
          </div>
        )
      }

      if (!value) {
        return null
      }

      return <div className={cn("font-medium", labelClassName)}>{value}</div>
    }, [
      label,
      labelFormatter,
      payload,
      hideLabel,
      labelClassName,
      config,
      labelKey,
    ])

    if (!active || !payload?.length) {
      return null
    }

    const nestLabel = payload.length === 1 && indicator !== "dot"

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = `${nameKey || item.name || item.dataKey || "value"}`
            const itemConfig = getPayloadConfigFromPayload(config, item, key)
            const indicatorColor = color || item.payload.fill || item.color

            return (
              <div
                key={item.dataKey}
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                  indicator === "dot" && "items-center"
                )}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn(
                            "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                            {
                              "h-2.5 w-2.5": indicator === "dot",
                              "w-1": indicator === "line",
                              "w-0 border-[1.5px] border-dashed bg-transparent":
                                indicator === "dashed",
                              "my-0.5": nestLabel && indicator === "dashed",
                            }
                          )}
                          style={
                            {
                              "--color-bg": indicatorColor,
                              "--color-border": indicatorColor,
                            } as CSSProperties
                          }
                        />
                      )
                    )}
                    <div
                      className={cn(
                        "flex flex-1 justify-between leading-none",
                        nestLabel ? "items-end" : "items-center"
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">
                          {itemConfig?.label || item.name}
                        </span>
                      </div>
                      {item.value && (
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {item.value.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltip"

const ChartLegend = RechartsPrimitive.Legend

type LegendPayloadItem = {
  value: string
  color: string
  dataKey?: string
  payload: Record<string, unknown>
}

type CustomLegendProps = {
  className?: string
  hideIcon?: boolean
  nameKey?: string
  verticalAlign?: "top" | "middle" | "bottom"
  payload?: LegendPayloadItem[]
}

const ChartLegendContent = forwardRef<
  HTMLDivElement,
  CustomLegendProps
>(
  (
    { className, hideIcon = false, payload, verticalAlign = "bottom", nameKey },
    ref
  ) => {
    const { config } = useChart()

    if (!payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" ? "pb-3" : "pt-3",
          className
        )}
      >
        {payload.map((item) => {
          const key = `${nameKey || item.dataKey || "value"}`
          const itemConfig = getPayloadConfigFromPayload(config, item, key)

          return (
            <div
              key={item.value}
              className={cn(
                "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          )
        })}
      </div>
    )
  }
)
ChartLegendContent.displayName = "ChartLegend"

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (typeof payload !== "object" || payload === null) {
    return undefined
  }

  const payloadPayload =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? payload.payload
      : undefined

  let configLabelKey: string = key

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === "string"
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
  ) {
    configLabelKey = payloadPayload[
      key as keyof typeof payloadPayload
    ] as string
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key as keyof typeof config]
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}
