# AI-Powered Help System - Implementation Plan

## Executive Summary

This document outlines a comprehensive plan to implement an AI-powered help chatbot for the CFMEU Organiser Platform. The system will provide context-aware, accurate guidance without hallucinating information by using Retrieval Augmented Generation (RAG) with embedded documentation.

## Current State Analysis

### Existing Help System
- **USER_GUIDE.md**: 282 lines covering basic page summaries and workflows
- **helpGuide.ts**: Simple keyword-based search through markdown sections
- **HelpContext**: Tracks current page and role for context-aware help
- **Guide Page**: Static markdown display at `/guide`

### Limitations
- No interactive help
- Limited search capabilities (keyword matching only)
- No context-aware suggestions
- Documentation gaps for advanced features
- No step-by-step guided workflows

## Application Feature Inventory

### Core Features (Requiring Documentation)

#### 1. **Dashboard** (Role-Based)
- Organiser view: Patch summary cards
- Co-ordinator view: Team oversight with expandable patches
- Admin view: System-wide metrics and hierarchical drill-down
- Filtering: Tier, stage, universe, EBA status
- Organizing Universe metrics

#### 2. **Projects Management**
- Card/List/Map views
- Advanced filtering (tier, universe, stage, EBA, patch)
- Project creation and editing
- Value and tier classification
- Organising universe assignment (auto-rules)
- Project import (BCI CSV/Excel via worker)

#### 3. **Mapping Sheets**
- Project-level contractor assignment
- Trade contractor management (Early Works, Structure, Finishing, Other)
- Site contacts (Delegate, HSR, Site Manager, Foreman)
- Delegate registration workflow (4-step process)
- Share links for external data collection
- EBA status tracking per contractor
- Auto-matching indicators for imported data

#### 4. **Employers Database**
- Card/List views with filtering
- EBA status (Active, Lodged, Signed, Certified)
- FWC lookup integration (via scraper worker)
- Employer merging for duplicates
- Incolink sync (via scraper worker)
- Contractor classification (builder, head_contractor, subcontractor)

#### 5. **Workers Management**
- Card/List views
- Membership status filtering
- Work placement history
- Union roles (Delegate, HSR)
- Incolink integration
- Trade classifications

#### 6. **Patch Management**
- Geographic assignment to organisers
- Interactive map with project plotting
- Patch boundary visualization (GeoJSON)
- Project assignment rules
- Patch-specific project filtering

#### 7. **Site Visits**
- Visit logging with date, notes, actions
- Multi-employer site visits
- Compliance tracking integration
- Organiser attribution (auto for organisers, selectable for co-ordinators)

#### 8. **Campaigns & Activities**
- Campaign creation and management
- Activity builder with worker universe selection
- Multi-level rating system (1-5 scale)
- Scope assignment (projects, employers, sites)
- Objectives and targets tracking
- Worker participation tracking

#### 9. **Map Visualization**
- Project location plotting
- Patch boundary display
- Interactive filtering
- Heat maps for activity density

#### 10. **Admin Functions**
- User management and invitations
- Role assignment (admin, lead_organiser, organiser, delegate, viewer)
- Hierarchy management (co-ordinator assignments)
- Spatial assignment (patch drawing)
- Navigation visibility control
- Data uploads (BCI, EBA, Workers, Employers, Projects)
- System health monitoring

#### 11. **Advanced Features**
- **EBA Tracking**: Expiry monitoring, milestone tracking
- **Compliance Audits**: CBUS, Incolink, safety checks
- **FWC Lookup**: Automated agreement searching via worker
- **Incolink Sync**: Worker data synchronization via worker
- **Wallcharts**: Visual project organization
- **Organizing Universe Rules**: Auto-classification with manual override
- **Secure Share Links**: Time-limited external access tokens

### User Roles & Permissions
- **Admin**: Full system access
- **Lead Organiser (Co-ordinator)**: Team management, patch oversight, data import
- **Organiser**: Patch work, site visits, basic data entry
- **Delegate**: Limited project/worker access
- **Viewer**: Read-only access

## Proposed Solution: RAG-Based AI Help System

### Architecture Overview

