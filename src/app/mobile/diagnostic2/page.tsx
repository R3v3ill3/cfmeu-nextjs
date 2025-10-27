"use client"

// Test 2: Import cn directly
import { useState } from 'react'
import { cn } from '@/lib/utils'

export default function Diagnostic2Page() {
  const [count, setCount] = useState(0)
  
  // Try to use cn
  let cnResult = "NOT CALLED YET"
  try {
    cnResult = cn("text-red-500", "font-bold")
  } catch (err) {
    cnResult = `ERROR: ${err instanceof Error ? err.message : String(err)}`
  }
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>Mobile Diagnostic Test 2</h1>
      <p>Testing cn import...</p>
      
      <div style={{ marginTop: '20px', padding: '10px', background: '#f0f0f0' }}>
        <h2>cn() Test Result:</h2>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {cnResult}
        </pre>
      </div>
      
      <button onClick={() => setCount(count + 1)} style={{ marginTop: '20px' }}>
        Count: {count}
      </button>
      
      <div style={{ marginTop: '20px' }}>
        <h3>Additional Info:</h3>
        <p>typeof cn: {typeof cn}</p>
        <p>cn exists: {cn ? 'YES' : 'NO'}</p>
      </div>
    </div>
  )
}

