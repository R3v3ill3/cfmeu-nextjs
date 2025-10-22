# Timeout Implementation Flow Diagram

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Job Processing Starts                        │
│                  (processMappingSheetScan)                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              Download PDF from Supabase Storage                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Call extractWithClaude()                        │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │          Build PDF content with pages                     │   │
│  └─────────────────────┬─────────────────────────────────────┘   │
│                        │                                          │
│                        ▼                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │   Call withTimeoutAndRetry() with Claude API call       │   │
│  │                                                           │   │
│  │   Parameters:                                             │   │
│  │   - timeoutMs: 60000 (60 seconds)                        │   │
│  │   - maxRetries: 1 (2 total attempts)                     │   │
│  │   - operationName: "Claude API call"                     │   │
│  └─────────────────────┬─────────────────────────────────────┘   │
│                        │                                          │
│                        ▼                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │     API Call Wrapped with Timeout Protection            │   │
│  │                                                           │   │
│  │     See detailed flow below ──────────┐                 │   │
│  └─────────────────────┬─────────────────┼─────────────────┘   │
│                        │                  │                      │
│                        │                  │                      │
└────────────────────────┼──────────────────┼──────────────────────┘
                         │                  │
                         │                  │
         ┌───────────────┘                  │
         │                                  │
         ▼                                  │
┌─────────────────┐              ┌─────────▼──────────┐
│    Success      │              │   Timeout Error     │
│                 │              │                     │
│ - Parse JSON    │              │ - Log incident      │
│ - Calculate cost│              │ - Retry if retries  │
│ - Return result │              │   available         │
└────────┬────────┘              │ - Return error      │
         │                       └──────────┬──────────┘
         │                                  │
         └──────────────┬───────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  Update scan record   │
            │  in database          │
            └───────────────────────┘
```

## Detailed Timeout & Retry Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              withTimeoutAndRetry() called                        │
│              (Attempt 1 of up to 2)                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│         Create AbortController with auto-abort timeout           │
│                                                                   │
│  const { controller, cleanup } = createTimeoutController(60000)  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AbortController will auto-abort after 60 seconds        │  │
│  │  Timer ID stored for cleanup                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                Start Promise.race between:                       │
│                                                                   │
│    ┌──────────────────────┐        ┌────────────────────┐      │
│    │  Claude API Call     │   VS   │  Timeout Promise   │      │
│    │  (with AbortSignal)  │        │  (60 seconds)      │      │
│    └──────────┬───────────┘        └──────────┬─────────┘      │
│               │                               │                  │
└───────────────┼───────────────────────────────┼──────────────────┘
                │                               │
                │                               │
        ┌───────┴────────┐            ┌────────┴─────────┐
        │                │            │                  │
        ▼                │            ▼                  │
┌──────────────┐         │    ┌──────────────┐          │
│  API returns │         │    │   Timeout    │          │
│   < 60s      │         │    │   reached    │          │
└──────┬───────┘         │    └──────┬───────┘          │
       │                 │           │                  │
       ▼                 │           ▼                  │
┌──────────────┐         │    ┌──────────────┐          │
│   cleanup()  │         │    │   cleanup()  │          │
│ Clear timer  │         │    │ Clear timer  │          │
└──────┬───────┘         │    └──────┬───────┘          │
       │                 │           │                  │
       ▼                 │           ▼                  │
┌──────────────┐         │    ┌─────────────────────┐   │
│    SUCCESS   │         │    │  throw TimeoutError │   │
└──────┬───────┘         │    └──────┬──────────────┘   │
       │                 │           │                  │
       │                 │           ▼                  │
       │                 │    ┌──────────────────────┐  │
       │                 │    │  Is this attempt #1? │  │
       │                 │    │  Are retries left?   │  │
       │                 │    └──────┬──────────────┘  │
       │                 │           │                  │
       │                 │    ┌──────┴──────┐           │
       │                 │    │             │           │
       │                 │   YES           NO           │
       │                 │    │             │           │
       │                 │    ▼             ▼           │
       │                 │  ┌────┐      ┌──────┐       │
       │                 │  │RETRY│     │THROW │       │
       │                 │  └─┬──┘      └──┬───┘       │
       │                 │    │            │           │
       │                 └────┘            │           │
       │                      │            │           │
       │              ┌───────┘            │           │
       │              │                    │           │
       │              ▼                    │           │
       │    ┌──────────────────┐          │           │
       │    │  Log retry       │          │           │
       │    │  Attempt 2 of 2  │          │           │
       │    └────────┬─────────┘          │           │
       │             │                    │           │
       │             │                    │           │
       │      [Loops back to top]         │           │
       │                                  │           │
       └──────────────┬───────────────────┘           │
                      │                               │
                      ▼                               ▼
              ┌─────────────────┐         ┌──────────────────┐
              │  Return Success │         │  Return Error    │
              │  with data      │         │  timedOut: true  │
              │  timedOut: false│         │  retryCount: N   │
              │  retryCount: N  │         └──────────────────┘
              └─────────────────┘
```

