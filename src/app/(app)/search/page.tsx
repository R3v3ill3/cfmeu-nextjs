"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Search,
  FolderOpen,
  Building,
  Users,
  ArrowLeft,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"

export const dynamic = 'force-dynamic'

interface EntityOption {
  id: string
  label: string
  icon: React.ReactNode
  path: string
  description: string
}

const entityOptions: EntityOption[] = [
  {
    id: "projects",
    label: "Projects",
    icon: <FolderOpen className="w-6 h-6" />,
    path: "/projects",
    description: "Search construction projects by name, location, or builder"
  },
  {
    id: "employers",
    label: "Employers",
    icon: <Building className="w-6 h-6" />,
    path: "/employers",
    description: "Search employers by name or ABN"
  },
  {
    id: "workers",
    label: "Workers",
    icon: <Users className="w-6 h-6" />,
    path: "/workers",
    description: "Search workers by name, email, or member number"
  }
]

// Persist last selected entity type
const LAST_ENTITY_KEY = "search-last-entity"

export default function SearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { startNavigation } = useNavigationLoading()
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Initialize search query from URL param if present
  const initialQuery = searchParams.get("q") || ""
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null)
  
  // Load last selected entity from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const lastEntity = localStorage.getItem(LAST_ENTITY_KEY)
      if (lastEntity && entityOptions.some(e => e.id === lastEntity)) {
        setSelectedEntity(lastEntity)
      }
    }
  }, [])
  
  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  
  const handleEntitySelect = (entity: EntityOption) => {
    // Save selection for next time
    localStorage.setItem(LAST_ENTITY_KEY, entity.id)
    setSelectedEntity(entity.id)
    
    // If there's a search query, navigate immediately
    if (searchQuery.trim()) {
      executeSearch(entity)
    }
  }
  
  const executeSearch = (entity?: EntityOption) => {
    const targetEntity = entity || entityOptions.find(e => e.id === selectedEntity)
    if (!targetEntity) return
    
    const query = searchQuery.trim()
    const url = query 
      ? `${targetEntity.path}?q=${encodeURIComponent(query)}`
      : targetEntity.path
    
    startNavigation()
    router.push(url)
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedEntity) {
      executeSearch()
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && selectedEntity && searchQuery.trim()) {
      executeSearch()
    }
  }
  
  const handleBack = () => {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push("/")
    }
  }
  
  const clearSearch = () => {
    setSearchQuery("")
    inputRef.current?.focus()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20 px-safe">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="min-w-[44px] min-h-[44px] touch-manipulation"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Search</h1>
        </div>
      </div>
      
      {/* Search input */}
      <div className="bg-white border-b px-4 py-4">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              ref={inputRef}
              type="search"
              placeholder="What are you looking for?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 pr-10 h-12 text-base rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              enterKeyHint="search"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={clearSearch}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </form>
      </div>
      
      {/* Entity selector */}
      <div className="p-4 space-y-3">
        <p className="text-sm text-gray-600 font-medium">
          {searchQuery.trim() 
            ? "Select where to search:" 
            : "What would you like to search?"}
        </p>
        
        <div className="space-y-3">
          {entityOptions.map((entity) => {
            const isSelected = selectedEntity === entity.id
            
            return (
              <Card
                key={entity.id}
                className={cn(
                  "cursor-pointer transition-all touch-manipulation",
                  "active:scale-[0.98]",
                  isSelected 
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-20" 
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                )}
                onClick={() => handleEntitySelect(entity)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-3 rounded-xl",
                      isSelected ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
                    )}>
                      {entity.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={cn(
                        "font-semibold text-base",
                        isSelected ? "text-blue-900" : "text-gray-900"
                      )}>
                        {entity.label}
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {entity.description}
                      </p>
                    </div>
                    {isSelected && searchQuery.trim() && (
                      <Button
                        size="sm"
                        className="min-h-[44px] min-w-[80px] touch-manipulation"
                        onClick={(e) => {
                          e.stopPropagation()
                          executeSearch()
                        }}
                      >
                        Search
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
      
      {/* Help text */}
      <div className="px-4 pb-8">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Type your search term above, then tap an option to search. 
            Your last choice will be remembered for next time.
          </p>
        </div>
      </div>
    </div>
  )
}