```
┌─────────────────┐
│   Next.js App   │
│  (Frontend UI)  │
└────────┬────────┘
         │ 1. User asks question
         │    + current context (page, role)
         ▼
┌─────────────────┐
│  Help Dialog    │◄─── HelpContext provides scope
│   Component     │
└────────┬────────┘
         │ 2. POST /api/help/chat
         ▼
┌─────────────────┐
│   Next.js API   │
│   Route Handler │
└────────┬────────┘
         │ 3. Forward to worker
         ▼
┌─────────────────────────────┐
│  Railway Worker:            │
│  cfmeu-help-ai-worker       │
│                             │
│  ┌────────────────────┐    │
│  │ Vector Store       │    │
│  │ (Pinecone/Chroma)  │    │
│  │                    │    │
│  │ - Embedded docs    │    │
│  │ - Feature guides   │    │
│  │ - Workflow steps   │    │
│  └───────┬────────────┘    │
│          │                  │
│          │ 4. Retrieve      │
│          │    relevant      │
│          │    context       │
│          ▼                  │
│  ┌────────────────────┐    │
│  │ OpenAI/Gemini API  │    │
│  │ (GPT-4 / Gemini Pro)│   │
│  │                    │    │
│  │ System prompt:     │    │
│  │ "You are help for  │    │
│  │  CFMEU platform.   │    │
│  │  Only answer based │    │
│  │  on provided docs" │    │
│  └───────┬────────────┘    │
│          │                  │
│          │ 5. Generate      │
│          │    grounded      │
│          │    response      │
└──────────┼──────────────────┘
           │ 6. Return answer
           │    + citations
           ▼
     ┌──────────┐
     │   User   │
     └──────────┘
```

### Why Use a Railway Worker?

#### Advantages ✅
1. **API Key Security**: Keep OpenAI/Gemini keys server-side, not in Next.js env
2. **Cost Control**: Rate limiting, caching, usage monitoring
3. **Resource Isolation**: AI processing doesn't impact Next.js performance
4. **Consistent Architecture**: Matches existing workers (scraper, dashboard, BCI)
5. **Scalability**: Independent scaling from web app
6. **Embeddings Management**: Pre-compute and store document embeddings efficiently
7. **Caching**: Cache similar questions and responses
8. **No NEXT_PUBLIC_* Pollution**: [[memory:9218171]] - User prefers workers independent of frontend env vars

#### Considerations ⚠️
1. **Additional Infrastructure**: Another service to deploy and monitor
2. **Network Latency**: API call to worker adds ~100-200ms
3. **Complexity**: More moving parts to maintain

**Decision: USE A RAILWAY WORKER** - Benefits outweigh costs, especially for preventing hallucination and maintaining architectural consistency.

## Implementation Plan

### Phase 1: Documentation Expansion (Week 1-2)

#### 1.1 Expand USER_GUIDE.md
Create comprehensive sections:

