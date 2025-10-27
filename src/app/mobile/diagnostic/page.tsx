"use client"

// Absolute minimal test - NO imports except React
import { useState } from 'react'

export default function DiagnosticPage() {
  const [count, setCount] = useState(0)
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>Mobile Diagnostic Test</h1>
      <p>If you can see this, React is working.</p>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
      
      <hr style={{ margin: '20px 0' }} />
      
      <div>
        <h2>Tests:</h2>
        <p>✅ React useState works</p>
        <p>✅ Client component renders</p>
        <p>Current count: {count}</p>
      </div>
    </div>
  )
}

