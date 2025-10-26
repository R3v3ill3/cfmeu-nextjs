"use client"

import { useState } from 'react'
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

// Simple test component to verify cn import works
function TestComponent() {
  const [count, setCount] = useState(0)

  return (
    <Card className={cn("w-full max-w-md mx-auto", "p-4")}>
      <CardHeader>
        <CardTitle>Mobile Test Page</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p>cn import test: {cn("text-sm", "text-muted-foreground")}</p>
          <p>Count: {count}</p>
          <Button onClick={() => setCount(count + 1)}>
            Increment
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function MobileTestPage() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Mobile Test</h1>
        <p>This page tests if mobile components work correctly.</p>
        <TestComponent />
      </div>
    </div>
  )
}