**Enhanced Content Structure:**
```markdown
# CFMEU Organiser Platform User Guide

## Part 1: Getting Started
- System Overview
- Role-Based Access
- First Login Checklist
- Navigation Guide

## Part 2: Core Features (By Role)

### For All Users
- Dashboard Basics
- Viewing Projects
- Viewing Employers
- Viewing Workers
- Using the Map
- Searching and Filtering

### For Organisers
- Managing Your Patch
- Logging Site Visits
- Creating Projects
- Updating Mapping Sheets
- Registering Delegates
- Using Share Links
- Recording Activities

### For Co-ordinators
- Team Dashboard
- Managing Organisers
- Patch Assignment
- Reviewing Team Activity
- Data Upload Tools
- Delegate Management

### For Admins
- User Management
- System Configuration
- Navigation Control
- Hierarchy Management
- Spatial Assignment
- System Health Monitoring

## Part 3: Advanced Workflows

### Project Lifecycle
1. Creating a New Project
2. Classifying Project Tier
3. Assigning to Organizing Universe
4. Mapping Contractors
5. Tracking Workers
6. Site Visit Workflow
7. EBA Coverage Monitoring

### Delegate Registration
1. Identifying Candidates
2. Worker Selection/Creation
3. Contact Information
4. Registration Details
5. Submitting to CFMEU

### Campaign Management
1. Creating a Campaign
2. Building Activities
3. Defining Worker Universe
4. Setting Rating Scales
5. Recording Participation
6. Tracking Progress

### Data Import Workflows
1. BCI Import Process
2. EBA Data Upload
3. Worker Import
4. Employer Management
5. Handling Duplicates

### EBA Tracking
1. FWC Lookup
2. Milestone Tracking
3. Expiry Monitoring
4. Certification Process

## Part 4: Features by Page

### Dashboard (/)
- Metrics Explained
- Filtering Options
- Role-Specific Views
- Understanding Organizing Universe Stats

### Projects (/projects)
- View Modes (Card, List, Map)
- Filtering System
- Creating Projects
- Project Detail View
- Mapping Sheets Tab
- Wallcharts
- EBA Search
- Audit & Compliance

[Continue for each page...]

## Part 5: Reference

### Terminology Glossary
- Organising Universe (Active, Potential, Excluded)
- Project Tiers (1, 2, 3)
- Stage Classifications
- EBA Milestones
- Trade Types

### Keyboard Shortcuts
### Data Export Options
### Troubleshooting Common Issues
### FAQ

## Part 6: Technical Notes
- Browser Compatibility
- Mobile Access
- Printing Mapping Sheets
- Data Refresh Intervals
```

#### 1.2 Create Structured Documentation Database
**Format:** JSON/YAML for easy embedding

```json
{
  "documents": [
    {
      "id": "dashboard-overview",
      "title": "Dashboard Overview",
      "category": "core-features",
      "roles": ["all"],
      "pages": ["/"],
      "content": "The dashboard provides...",
      "keywords": ["dashboard", "overview", "metrics", "summary"],
      "related": ["dashboard-filters", "role-based-views"]
    },
    {
      "id": "delegate-registration-workflow",
      "title": "How to Register a Delegate",
      "category": "workflows",
      "roles": ["organiser", "lead_organiser", "admin"],
      "pages": ["/projects/[id]"],
      "steps": [
        "Navigate to project mapping sheets",
        "Click 'Add Representative' in Site Contacts",
        "Select worker from project or create new",
        "Review worker contact details",
        "Enter election information",
        "Submit to CFMEU form"
      ],
      "content": "...",
      "related": ["mapping-sheets", "workers"]
    }
  ]
}
```

### Phase 2: Railway Worker Setup (Week 2)

#### 2.1 Create Worker Service
**Location:** `/railway_workers/cfmeu-help-ai-worker/`

**Tech Stack:**
- **Runtime**: Node.js with TypeScript
- **Framework**: Fastify (lightweight, fast)
- **Vector DB**: Pinecone (managed) or ChromaDB (self-hosted)
- **AI Provider**: OpenAI GPT-4-turbo OR Google Gemini Pro 1.5
- **Embeddings**: OpenAI text-embedding-3-small (cheaper) or Gemini embeddings

**Project Structure:**
```
cfmeu-help-ai-worker/
├── src/
│   ├── index.ts              # Main server
│   ├── config.ts             # Environment config
│   ├── embeddings.ts         # Generate/manage embeddings
│   ├── vectorStore.ts        # Vector DB operations
│   ├── aiProvider.ts         # OpenAI/Gemini client
│   ├── ragPipeline.ts        # RAG orchestration
│   ├── cache.ts              # Response caching
│   └── types.ts              # Shared types
├── docs/                      # Documentation source files
│   ├── user-guide.json
│   ├── workflows.json
│   └── features.json
├── package.json
├── tsconfig.json
├── Dockerfile
└── railway.toml
```

#### 2.2 Environment Variables
```env
# AI Provider (choose one)
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
AI_PROVIDER=openai  # or 'gemini'

# Vector Store
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=...
PINECONE_INDEX_NAME=cfmeu-help-docs

# OR for ChromaDB
CHROMA_HOST=...
CHROMA_PORT=8000

# Supabase (for auth verification)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Config
PORT=3260
CORS_ORIGIN=http://localhost:3000,https://your-app.vercel.app
CACHE_TTL_SECONDS=3600
MAX_TOKENS=1000
TEMPERATURE=0.1  # Low temperature for factual responses
```

