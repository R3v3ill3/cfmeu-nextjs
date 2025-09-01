"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { GoogleAddressInput, type GoogleAddress } from "@/components/projects/GoogleAddressInput"
import { supabase } from "@/integrations/supabase/client"

type LookupResult = {
  status: "found" | "unallocated" | "error" | null
  patchId?: string
  patchName?: string
  lat?: number
  lng?: number
  message?: string
}

export function AddressLookupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [addr, setAddr] = useState<GoogleAddress | null>(null)
  const [manual, setManual] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LookupResult>({ status: null })

  useEffect(() => {
    if (!open) {
      setAddr(null)
      setManual("")
      setLoading(false)
      setResult({ status: null })
    }
  }, [open])

  const canSubmit = useMemo(() => {
    return Boolean(addr?.formatted || manual.trim())
  }, [addr, manual])

  const geocode = useCallback(async (text: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      // Google Maps script may already be present from other components
      if (!(window as any).google?.maps?.Geocoder) {
        // Fallback: try to import core library if using async loader
        try {
          if ((window as any).google?.maps?.importLibrary) {
            await (window as any).google.maps.importLibrary("core")
          }
        } catch {}
      }
      const Geocoder = (window as any).google?.maps?.Geocoder
      if (!Geocoder) return null
      const g = new Geocoder()
      const res: any = await new Promise((resolve, reject) => {
        try {
          g.geocode({ address: text }, (results: any, status: string) => {
            if (status === "OK" && results && results[0]) resolve(results)
            else resolve(null)
          })
        } catch (e) {
          resolve(null)
        }
      })
      if (!res || !res[0]) return null
      const loc = res[0].geometry?.location
      const lat = typeof loc?.lat === "function" ? loc.lat() : loc?.lat
      const lng = typeof loc?.lng === "function" ? loc.lng() : loc?.lng
      if (typeof lat === "number" && typeof lng === "number") return { lat, lng }
      return null
    } catch {
      return null
    }
  }, [])

  const handleLookup = useCallback(async () => {
    if (!canSubmit || loading) return
    setLoading(true)
    setResult({ status: null })
    try {
      const text = (addr?.formatted || manual).trim()
      if (!text) return

      let lat = addr?.lat
      let lng = addr?.lng
      if ((lat === undefined || lng === undefined) || (lat === null || lng === null)) {
        const geo = await geocode(text)
        lat = geo?.lat
        lng = geo?.lng
      }

      if (typeof lat !== "number" || typeof lng !== "number") {
        setResult({ status: "error", message: "Could not resolve address to coordinates" })
        toast.error("Could not resolve address to coordinates")
        return
      }

      const { data, error } = await (supabase as any).rpc("find_patch_for_coordinates", { lat, lng })
      if (error) throw error
      const row = (Array.isArray(data) ? data[0] : null) as { id: string; name: string } | null
      if (row) {
        setResult({ status: "found", patchId: row.id, patchName: row.name, lat, lng })
      } else {
        setResult({ status: "unallocated", lat, lng })
      }
    } catch (e: any) {
      console.error(e)
      setResult({ status: "error", message: e?.message || "Lookup failed" })
      toast.error("Patch lookup failed")
    } finally {
      setLoading(false)
    }
  }, [addr, manual, canSubmit, loading, geocode])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Address lookup</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Search address</Label>
            <GoogleAddressInput
              value={addr?.formatted || manual}
              onChange={(a) => {
                setAddr(a)
                setManual(a.formatted || "")
              }}
              placeholder="Start typing an address…"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Close</Button>
            <Button onClick={handleLookup} disabled={!canSubmit || loading}>
              {loading ? "Checking…" : "Check patch"}
            </Button>
          </div>

          {result.status && (
            <div className="rounded border p-3 text-sm">
              {result.status === "found" && (
                <div className="space-y-1">
                  <div>
                    Patch: <span className="font-medium">{result.patchName}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Coordinates: {result.lat?.toFixed(6)}, {result.lng?.toFixed(6)}
                  </div>
                  {result.patchId && (
                    <div>
                      <a
                        href={`/patch?patch=${encodeURIComponent(result.patchId)}`}
                        className="text-primary hover:underline"
                      >
                        Open patch dashboard
                      </a>
                    </div>
                  )}
                </div>
              )}
              {result.status === "unallocated" && (
                <div className="space-y-1">
                  <div>
                    <span className="font-medium">Unallocated area</span>
                  </div>
                  <div className="text-muted-foreground">
                    Coordinates: {result.lat?.toFixed(6)}, {result.lng?.toFixed(6)}
                  </div>
                </div>
              )}
              {result.status === "error" && (
                <div className="text-destructive">{result.message || "Lookup failed"}</div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AddressLookupDialog


