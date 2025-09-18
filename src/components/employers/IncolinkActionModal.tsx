"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Link2, Download, Upload, Loader2, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface IncolinkActionModalProps {
  isOpen: boolean
  onClose: () => void
  employerId: string
  employerName: string
  currentIncolinkId?: string | null
  onUpdate?: () => void
}

export function IncolinkActionModal({ 
  isOpen, 
  onClose, 
  employerId, 
  employerName, 
  currentIncolinkId,
  onUpdate
}: IncolinkActionModalProps) {
  const [newIncolinkId, setNewIncolinkId] = useState(currentIncolinkId || '')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const hasIncolinkId = !!currentIncolinkId

  const handleUpdateIncolinkId = async () => {
    if (!newIncolinkId.trim()) {
      toast({
        title: "Incolink ID Required",
        description: "Please enter an Incolink ID",
        variant: "destructive"
      })
      return
    }

    setIsUpdating(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('employers')
        .update({ 
          incolink_id: newIncolinkId.trim(),
          incolink_last_matched: new Date().toISOString().split('T')[0]
        })
        .eq('id', employerId)

      if (updateError) throw updateError

      toast({
        title: "Success",
        description: `Incolink ID updated for ${employerName}`,
      })
      
      onUpdate?.()
      onClose()
    } catch (error) {
      console.error('Update incolink ID error:', error)
      setError(error instanceof Error ? error.message : 'Failed to update Incolink ID')
      toast({
        title: "Update Failed",
        description: "Failed to update Incolink ID",
        variant: "destructive"
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleExportData = async () => {
    if (!currentIncolinkId) {
      toast({
        title: "No Incolink ID",
        description: "Cannot export without an Incolink ID",
        variant: "destructive"
      })
      return
    }

    setIsExporting(true)
    setError(null)

    try {
      const response = await fetch('/api/incolink/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          incolinkNumber: currentIncolinkId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Export failed')
      }

      // Handle the file download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `incolink_export_${currentIncolinkId}_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Export Complete",
        description: `Exported data for Incolink ID ${currentIncolinkId}`,
      })
    } catch (error) {
      console.error('Export error:', error)
      setError(error instanceof Error ? error.message : 'Export failed')
      toast({
        title: "Export Failed",
        description: "Failed to export Incolink data",
        variant: "destructive"
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportWorkers = async () => {
    if (!currentIncolinkId) {
      toast({
        title: "No Incolink ID",
        description: "Cannot import without an Incolink ID",
        variant: "destructive"
      })
      return
    }

    setIsImporting(true)
    setError(null)

    try {
      const response = await fetch('/api/incolink/import-workers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          incolinkNumber: currentIncolinkId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Import failed')
      }

      const result = await response.json()
      
      toast({
        title: "Import Complete",
        description: `Imported ${result.members?.length || 0} workers from Incolink`,
      })

      onUpdate?.()
    } catch (error) {
      console.error('Import error:', error)
      setError(error instanceof Error ? error.message : 'Import failed')
      toast({
        title: "Import Failed",
        description: "Failed to import worker data from Incolink",
        variant: "destructive"
      })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-emerald-500" />
            Incolink Integration
          </DialogTitle>
          <DialogDescription>
            Manage Incolink ID and data integration for <strong>{employerName}</strong>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={hasIncolinkId ? "actions" : "setup"} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="setup">
              {hasIncolinkId ? "Update ID" : "Setup"}
            </TabsTrigger>
            <TabsTrigger value="actions" disabled={!hasIncolinkId}>
              Data Actions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-4">
            <div className="space-y-4">
              {hasIncolinkId && (
                <Alert>
                  <Link2 className="h-4 w-4" />
                  <AlertDescription>
                    Current Incolink ID: <Badge variant="outline">{currentIncolinkId}</Badge>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="incolinkId">Incolink Employer ID</Label>
                <Input
                  id="incolinkId"
                  placeholder="Enter Incolink ID (e.g., 1234567)"
                  value={newIncolinkId}
                  onChange={(e) => setNewIncolinkId(e.target.value)}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateIncolinkId} disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 mr-2" />
                      {hasIncolinkId ? "Update ID" : "Save ID"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <div className="space-y-4">
              <Alert>
                <Link2 className="h-4 w-4" />
                <AlertDescription>
                  Incolink ID: <Badge variant="outline">{currentIncolinkId}</Badge>
                  <br />
                  Use these actions to sync data with the Incolink portal.
                </AlertDescription>
              </Alert>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <h4 className="font-medium">Export Member Data</h4>
                    <p className="text-sm text-gray-600">
                      Download current member list and invoice data from Incolink portal
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleExportData}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <h4 className="font-medium">Import Worker Data</h4>
                    <p className="text-sm text-gray-600">
                      Sync worker membership data from Incolink into our system
                    </p>
                  </div>
                  <Button
                    variant="default"
                    onClick={handleImportWorkers}
                    disabled={isImporting}
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Import
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
