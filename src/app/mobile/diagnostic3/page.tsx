"use client"

// Test 3: Import shadcn components
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function Diagnostic3Page() {
  const [count, setCount] = useState(0)
  
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Mobile Diagnostic Test 3</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>UI Components Test</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn("text-sm", "text-muted-foreground")}>
            If you see this styled card, shadcn components work!
          </p>
          
          <Button onClick={() => setCount(count + 1)} className="mt-4">
            Count: {count}
          </Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <p>✅ cn() function works</p>
            <p>✅ Tailwind classes apply</p>
            <p>✅ Card component renders</p>
            <p>✅ Button component works</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