#### 2.3 API Endpoints

**POST /v1/chat**
```typescript
// Request
{
  "message": "How do I register a delegate?",
  "context": {
    "page": "/projects/abc-123",
    "role": "organiser",
    "projectId": "abc-123",
    "conversationHistory": [...]  // Optional, for multi-turn
  }
}

// Response
{
  "answer": "To register a delegate, follow these steps:\n1. Navigate...",
  "confidence": 0.95,
  "sources": [
    {
      "docId": "delegate-registration-workflow",
      "title": "How to Register a Delegate",
      "excerpt": "..."
    }
  ],
  "suggestedActions": [
    {
      "label": "View Mapping Sheets",
      "path": "/projects/abc-123?tab=mappingsheets"
    }
  ]
}
```

**POST /v1/embed**
```typescript
// Admin endpoint to re-embed documentation
{
  "force": true
}
```

**GET /health**
```typescript
{
  "status": "ok",
  "vectorStore": "connected",
  "aiProvider": "openai",
  "embeddedDocs": 245
}
```

### Phase 3: RAG Pipeline Implementation (Week 3)

#### 3.1 Document Embedding Process

```typescript
// src/embeddings.ts
import { OpenAI } from 'openai';
import fs from 'fs/promises';

export async function embedDocumentation() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Load structured docs
  const userGuide = JSON.parse(await fs.readFile('docs/user-guide.json', 'utf-8'));
  const workflows = JSON.parse(await fs.readFile('docs/workflows.json', 'utf-8'));
  
  const documents = [...userGuide.documents, ...workflows.documents];
  
  // Generate embeddings in batches
  const embeddings = [];
  for (const doc of documents) {
    const text = `${doc.title}\n\n${doc.content}\n\nKeywords: ${doc.keywords.join(', ')}`;
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    embeddings.push({
      id: doc.id,
      vector: response.data[0].embedding,
      metadata: {
        title: doc.title,
        category: doc.category,
        roles: doc.roles,
        pages: doc.pages,
        content: doc.content,
      }
    });
  }
  
  // Store in vector DB
  await vectorStore.upsert(embeddings);
}
```

#### 3.2 RAG Query Pipeline

```typescript
// src/ragPipeline.ts
export async function answerQuestion(
  question: string, 
  context: HelpContext
): Promise<HelpResponse> {
  
  // 1. Embed the question
  const questionEmbedding = await embed(question);
  
  // 2. Retrieve relevant docs (top 5)
  const relevantDocs = await vectorStore.query({
    vector: questionEmbedding,
    topK: 5,
    filter: {
      roles: { $in: [context.role, 'all'] },
      pages: { $in: [context.page, 'all'] }
    }
  });
  
  // 3. Build context for AI
  const systemPrompt = `You are a helpful assistant for the CFMEU Organiser Platform.

CRITICAL RULES:
- ONLY answer based on the provided documentation
- If information is not in the docs, say "I don't have information about that"
- Never make assumptions or invent features
- Always cite the source document
- Provide step-by-step instructions when appropriate
- Use the user's current page context to provide relevant guidance

Current User Context:
- Role: ${context.role}
- Page: ${context.page}
- Feature: ${getFeatureName(context.page)}`;

  const userPrompt = `Question: ${question}

Relevant Documentation:
${relevantDocs.map((doc, i) => `
[Document ${i+1}: ${doc.metadata.title}]
${doc.metadata.content}
`).join('\n\n')}

Please answer the question based ONLY on the documentation above.`;

  // 4. Call AI provider
  const aiResponse = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    temperature: 0.1,  // Low for factual accuracy
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 1000,
  });
  
  // 5. Extract answer and confidence
  const answer = aiResponse.choices[0].message.content;
  
  // 6. Build response with citations
  return {
    answer,
    confidence: calculateConfidence(relevantDocs),
    sources: relevantDocs.map(doc => ({
      docId: doc.id,
      title: doc.metadata.title,
      excerpt: doc.metadata.content.substring(0, 200) + '...'
    })),
    suggestedActions: extractActions(context, relevantDocs)
  };
}
```

