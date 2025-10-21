"use client"

import { useState, useMemo } from "react"
import { Check, ChevronsUpDown, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { TRADE_OPTIONS } from "@/constants/trades"
import { useKeyContractorTradesArray } from "@/hooks/useKeyContractorTrades"

interface TradeCapabilitiesSelectorProps {
  selectedTrades: string[]
  onChange: (trades: string[]) => void
  disabled?: boolean
}

export function TradeCapabilitiesSelector({
  selectedTrades,
  onChange,
  disabled = false
}: TradeCapabilitiesSelectorProps) {
  const [open, setOpen] = useState(false)
  const [showAllTrades, setShowAllTrades] = useState(false)

  // Fetch key trades from database (dynamic system)
  const { trades: keyTradesList, isLoading: loadingKeyTrades } = useKeyContractorTradesArray()

  // Separate trades into key trades and all trades
  const { keyTrades, otherTrades } = useMemo(() => {
    const keySet = new Set(keyTradesList)
    const key: typeof TRADE_OPTIONS = []
    const other: typeof TRADE_OPTIONS = []

    TRADE_OPTIONS.forEach(trade => {
      if (keySet.has(trade.value)) {
        key.push(trade)
      } else {
        other.push(trade)
      }
    })

    return { keyTrades: key, otherTrades: other }
  }, [keyTradesList])

  // Get label for a trade value
  const getTradeLabel = (value: string) => {
    const trade = TRADE_OPTIONS.find(t => t.value === value)
    return trade?.label || value
  }

  const handleSelect = (tradeValue: string) => {
    if (selectedTrades.includes(tradeValue)) {
      // Remove trade
      onChange(selectedTrades.filter(t => t !== tradeValue))
    } else {
      // Add trade
      onChange([...selectedTrades, tradeValue])
    }
  }

  const handleRemove = (tradeValue: string) => {
    onChange(selectedTrades.filter(t => t !== tradeValue))
  }

  return (
    <div className="space-y-2">
      <Label>Trade Capabilities (Optional)</Label>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            <span className="text-muted-foreground">
              {selectedTrades.length === 0
                ? "Select trades..."
                : `${selectedTrades.length} trade${selectedTrades.length > 1 ? 's' : ''} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search trades..." />
            <CommandEmpty>No trade found.</CommandEmpty>
            
            <div className="max-h-80 overflow-y-auto">
              {/* Key Trades Section */}
              <CommandGroup heading="Common Trades">
                {keyTrades.map((trade) => (
                  <CommandItem
                    key={trade.value}
                    value={trade.value}
                    onSelect={() => handleSelect(trade.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedTrades.includes(trade.value) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {trade.label}
                  </CommandItem>
                ))}
              </CommandGroup>

              {/* Show All Trades Toggle */}
              <div className="border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start font-normal text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAllTrades(!showAllTrades)}
                >
                  {showAllTrades ? (
                    <>
                      <ChevronUp className="mr-2 h-4 w-4" />
                      Show less trades
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-2 h-4 w-4" />
                      Show all trades ({otherTrades.length} more)
                    </>
                  )}
                </Button>
              </div>

              {/* All Other Trades Section (expandable) */}
              {showAllTrades && (
                <CommandGroup heading="All Trades">
                  {otherTrades.map((trade) => (
                    <CommandItem
                      key={trade.value}
                      value={trade.value}
                      onSelect={() => handleSelect(trade.value)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedTrades.includes(trade.value) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {trade.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected trades as badges */}
      {selectedTrades.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {selectedTrades.map((tradeValue) => (
            <Badge
              key={tradeValue}
              variant="secondary"
              className="gap-1"
            >
              {getTradeLabel(tradeValue)}
              <button
                type="button"
                className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRemove(tradeValue)
                  }
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={() => handleRemove(tradeValue)}
                disabled={disabled}
              >
                <span className="sr-only">Remove {getTradeLabel(tradeValue)}</span>
                <span className="text-xs hover:text-destructive">×</span>
              </button>
            </Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Select the trades this employer can perform. Common trades are shown first.
      </p>
    </div>
  )
}

