"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Home, ArrowLeft, Search, AlertCircle } from "lucide-react"

export default function NotFound() {
  const router = useRouter()
  
  const handleBack = () => {
    // Check if there's history to go back to
    if (typeof window !== "undefined" && window.history.length > 2) {
      router.back()
    } else {
      // Fallback to home if no history
      router.push("/")
    }
  }
  
  const handleHome = () => {
    router.push("/")
  }
  
  const handleSearch = () => {
    router.push("/search")
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header - solid white per UX requirements */}
      <header className="bg-white border-b px-safe sticky top-0 z-20">
        <div className="flex items-center justify-between h-16 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="min-w-[44px] min-h-[44px] touch-manipulation"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-gray-900">Page Not Found</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleHome}
            className="min-w-[44px] min-h-[44px] touch-manipulation"
            aria-label="Go home"
          >
            <Home className="w-5 h-5" />
          </Button>
        </div>
      </header>
      
      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-amber-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Page Not Found
        </h1>
        
        <p className="text-gray-600 mb-8 max-w-sm">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. 
          It may have been moved or doesn&apos;t exist.
        </p>
        
        {/* Action buttons - large tap targets for mobile */}
        <div className="w-full max-w-xs space-y-3">
          <Button
            onClick={handleHome}
            className="w-full h-12 text-base font-medium touch-manipulation"
            size="lg"
          >
            <Home className="w-5 h-5 mr-2" />
            Go to Home
          </Button>
          
          <Button
            onClick={handleBack}
            variant="outline"
            className="w-full h-12 text-base font-medium touch-manipulation"
            size="lg"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Go Back
          </Button>
          
          <Button
            onClick={handleSearch}
            variant="ghost"
            className="w-full h-12 text-base font-medium touch-manipulation text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            size="lg"
          >
            <Search className="w-5 h-5 mr-2" />
            Search
          </Button>
        </div>
      </main>
      
      {/* Footer with safe area padding for PWA */}
      <footer className="pb-safe px-6 py-4 text-center">
        <p className="text-xs text-gray-400">
          CFMEU Organising Database
        </p>
      </footer>
    </div>
  )
}