#### 3.3 Hallucination Prevention Strategies

1. **Low Temperature**: Set to 0.1 for deterministic, factual responses
2. **Explicit Instructions**: System prompt emphasizes "ONLY from documentation"
3. **Confidence Scoring**: Track vector similarity scores
4. **Citation Required**: Always include source documents
5. **Fallback Messages**: "I don't have that information" when confidence < 0.6
6. **Human Review**: Log all responses for quality monitoring
7. **Feedback Loop**: Track which answers get thumbs down
8. **Version Control**: Track documentation version with each response

```typescript
function calculateConfidence(docs: VectorSearchResult[]): number {
  if (docs.length === 0) return 0;
  
  // Average similarity score of top 3 docs
  const topScores = docs.slice(0, 3).map(d => d.score);
  const avgScore = topScores.reduce((a, b) => a + b, 0) / topScores.length;
  
  return avgScore;
}

function shouldAnswerQuestion(confidence: number): boolean {
  return confidence >= 0.6;  // Threshold for answering
}
```

### Phase 4: Frontend Integration (Week 4)

#### 4.1 Help Dialog Component

```tsx
// src/components/help/AiHelpDialog.tsx
'use client'

import { useState } from 'react'
import { useHelpContext } from '@/context/HelpContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Send, ThumbsUp, ThumbsDown, ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  actions?: SuggestedAction[]
}

export function AiHelpDialog({ open, onOpenChange }: DialogProps) {
  const { scope } = useHelpContext()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  
  const handleSend = async () => {
    if (!input.trim()) return
    
    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    
    try {
      const response = await fetch('/api/help/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          context: scope,
          conversationHistory: messages.slice(-6), // Last 3 turns
        })
      })
      
      const data = await response.json()
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        actions: data.suggestedActions,
      }
      
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Help chat error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      }])
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Platform Help
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Ask me anything about using the platform
          </p>
        </DialogHeader>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 p-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Ask me how to use any feature!</p>
              <div className="mt-4 space-y-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setInput("How do I register a delegate?")}
                >
                  How do I register a delegate?
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setInput("How do I import BCI data?")}
                >
                  How do I import BCI data?
                </Button>
              </div>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div key={idx} className={msg.role === 'user' ? 'text-right' : ''}>
              <div className={`inline-block max-w-[80%] p-3 rounded-lg ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted'
              }`}>
                <ReactMarkdown className="prose prose-sm dark:prose-invert">
                  {msg.content}
                </ReactMarkdown>
                
                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-xs font-medium mb-2">Sources:</p>
                    {msg.sources.map((source, i) => (
                      <div key={i} className="text-xs opacity-80 mb-1">
                        • {source.title}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Suggested Actions */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {msg.actions.map((action, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => window.location.href = action.path}
                      >
                        {action.label}
                        <ExternalLink className="w-3 h-3 ml-2" />
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Feedback */}
              {msg.role === 'assistant' && (
                <div className="inline-flex gap-1 ml-2 mt-1">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <ThumbsUp className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <ThumbsDown className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
          
          {loading && (
            <div className="text-muted-foreground">
              <span className="animate-pulse">Thinking...</span>
            </div>
          )}
        </div>
        
        {/* Input */}
        <div className="flex gap-2 pt-4 border-t">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="resize-none"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

#### 4.2 Add Help Button to Layout

```tsx
// src/components/DesktopLayout.tsx (add to header)
import { MessageSquare } from 'lucide-react'
import { AiHelpDialog } from '@/components/help/AiHelpDialog'

// Add state
const [helpOpen, setHelpOpen] = useState(false)

// Add button to header (next to user menu)
<Button
  variant="ghost"
  size="icon"
  onClick={() => setHelpOpen(true)}
  className="relative"
>
  <MessageSquare className="h-5 w-5" />
</Button>

<AiHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
```

#### 4.3 API Route Handler

```typescript
// src/app/api/help/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

