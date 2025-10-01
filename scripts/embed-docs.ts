#!/usr/bin/env ts-node
/**
 * Script to embed documentation into Supabase pgvector
 * 
 * Usage:
 *   npm run embed-docs
 * 
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - OPENAI_API_KEY (for embeddings)
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import fs from 'fs/promises'
import path from 'path'

// Load environment variables from .env
config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

interface Document {
  id: string
  title: string
  category: string
  content: string
  roles: string[]
  pages: string[]
  keywords: string[]
  related?: string[]
  steps?: string[]
  screenshots?: string[]
}

async function embedDocument(doc: Document) {
  console.log(`Embedding: ${doc.title}...`)

  try {
    // Generate text for embedding
    const embeddingText = `${doc.title}\n\n${doc.content}\n\nKeywords: ${doc.keywords.join(', ')}`

    // Generate embedding using OpenAI
    console.log(`  - Calling OpenAI API...`)
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: embeddingText,
    })

    const embedding = response.data[0].embedding
    console.log(`  - Got embedding (${embedding.length} dimensions)`)

    // Upsert to Supabase
    console.log(`  - Upserting to Supabase...`)
    const result = await supabase
      .from('help_documents')
      .upsert(
        {
          doc_id: doc.id,
          title: doc.title,
          category: doc.category,
          content: doc.content,
          embedding,
          roles: doc.roles,
          pages: doc.pages,
          keywords: doc.keywords,
          related_docs: doc.related || [],
          steps: doc.steps || null,
          screenshots: doc.screenshots || [],
        },
        {
          onConflict: 'doc_id',
        }
      )

    console.log(`  - Result status:`, result.status, result.statusText)
    
    if (result.error) {
      console.error(`Supabase error for ${doc.id}:`)
      console.error('  error:', result.error)
      console.error('  status:', result.status)
      console.error('  statusText:', result.statusText)
      throw new Error(`Failed to embed ${doc.id}: ${result.error.message || result.statusText || JSON.stringify(result.error)}`)
    }

    console.log(`✓ Embedded: ${doc.title}`)
  } catch (err) {
    console.error(`Exception in embedDocument:`, err)
    throw err
  }
}

async function loadDocuments(): Promise<Document[]> {
  const docsPath = path.join(process.cwd(), 'docs', 'DOCUMENTATION_STRUCTURE.json')
  const content = await fs.readFile(docsPath, 'utf-8')
  const data = JSON.parse(content)
  return data.documents
}

async function main() {
  console.log('🚀 Starting documentation embedding...\n')

  try {
    // Load documents
    const documents = await loadDocuments()
    console.log(`Found ${documents.length} documents to embed\n`)

    // Embed each document
    for (const doc of documents) {
      await embedDocument(doc)
      // Small delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    console.log(`\n✅ Successfully embedded ${documents.length} documents!`)

    // Query to verify
    const { count, error } = await supabase
      .from('help_documents')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error('Error counting documents:', error)
    } else {
      console.log(`Total documents in database: ${count}`)
    }
  } catch (error) {
    console.error('❌ Error embedding documents:')
    console.error(error instanceof Error ? error.message : JSON.stringify(error, null, 2))
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack)
    }
    process.exit(1)
  }
}

main()
