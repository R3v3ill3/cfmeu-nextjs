import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Share2, Home, X, Compass } from "lucide-react"

const DISMISS_KEY = "ios-pwa-install-dismissed"

export function useIosInstallPrompt() {
  const [visible, setVisible] = useState(false)

  const evaluate = useCallback(() => {
    if (typeof window === "undefined") return

    const ua = window.navigator.userAgent || ""
    const isIos = /iPad|iPhone|iPod/.test(ua)
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (window.navigator as any).standalone === true
    const dismissed = localStorage.getItem(DISMISS_KEY) === "true"

    setVisible(isIos && !isStandalone && !dismissed)
  }, [])

  useEffect(() => {
    evaluate()
    document.addEventListener("visibilitychange", evaluate)

    return () => {
      document.removeEventListener("visibilitychange", evaluate)
    }
  }, [evaluate])

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "true")
    setVisible(false)
  }, [])

  const reset = useCallback(() => {
    localStorage.removeItem(DISMISS_KEY)
    evaluate()
  }, [evaluate])

  return { visible, dismiss, reset, evaluate }
}

interface IosInstallPromptProps {
  visible: boolean
  onDismiss?: () => void
}

export function IosInstallPrompt({ visible, onDismiss }: IosInstallPromptProps) {
  if (!visible) return null

  const handleDismiss = () => {
    onDismiss?.()
  }

  return (
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Install for Reliable Reminders</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            iOS only delivers location prompts reliably when this app is added to your home screen.
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Dismiss install instructions"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <Share2 className="h-4 w-4 text-blue-600 mt-0.5" />
          <p>
            1. In Safari tap the <strong>Share</strong> icon, then choose <strong>Add to Home Screen</strong>.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <Home className="h-4 w-4 text-blue-600 mt-0.5" />
          <p>
            2. Launch the installed CFMEU app from your home screen to enable fullscreen mode and push permissions.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <Compass className="h-4 w-4 text-blue-600 mt-0.5" />
          <p>
            3. Enable geofencing in <strong>Settings → Notifications</strong> and accept the iOS “While Using the App”
            location prompt.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}


