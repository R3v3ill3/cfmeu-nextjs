"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { backfillJobSiteCoordinates, getBackfillCount, getPatchMatchingCount, runPatchMatching, BackfillResult } from "@/utils/backfillProjectCoordinates"

export function BackfillProjectCoordinates() {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentSite, setCurrentSite] = useState<string>("")
  const [total, setTotal] = useState(0)
  const [needsBackfill, setNeedsBackfill] = useState<number | null>(null)
  const [needsPatchMatching, setNeedsPatchMatching] = useState<number | null>(null)
  const [result, setResult] = useState<BackfillResult | null>(null)

  useEffect(() => {
    loadCounts()
  }, [])

  const loadCounts = async () => {
    try {
      const [backfillCount, patchCount] = await Promise.all([
        getBackfillCount(),
        getPatchMatchingCount()
      ])
      setNeedsBackfill(backfillCount)
      setNeedsPatchMatching(patchCount)
    } catch (error) {
      console.error('Error loading counts:', error)
    }
  }

  const runBackfill = async () => {
    setIsRunning(true)
    setProgress(0)
    setResult(null)
    
    try {
      const backfillResult = await backfillJobSiteCoordinates((current, total, siteName) => {
        setProgress(Math.round((current / total) * 100))
        setTotal(total)
        setCurrentSite(siteName)
      })
      
      setResult(backfillResult)
      
      if (backfillResult.failed === 0) {
        toast.success(`Backfill complete! ${backfillResult.geocoded} sites geocoded, ${backfillResult.matched} matched to patches`)
      } else {
        toast.warning(`Backfill completed with ${backfillResult.failed} failures. Check results below.`)
      }
      
      // Refresh the counts
      await loadCounts()
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Backfill failed: ${errorMessage}`)
    } finally {
      setIsRunning(false)
      setProgress(0)
      setCurrentSite("")
    }
  }

  const runPatchMatchingOnly = async () => {
    setIsRunning(true)
    setResult(null)
    
    try {
      const matchingResult = await runPatchMatching()
      setResult(matchingResult)
      
      if (matchingResult.failed === 0) {
        toast.success(`Patch matching complete! ${matchingResult.matched} sites matched to patches`)
      } else {
        toast.warning(`Patch matching completed with errors. Check results below.`)
      }
      
      // Refresh the counts
      await loadCounts()
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Patch matching failed: ${errorMessage}`)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Coordinate Backfill</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          This tool handles two scenarios: geocoding addresses for job sites without coordinates, 
          and matching existing coordinates to patches. Both enable automatic patch matching for projects.
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {needsBackfill !== null && (
            <Alert>
              <AlertDescription>
                {needsBackfill === 0 ? (
                  <span className="text-green-600">✅ All job sites have coordinates.</span>
                ) : (
                  <span>📍 Found <strong>{needsBackfill}</strong> job sites that need coordinate backfill.</span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {needsPatchMatching !== null && (
            <Alert>
              <AlertDescription>
                {needsPatchMatching === 0 ? (
                  <span className="text-green-600">✅ All job sites are matched to patches.</span>
                ) : (
                  <span>🗺️ Found <strong>{needsPatchMatching}</strong> job sites with coordinates that need patch matching.</span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {isRunning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Processing: {currentSite}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
            <div className="text-xs text-muted-foreground">
              Geocoding addresses using Google Maps API...
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="text-sm font-medium">Backfill Results:</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="text-center">
                <Badge variant="secondary">{result.processed}</Badge>
                <div className="text-xs text-muted-foreground">Processed</div>
              </div>
              <div className="text-center">
                <Badge variant="default">{result.geocoded}</Badge>
                <div className="text-xs text-muted-foreground">Geocoded</div>
              </div>
              <div className="text-center">
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">{result.matched}</Badge>
                <div className="text-xs text-muted-foreground">Matched to Patches</div>
              </div>
              <div className="text-center">
                <Badge variant={result.failed > 0 ? "destructive" : "secondary"}>{result.failed}</Badge>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-destructive">Errors:</div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {result.errors.map((error, index) => (
                    <div key={index} className="text-xs text-muted-foreground p-2 bg-muted rounded">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={runBackfill} 
            disabled={isRunning || needsBackfill === 0}
          >
            {isRunning ? 'Running Geocoding...' : 'Run Coordinate Backfill'}
          </Button>
          <Button 
            onClick={runPatchMatchingOnly} 
            disabled={isRunning || needsPatchMatching === 0}
            variant="secondary"
          >
            {isRunning ? 'Running Matching...' : 'Run Patch Matching'}
          </Button>
          <Button 
            variant="outline" 
            onClick={loadCounts}
            disabled={isRunning}
          >
            Refresh Counts
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
