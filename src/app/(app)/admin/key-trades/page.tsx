"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useKeyContractorTrades, useKeyContractorTradesAdmin } from "@/hooks/useKeyContractorTrades"
import { Search, Plus, X, AlertCircle, CheckCircle, GripVertical } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { format } from "date-fns"

export default function KeyTradesManagementPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [pendingAction, setPendingAction] = useState<{
    type: 'add' | 'remove'
    tradeType: string
    tradeLabel: string
  } | null>(null)

  // Fetch current configuration
  const { data: apiData, isLoading, refetch } = useQuery({
    queryKey: ['admin-key-trades'],
    queryFn: async () => {
      const response = await fetch('/api/admin/key-trades')
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch key trades')
      }
      return response.json()
    }
  })

  // Admin mutations
  const { addTrade, removeTrade } = useKeyContractorTradesAdmin()

  const keyTrades = apiData?.keyTrades || []
  const availableTrades = apiData?.availableTrades || []
  const stats = apiData?.stats || { keyTradesCount: 0, availableTradesCount: 0, minRequired: 5, maxAllowed: 20 }

  // Filter available trades by search term
  const filteredAvailableTrades = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return availableTrades
    return availableTrades.filter((trade: any) =>
      trade.label.toLowerCase().includes(term) ||
      trade.value.toLowerCase().includes(term)
    )
  }, [availableTrades, searchTerm])

  const handleAddTrade = async (tradeType: string, tradeLabel: string) => {
    // Check max limit
    if (keyTrades.length >= 20) {
      toast({
        title: "Maximum reached",
        description: "Cannot have more than 20 key trades. Remove a trade before adding another.",
        variant: "destructive"
      })
      return
    }

    try {
      await addTrade.mutateAsync({
        trade_type: tradeType,
        notes: `Added via admin UI by user`
      })

      toast({
        title: "Success",
        description: `${tradeLabel} added to key trades`
      })

      refetch()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add trade",
        variant: "destructive"
      })
    }
  }

  const handleRemoveTrade = async (id: string, tradeLabel: string) => {
    // Check min limit
    if (keyTrades.length <= 5) {
      toast({
        title: "Minimum required",
        description: "Must maintain at least 5 key trades. Cannot remove more.",
        variant: "destructive"
      })
      return
    }

    try {
      await removeTrade.mutateAsync({ id })

      toast({
        title: "Success",
        description: `${tradeLabel} removed from key trades`
      })

      refetch()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove trade",
        variant: "destructive"
      })
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Key Contractor Trades</h1>
        <div className="text-sm text-muted-foreground">Loading configuration...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Key Contractor Trades</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage which trades are considered "key contractors" for metrics, prioritization, and filtering across the application.
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>System-wide Configuration</AlertTitle>
        <AlertDescription>
          Changes to key trades affect dashboard metrics, project mapping, compliance tracking, and EBA workflows across the entire system.
          Current configuration: {stats.keyTradesCount} of {stats.maxAllowed} key trades ({stats.minRequired} minimum required).
        </AlertDescription>
      </Alert>

      {/* Current Key Trades Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Current Key Trades ({keyTrades.length})</span>
            <Badge variant={keyTrades.length < 10 ? "secondary" : "default"}>
              {keyTrades.length} / {stats.maxAllowed}
            </Badge>
          </CardTitle>
          <CardDescription>
            These trades are prioritized in dropdowns, used in metrics calculations, and highlighted in compliance tracking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Trade Name</TableHead>
                  <TableHead>Added Date</TableHead>
                  <TableHead className="text-right w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keyTrades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No key trades configured
                    </TableCell>
                  </TableRow>
                ) : (
                  keyTrades.map((trade: any, index: number) => (
                    <TableRow key={trade.id}>
                      <TableCell className="font-medium text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{trade.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {trade.added_at ? format(new Date(trade.added_at), "MMM dd, yyyy") : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPendingAction({
                            type: 'remove',
                            tradeType: trade.trade_type,
                            tradeLabel: trade.label
                          })}
                          disabled={keyTrades.length <= 5 || removeTrade.isPending}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {keyTrades.length === 5 && (
            <Alert className="mt-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Minimum limit reached. You must have at least 5 key trades.
              </AlertDescription>
            </Alert>
          )}
          
          {keyTrades.length === 20 && (
            <Alert className="mt-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Maximum limit reached. Remove a trade before adding another.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Available Trades Table */}
      <Card>
        <CardHeader>
          <CardTitle>Available Trades ({filteredAvailableTrades.length})</CardTitle>
          <CardDescription>
            Trades that can be added to the key trades list. Search to filter.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search available trades..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trade Name</TableHead>
                  <TableHead className="text-right w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAvailableTrades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      {searchTerm ? 'No trades match your search' : 'All trades are already key trades'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAvailableTrades.map((trade: any) => (
                    <TableRow key={trade.value}>
                      <TableCell>{trade.label}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPendingAction({
                            type: 'add',
                            tradeType: trade.value,
                            tradeLabel: trade.label
                          })}
                          disabled={keyTrades.length >= 20 || addTrade.isPending}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add to Key Trades
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!pendingAction} onOpenChange={() => setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === 'add' ? 'Add to Key Trades' : 'Remove from Key Trades'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === 'add' ? (
                <>
                  Add <strong>{pendingAction.tradeLabel}</strong> to the key trades list?
                  <br /><br />
                  This will affect:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Dashboard metrics and KPIs</li>
                    <li>Project mapping interface (trade prioritization)</li>
                    <li>Compliance tracking and reporting</li>
                    <li>EBA search and assignment workflows</li>
                  </ul>
                </>
              ) : (
                <>
                  Remove <strong>{pendingAction?.tradeLabel}</strong> from the key trades list?
                  <br /><br />
                  <strong className="text-destructive">Warning:</strong> This will affect dashboard metrics and may change how contractors are prioritized across the system.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingAction) {
                  if (pendingAction.type === 'add') {
                    handleAddTrade(pendingAction.tradeType, pendingAction.tradeLabel)
                  } else {
                    const trade = keyTrades.find((t: any) => t.trade_type === pendingAction.tradeType)
                    if (trade) {
                      handleRemoveTrade(trade.id, pendingAction.tradeLabel)
                    }
                  }
                  setPendingAction(null)
                }
              }}
            >
              {pendingAction?.type === 'add' ? 'Add Trade' : 'Remove Trade'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


