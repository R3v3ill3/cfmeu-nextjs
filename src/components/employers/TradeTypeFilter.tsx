"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type TradeCategory = {
  category_code: string
  category_name: string
  current_employers?: number
}

interface TradeTypeFilterProps {
  selectedCodes: string[]
  onChange: (codes: string[]) => void
  disabled?: boolean
  label?: string
}

export function TradeTypeFilter({
  selectedCodes,
  onChange,
  disabled = false,
  label = "Trade type",
}: TradeTypeFilterProps) {
  const [open, setOpen] = useState(false)

  const { data: categories = [], isFetching } = useQuery({
    queryKey: ["trade-categories"],
    queryFn: async () => {
      const res = await fetch("/api/eba/categories?type=trade")
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      return (json.data || []) as TradeCategory[]
    },
  })

  const options = useMemo(() => {
    return [...categories].sort((a, b) =>
      a.category_name.localeCompare(b.category_name)
    )
  }, [categories])

  const selectedSet = useMemo(() => new Set(selectedCodes), [selectedCodes])

  const handleToggle = (code: string) => {
    if (selectedSet.has(code)) {
      onChange(selectedCodes.filter((c) => c !== code))
    } else {
      onChange([...selectedCodes, code])
    }
  }

  const getLabel = (code: string) => {
    const found = options.find((opt) => opt.category_code === code)
    return found?.category_name || code
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            <span className={cn(selectedCodes.length ? "" : "text-muted-foreground")}>
              {selectedCodes.length === 0
                ? "All trades"
                : `${selectedCodes.length} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search trades..." />
            <CommandEmpty>
              {isFetching ? "Loading trades..." : "No trade found."}
            </CommandEmpty>
            <CommandGroup>
              {options.map((trade) => (
                <CommandItem
                  key={trade.category_code}
                  value={`${trade.category_code}:${trade.category_name}`}
                  onSelect={() => handleToggle(trade.category_code)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedSet.has(trade.category_code)
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  <span>{trade.category_name}</span>
                  {typeof trade.current_employers === "number" && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {trade.current_employers}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedCodes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCodes.map((code) => (
            <Badge key={code} variant="secondary" className="gap-1">
              {getLabel(code)}
              <button
                type="button"
                className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={() => onChange(selectedCodes.filter((c) => c !== code))}
                disabled={disabled}
              >
                <span className="sr-only">Remove {getLabel(code)}</span>
                <span className="text-xs hover:text-destructive">×</span>
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