const HELP_WORKER_URL = process.env.HELP_WORKER_URL || 'http://localhost:3260'

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const supabase = getSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // 2. Get user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    // 3. Parse request
    const { message, context, conversationHistory } = await request.json()
    
    // 4. Forward to worker
    const workerResponse = await fetch(`${HELP_WORKER_URL}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.id}`, // For worker logging
      },
      body: JSON.stringify({
        message,
        context: {
          ...context,
          role: profile?.role || 'viewer',
        },
        conversationHistory,
      }),
    })
    
    if (!workerResponse.ok) {
      throw new Error('Worker error')
    }
    
    const data = await workerResponse.json()
    
    // 5. Log for analytics
    await supabase.from('help_interactions').insert({
      user_id: user.id,
      question: message,
      answer: data.answer,
      confidence: data.confidence,
      context: context,
      sources: data.sources,
    })
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('Help chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process help request' },
      { status: 500 }
    )
  }
}
```

### Phase 5: Cost Optimization & Monitoring (Week 5)

#### 5.1 Response Caching

```typescript
// src/cache.ts in worker
import { createHash } from 'crypto'

interface CachedResponse {
  answer: string
  sources: Source[]
  timestamp: number
  hitCount: number
}

const cache = new Map<string, CachedResponse>()
const CACHE_TTL = 3600 * 1000 // 1 hour

export function getCacheKey(question: string, context: HelpContext): string {
  const normalized = question.toLowerCase().trim()
  const contextKey = `${context.page}:${context.role}`
  return createHash('sha256').update(`${normalized}:${contextKey}`).digest('hex')
}

export function getCached(key: string): CachedResponse | null {
  const cached = cache.get(key)
  if (!cached) return null
  
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  
  cached.hitCount++
  return cached
}

export function setCached(key: string, response: Omit<CachedResponse, 'timestamp' | 'hitCount'>) {
  cache.set(key, {
    ...response,
    timestamp: Date.now(),
    hitCount: 0,
  })
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key)
    }
  }
}, 60000) // Every minute
```

#### 5.2 Rate Limiting

```typescript
// src/rateLimiter.ts
import { RateLimiterMemory } from 'rate-limiter-flexible'

const rateLimiter = new RateLimiterMemory({
  points: 20, // 20 requests
  duration: 60, // per minute per user
})

export async function checkRateLimit(userId: string): Promise<boolean> {
  try {
    await rateLimiter.consume(userId)
    return true
  } catch {
    return false
  }
}
```

#### 5.3 Cost Monitoring

```typescript
// Track costs
interface CostMetrics {
  embeddingCalls: number
  completionTokens: number
  promptTokens: number
  cacheHits: number
  cacheMisses: number
}

let metrics: CostMetrics = {
  embeddingCalls: 0,
  completionTokens: 0,
  promptTokens: 0,
  cacheHits: 0,
  cacheMisses: 0,
}

// Cost calculation (OpenAI pricing as of 2024)
export function estimateCost(): number {
  const EMBEDDING_COST = 0.00002 / 1000 // $0.00002 per 1K tokens
  const GPT4_INPUT_COST = 0.01 / 1000    // $0.01 per 1K tokens
  const GPT4_OUTPUT_COST = 0.03 / 1000   // $0.03 per 1K tokens
  
  const embeddingCost = metrics.embeddingCalls * EMBEDDING_COST
  const inputCost = metrics.promptTokens * GPT4_INPUT_COST
  const outputCost = metrics.completionTokens * GPT4_OUTPUT_COST
  
  return embeddingCost + inputCost + outputCost
}

// Expose metrics endpoint
app.get('/v1/metrics', (req, res) => {
  res.json({
    ...metrics,
    estimatedCost: estimateCost(),
    cacheHitRate: metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses),
  })
})
```

### Phase 6: Database Schema for Analytics (Week 5)

```sql
-- Track help interactions for improvement
create table if not exists help_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  question text not null,
  answer text not null,
  confidence decimal(3,2),
  context jsonb,
  sources jsonb,
  feedback text check (feedback in ('positive', 'negative', null)),
  feedback_comment text,
  created_at timestamptz not null default now()
);

create index idx_help_interactions_user_id on help_interactions(user_id);
create index idx_help_interactions_created_at on help_interactions(created_at);
create index idx_help_interactions_confidence on help_interactions(confidence);

