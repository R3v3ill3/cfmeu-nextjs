#!/usr/bin/env tsx
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import fs from 'fs/promises'
import path from 'path'

config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

async function main() {
  console.log('🔄 Merging and embedding all documentation...\n')
  
  // Load all documentation sources
  const sources = [
    'docs/DOCUMENTATION_STRUCTURE.json',
    'docs/PROJECTS_PAGE_COMPREHENSIVE.json',
  ]
  
  const allDocs: any[] = []
  
  for (const source of sources) {
    try {
      const content = await fs.readFile(source, 'utf-8')
      const data = JSON.parse(content)
      const docs = data.documents || []
      console.log(`📂 Loaded ${docs.length} docs from ${source}`)
      allDocs.push(...docs)
    } catch (error) {
      console.log(`⚠️  Could not load ${source}`)
    }
  }
  
  console.log(`\n📚 Total documents to embed: ${allDocs.length}\n`)
  
  let embedded = 0
  
  for (const doc of allDocs) {
    try {
      console.log(`Embedding: ${doc.title}...`)
      
      // Generate embedding
      const embeddingText = `${doc.title}\n\n${doc.content}\n\nKeywords: ${doc.keywords?.join(', ') || ''}`
      
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: embeddingText,
      })
      
      const embedding = response.data[0].embedding
      
      // Upsert to Supabase
      const { error } = await supabase
        .from('help_documents')
        .upsert({
          doc_id: doc.id,
          title: doc.title,
          category: doc.category,
          content: doc.content,
          embedding,
          roles: doc.roles || ['all'],
          pages: doc.pages || [],
          keywords: doc.keywords || [],
          related_docs: doc.related || [],
          steps: doc.steps || null,
          screenshots: doc.screenshots || [],
        }, {
          onConflict: 'doc_id'
        })
      
      if (error) {
        console.error(`  ❌ Error: ${error.message}`)
      } else {
        console.log(`  ✓ Embedded`)
        embedded++
      }
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } catch (error) {
      console.error(`  ❌ Error:`, error)
    }
  }
  
  console.log(`\n✅ Complete! Embedded ${embedded}/${allDocs.length} documents`)
  
  // Verify
  const { count } = await supabase
    .from('help_documents')
    .select('*', { count: 'exact', head: true })
  
  console.log(`📊 Total in database: ${count}`)
}

main()
