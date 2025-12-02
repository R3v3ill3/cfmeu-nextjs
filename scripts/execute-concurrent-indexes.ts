#!/usr/bin/env tsx
/**
 * Execute CREATE INDEX CONCURRENTLY statements
 * 
 * This script connects directly to PostgreSQL and executes each CREATE INDEX
 * CONCURRENTLY statement individually, ensuring they run outside transactions.
 * 
 * Usage:
 *   tsx scripts/execute-concurrent-indexes.ts "postgresql://user:pass@host:port/db"
 */

import { Client } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

const connectionString = process.argv[2]

if (!connectionString) {
  console.error('Error: Connection string required')
  console.error('Usage: tsx scripts/execute-concurrent-indexes.ts "postgresql://user:pass@host:port/db"')
  process.exit(1)
}

const sqlFile = join(__dirname, '../supabase/manual/20251201_search_indexes_concurrent.sql')
const sql = readFileSync(sqlFile, 'utf-8')

// Split by semicolons and filter out comments/empty lines
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--') && s.length > 0)

async function executeIndexes() {
  const client = new Client({ connectionString })
  
  try {
    console.log('Connecting to database...')
    await client.connect()
    console.log('✓ Connected successfully\n')

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (!statement.includes('CREATE INDEX CONCURRENTLY')) {
        continue // Skip non-index statements
      }

      // Extract index name for logging
      const indexMatch = statement.match(/CREATE INDEX CONCURRENTLY IF NOT EXISTS (\w+)/)
      const indexName = indexMatch ? indexMatch[1] : `index_${i + 1}`
      
      console.log(`Creating index: ${indexName}...`)
      console.log(`  ${statement.substring(0, 80)}...`)
      
      try {
        // Execute without transaction - pg library allows this for CREATE INDEX CONCURRENTLY
        await client.query(statement)
        console.log(`  ✓ ${indexName} created successfully\n`)
      } catch (error: any) {
        // Check if index already exists
        if (error.message?.includes('already exists') || error.code === '42P07') {
          console.log(`  ⚠ ${indexName} already exists, skipping\n`)
        } else {
          console.error(`  ✗ Error creating ${indexName}:`, error.message)
          throw error
        }
      }
    }

    console.log('✓ All indexes processed successfully!')
  } catch (error: any) {
    console.error('\n✗ Error:', error.message)
    if (error.code) {
      console.error('  Code:', error.code)
    }
    process.exit(1)
  } finally {
    await client.end()
  }
}

executeIndexes()