-- Track common questions for documentation improvement
create materialized view help_common_questions as
select 
  lower(trim(question)) as normalized_question,
  count(*) as ask_count,
  avg(confidence) as avg_confidence,
  count(case when feedback = 'positive' then 1 end) as positive_count,
  count(case when feedback = 'negative' then 1 end) as negative_count
from help_interactions
where created_at > now() - interval '30 days'
group by lower(trim(question))
having count(*) >= 3
order by ask_count desc;
```

## Cost Estimates

### OpenAI GPT-4 + Embeddings
- **Embeddings** (one-time + updates): ~250 docs × 500 tokens = 125K tokens = **$2.50**
- **Per Query**:
  - Embedding: 20 tokens = $0.0004
  - Retrieval: Free (Pinecone/Chroma)
  - Completion: ~800 prompt tokens + 200 output tokens = $0.014
  - **Total per query: ~$0.015**
- **Monthly estimate** (500 queries/month): **$7.50/month**
- With 50% cache hit rate: **$3.75/month**

### Google Gemini Pro Alternative
- **Embeddings**: Free with Gemini API
- **Per Query**: ~$0.003 (cheaper than GPT-4)
- **Monthly estimate** (500 queries): **$1.50/month**
- **Recommendation: Start with Gemini for cost, switch to GPT-4 if quality issues**

### Infrastructure
- **Railway Worker**: ~$5-10/month (512MB RAM)
- **Pinecone**: Free tier (1M vectors) or $70/month for production
- **Alternative ChromaDB**: Self-hosted, free (runs on same Railway dyno)

**Total Monthly Cost: $10-20/month** (Gemini + ChromaDB + Railway)

## OpenAI vs Gemini Comparison

| Feature | OpenAI GPT-4 | Gemini Pro 1.5 |
|---------|-------------|----------------|
| Cost per query | ~$0.015 | ~$0.003 |
| Quality | Excellent | Very Good |
| Context window | 128K tokens | 1M tokens |
| Embeddings | $0.00002/1K | Free |
| Rate limits | 10K RPM | 1K RPM |
| Function calling | Yes | Yes |
| **Recommendation** | Production | MVP/Testing |

## Testing Strategy

### 1. Documentation Coverage Tests
```typescript
// Verify all features have documentation
const requiredDocs = [
  'dashboard-overview',
  'project-creation',
  'delegate-registration',
  'eba-tracking',
  // ...
]

test('all features are documented', () => {
  for (const docId of requiredDocs) {
    expect(embeddings).toContain(docId)
  }
})
```

### 2. Hallucination Detection Tests
```typescript
// Questions designed to trigger hallucination
const trickyQuestions = [
  "Can I delete all projects at once?", // Feature doesn't exist
  "How do I export to SAP?", // Unrelated system
  "What's the keyboard shortcut for XYZ?", // No shortcuts defined
]