## Error Handling Decision Tree

```
                         Claude API Call
                              │
                              ▼
                     ┌─────────────────┐
                     │  Call Success?  │
                     └────────┬────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                   YES                 NO
                    │                   │
                    ▼                   ▼
            ┌──────────────┐    ┌──────────────┐
            │ Parse JSON   │    │ Error Type?  │
            │ response     │    └──────┬───────┘
            └──────┬───────┘           │
                   │          ┌────────┴────────┐
                   │          │                 │
                   │    TimeoutError      Other Error
                   │          │                 │
                   │          ▼                 ▼
                   │  ┌───────────────┐  ┌─────────────┐
                   │  │ Retries left? │  │ Fail        │
                   │  └───────┬───────┘  │ immediately │
                   │          │          │ (no retry)  │
                   │     ┌────┴────┐     └──────┬──────┘
                   │     │         │            │
                   │    YES       NO            │
                   │     │         │            │
                   │     ▼         ▼            │
                   │  ┌─────┐  ┌──────────┐    │
                   │  │RETRY│  │Log       │    │
                   │  └──┬──┘  │incident  │    │
                   │     │     └────┬─────┘    │
                   │     │          │          │
                   └─────┼──────────┴──────────┘
                         │
                         ▼
                ┌────────────────┐
                │ Return result  │
                │ to processor   │
                └────────┬───────┘
                         │
                         ▼
                ┌─────────────────┐
                │ Update database │
                │ with results    │
                └─────────────────┘
```

## Timeout Incident Logging Flow

```
┌─────────────────────────────────────────────────────────────┐
│              TimeoutError caught in catch block              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           if (error instanceof TimeoutError)                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│            logTimeoutIncident() called                       │
│                                                               │
│  Logs to console.error with structured data:                 │
│                                                               │
│  [timeout-incident] {                                        │
│    timestamp: '2025-10-22T12:34:56.789Z',                   │
│    operation: 'Claude API extraction',                       │
│    timeoutMs: 60000,                                         │
│    selectedPages: '1, 2, 3',                                 │
│    pdfSizeBytes: 524288,                                     │
│    retryCount: 1,                                            │
│    model: 'claude-sonnet-4-5-20250929'                      │
│  }                                                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               Log captured by worker logger                  │
│         (stdout/stderr or logging service)                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           Can be monitored/alerted by:                       │
│           - Log aggregation (e.g., CloudWatch)               │
│           - Error tracking (e.g., Sentry)                    │
│           - Custom monitoring dashboards                     │
└─────────────────────────────────────────────────────────────┘
```

## Configuration & Control Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Environment Variables                     │
│                                                               │
│  CLAUDE_TIMEOUT_MS=60000   (default)                        │
│  CLAUDE_MAX_RETRIES=1      (default)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    config.ts loads values                    │
│                                                               │
│  config.claudeTimeoutMs: 60000                              │
│  config.claudeMaxRetries: 1                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              claude.ts uses config values                    │
│                                                               │
│  withTimeoutAndRetry(                                        │
│    ...,                                                       │
│    {                                                          │
│      timeoutMs: config.claudeTimeoutMs,    // 60000         │
│      maxRetries: config.claudeMaxRetries,  // 1             │
│      ...                                                      │
│    }                                                          │
│  )                                                            │
└─────────────────────────────────────────────────────────────┘
```

## Resource Cleanup Flow

```
┌─────────────────────────────────────────────────────────────┐
│           createTimeoutController() creates:                 │
│                                                               │
│  1. AbortController                                          │
│  2. setTimeout(() => controller.abort(), timeoutMs)          │
│  3. cleanup() function to clearTimeout                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              try { API call } finally { cleanup() }          │
│                                                               │
│  Ensures cleanup() is called in ALL scenarios:               │
│  - Success                                                    │
│  - Timeout                                                    │
│  - Other errors                                               │
│  - Process interruption                                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│             cleanup() called:                                │
│             clearTimeout(timeoutId)                          │
│                                                               │
│  Prevents:                                                    │
│  - Memory leaks from pending timers                          │
│  - Unwanted abort() calls after completion                   │
│  - Timer references keeping process alive                    │
└─────────────────────────────────────────────────────────────┘
```

## Complete Request Lifecycle

```
Request Start
     │
     ▼