test('should not hallucinate features', async () => {
  for (const question of trickyQuestions) {
    const response = await answerQuestion(question, context)
    expect(response.confidence).toBeLessThan(0.5)
    expect(response.answer).toMatch(/don't have information|not available/i)
  }
})
```

### 3. Accuracy Tests
```typescript
// Known questions with expected answers
const knownQA = [
  {
    question: "How do I register a delegate?",
    mustInclude: ["mapping sheet", "Add Representative", "4 steps"],
  },
  {
    question: "What user roles exist?",
    mustInclude: ["admin", "lead_organiser", "organiser", "delegate", "viewer"],
  }
]

test('answers are accurate', async () => {
  for (const qa of knownQA) {
    const response = await answerQuestion(qa.question, context)
    for (const phrase of qa.mustInclude) {
      expect(response.answer.toLowerCase()).toContain(phrase.toLowerCase())
    }
  }
})
```

## Deployment Checklist

### Documentation
- [ ] Expand USER_GUIDE.md to 1000+ lines
- [ ] Create structured JSON documentation
- [ ] Add screenshots and diagrams
- [ ] Review with actual users for accuracy
- [ ] Create workflow guides for complex tasks

### Worker Setup
- [ ] Create Railway app `cfmeu-help-ai-worker`
- [ ] Set environment variables
- [ ] Choose vector DB (Pinecone vs ChromaDB)
- [ ] Choose AI provider (OpenAI vs Gemini)
- [ ] Deploy worker
- [ ] Test health endpoint

### Embeddings
- [ ] Generate embeddings for all docs
- [ ] Upload to vector DB
- [ ] Verify search quality
- [ ] Test with sample queries
- [ ] Create update process for doc changes

### Frontend Integration
- [ ] Create AiHelpDialog component
- [ ] Add help button to layout
- [ ] Create API route handler
- [ ] Test conversation flow
- [ ] Add feedback buttons
- [ ] Mobile responsive design

### Database
- [ ] Run help_interactions migration
- [ ] Create analytics views
- [ ] Set up monitoring

### Testing
- [ ] Unit tests for RAG pipeline
- [ ] Hallucination detection tests
- [ ] Accuracy tests with known Q&A
- [ ] User acceptance testing
- [ ] Load testing

### Monitoring
- [ ] Set up cost tracking
- [ ] Create metrics dashboard
- [ ] Alert for high costs
- [ ] Track response quality
- [ ] Monitor cache hit rate

### Documentation
- [ ] Update README with help system docs
- [ ] Create admin guide for managing docs
- [ ] Document embedding update process
- [ ] Create troubleshooting guide

## Future Enhancements (Phase 7+)

### 1. Proactive Help
- Detect when users struggle (e.g., many failed searches)
- Offer contextual help automatically
- "Looks like you're trying to register a delegate. Need help?"

### 2. Video Tutorials Integration
- Record screen captures of workflows
- Embed video links in responses
- "Watch a 2-minute video on this topic"

### 3. Interactive Walkthroughs
- Step-by-step guided tours
- Highlight UI elements
- Interactive practice mode

### 4. Voice Interface
- Voice input for questions
- Text-to-speech for answers
- Accessibility feature

### 5. Multi-language Support
- Translate documentation
- Support for non-English speakers
- Auto-detect user language

### 6. Advanced Analytics
- Which features cause most confusion
- Documentation gaps analysis
- User success tracking

### 7. Integration with External Knowledge
- Link to FWC documentation
- Connect to union policy docs
- Construction industry glossary

## Success Metrics

### Quantitative
- **Adoption**: % of users who open help dialog (target: >50%)
- **Engagement**: Average questions per session (target: 2-3)
- **Satisfaction**: Positive feedback ratio (target: >80%)
- **Accuracy**: Confidence score distribution (target: avg >0.75)
- **Cost**: Monthly AI costs (target: <$50)
- **Response time**: Average response time (target: <2s)
- **Cache hit rate**: % of cached responses (target: >40%)

### Qualitative
- User feedback surveys
- Support ticket reduction
- Time to task completion
- Feature discovery rate

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Hallucination | High | RAG, low temperature, strict prompts, confidence thresholds |
| High costs | Medium | Caching, rate limiting, Gemini for MVP |
| Poor accuracy | High | Comprehensive documentation, testing, feedback loop |
| Slow responses | Medium | Caching, optimize embeddings, worker scaling |
| User confusion | Medium | Clear UI, examples, fallback to static docs |
| Documentation drift | High | Automated doc updates, version tracking |

## Conclusion

This implementation plan provides a comprehensive, production-ready AI help system that:

1. ✅ **Prevents Hallucination**: RAG-based approach with strict guardrails
2. ✅ **Uses Railway Worker**: Consistent with existing architecture [[memory:9218171]]
3. ✅ **Cost-Effective**: ~$10-20/month with optimization
4. ✅ **Scalable**: Independent worker can scale with demand
5. ✅ **Maintainable**: Structured documentation, clear update process
6. ✅ **User-Friendly**: Context-aware, conversational interface
7. ✅ **Comprehensive**: Covers all features and workflows

The phased approach allows for incremental delivery and validation at each stage. Start with documentation expansion and basic implementation, then enhance with advanced features based on user feedback.

**Recommended First Step**: Begin with Phase 1 (documentation expansion) as it provides value immediately and is prerequisite for AI implementation.