┌─────────────────────┐
│ Create timeout      │  t=0ms
│ timer (60s)         │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Start Claude API    │  t=0ms
│ call                │
└─────────┬───────────┘
          │
          │  [Processing...]
          │
          ├──────── Scenario A: Success ─────────────────┐
          │                                               │
          ▼                                               ▼
     t=25,000ms                                      ┌─────────┐
     Response received                               │ cleanup │
          │                                          │  timer  │
          ▼                                          └────┬────┘
     ┌─────────┐                                         │
     │ cleanup │                                         │
     │  timer  │                                         │
     └────┬────┘                                         │
          │                                               │
          ▼                                               │
     Return success                                      │
          │                                               │
          └───────────────────┬─────────────────────────┘
                              │
                              ▼
                         ┌─────────┐
                         │  Done   │
                         └─────────┘

Request Start
     │
     ▼
┌─────────────────────┐
│ Create timeout      │  t=0ms
│ timer (60s)         │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Start Claude API    │  t=0ms
│ call (Attempt 1)    │
└─────────┬───────────┘
          │
          │  [Processing...]
          │
          ├──────── Scenario B: Timeout & Retry ─────────┐
          │                                               │
          ▼                                               ▼
     t=60,000ms                                      ┌─────────┐
     Timeout!                                        │ cleanup │
          │                                          │  timer  │
          ▼                                          └────┬────┘
     ┌─────────┐                                         │
     │ cleanup │                                         │
     │  timer  │                                         │
     └────┬────┘                                         │
          │                                               │
          ▼                                               │
     Log retry attempt                                   │
          │                                               │
          └───────────────────┬─────────────────────────┘
                              │
                              ▼
                         t=60,100ms
                    ┌──────────────────┐
                    │ Create new       │
                    │ timeout (60s)    │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Start API call   │
                    │ (Attempt 2)      │
                    └────────┬─────────┘
                             │
                             ▼
                        t=80,000ms
                        Success!
                             │
                             ▼
                        ┌─────────┐
                        │ cleanup │
                        │  timer  │
                        └────┬────┘
                             │
                             ▼
                        Return success
                        retryCount: 1
```

## Monitoring Dashboard View (Conceptual)

```
┌───────────────────────────────────────────────────────────────┐
│                 Claude API Timeout Monitoring                  │
├───────────────────────────────────────────────────────────────┤
│                                                                 │
│  Requests (Last Hour)                                          │
│  ├─ Total:          124 requests                               │
│  ├─ Successful:     119 (95.97%)  ████████████████████ 96%   │
│  ├─ Timeouts:         3 (2.42%)   █                      2%   │
│  └─ Other Errors:     2 (1.61%)   █                      2%   │
│                                                                 │
│  Timeout Details                                                │
│  ├─ First Attempt:    5 timeouts                               │
│  ├─ Retry Success:    2 recovered                              │
│  └─ Final Failures:   3 failed                                 │
│                                                                 │
│  Processing Times                                               │
│  ├─ Average:       18.5s                                       │
│  ├─ Median:        15.2s                                       │
│  ├─ 95th %ile:     42.3s                                       │
│  └─ Max:           59.8s  ⚠️ Approaching timeout              │
│                                                                 │
│  Recent Timeout Incidents                                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 12:34:56  Timeout after 60s  │ Pages: 1,2,3  │ 512KB   │ │
│  │ 12:28:41  Timeout after 60s  │ Pages: all    │ 2.1MB   │ │
│  │ 11:52:13  Timeout after 60s  │ Pages: 1,2    │ 1.8MB   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Alerts                                                         │
│  ⚠️  Processing times approaching timeout threshold            │
│  ℹ️  3 timeout incidents in last hour (within threshold)       │
│                                                                 │
└───────────────────────────────────────────────────────────────┘
```

## Legend

```
┌─────────────────────────────────────────────┐
│  Flow Diagram Symbols                        │
├─────────────────────────────────────────────┤
│  │  ▼  →  ←  ↓  ↑    Flow direction         │
│  ┌───┐              Process/Action           │
│  └───┘                                        │
│  ┌───────┐          Decision point           │
│  │  ?    │                                    │
│  └───┬───┘                                    │
│      │                                        │
│  ┌───┴───┐          Branch                   │
│  │       │                                    │
│                                               │
│  [...]               Code/comments            │
│                                               │
│  ═══                 Separation               │
└─────────────────────────────────────────────┘
```
